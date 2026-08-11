# Exercises /admin/promote end to end against a running dev server.
#
#   npm run dev
#   .\scripts\verify-promote.ps1 -BaseUrl "http://localhost:3000"
#
# This is the one flow no other suite reaches. verify-routing.ps1 proves a job
# seeker is refused at /admin, and test-rls.ps1 proves nobody can write
# role = 'admin' to their own row -- but the deliberate hole in the middle, the
# invite code that mints an admin through the service role, was only ever
# checked by hand.
#
# It drives the real server action rather than calling Supabase directly, by
# replaying the hidden fields Next.js renders for browsers without JavaScript.
# That means the invite code check, the requireProfile() call and the redirect
# are all covered. The action id changes whenever the route recompiles, so it is
# scraped fresh on every run rather than hard-coded.
#
# The invite code is read from .env.local into a variable and never printed.
# The probe account is created and deleted by this script; it is promoted to
# admin along the way, so leaving it behind would leave a spare admin behind.

param(
  [string]$BaseUrl = "http://localhost:3000",
  [string]$ProbeEmail = "promote-probe@example.com",
  [string]$ProbePassword = "Test1234!"
)

$ErrorActionPreference = "Stop"
. "$PSScriptRoot\_shared.ps1"
Import-DotEnv

$url = $env:NEXT_PUBLIC_SUPABASE_URL
$code = $env:ADMIN_INVITE_CODE
$svcHeaders = Get-ServiceHeaders
$failed = 0

if (-not $code) {
  Write-Host "ADMIN_INVITE_CODE is not set in .env.local, so there is nothing to test." -ForegroundColor Red
  exit 1
}

function Assert($name, $condition, $detail) {
  if ($condition) {
    Write-Host "  PASS  $name" -ForegroundColor Green
  } else {
    Write-Host "  FAIL  $name" -ForegroundColor Red
    if ($detail) { Write-Host "        $detail" -ForegroundColor DarkGray }
    $script:failed++
  }
}

function Get-ProbeRole($probeId) {
  $res = Invoke-WebRequest -UseBasicParsing -Headers $svcHeaders `
    -Uri "$url/rest/v1/profiles?select=role&id=eq.$probeId"
  return ($res.Content | ConvertFrom-Json)[0].role
}

# ---------------------------------------------------------------------------
# A fresh account every run, so a previous failure cannot leave one already
# promoted and make the positive check pass without doing anything.
# ---------------------------------------------------------------------------

Write-Host "`nBuilding a throwaway account..." -ForegroundColor Cyan

$existing = (Invoke-WebRequest -UseBasicParsing -Headers $svcHeaders `
  -Uri "$url/auth/v1/admin/users?filter=$ProbeEmail").Content | ConvertFrom-Json

foreach ($user in $existing.users) {
  if ($user.email -eq $ProbeEmail) {
    Invoke-WebRequest -UseBasicParsing -Method Delete -Headers $svcHeaders `
      -Uri "$url/auth/v1/admin/users/$($user.id)" | Out-Null
  }
}

$probe = (Invoke-WebRequest -UseBasicParsing -Method Post -Headers $svcHeaders `
  -ContentType "application/json" -Uri "$url/auth/v1/admin/users" `
  -Body (@{
    email         = $ProbeEmail
    password      = $ProbePassword
    email_confirm = $true
    user_metadata = @{ role = "job_seeker"; full_name = "Promote Probe" }
  } | ConvertTo-Json)).Content | ConvertFrom-Json

$probeId = $probe.id

try {
  $auth = Get-AccessToken $ProbeEmail $ProbePassword
  $client = New-NoRedirectClient

  Assert "probe starts as a job seeker" ((Get-ProbeRole $probeId) -eq "job_seeker")

  # -------------------------------------------------------------------------
  # Reads the form the way a browser would, then posts it back.
  # -------------------------------------------------------------------------

  function Invoke-PromoteForm($inviteCode) {
    $get = New-Object System.Net.Http.HttpRequestMessage("GET", "$BaseUrl/admin/promote")
    $get.Headers.Add("Cookie", $auth.Cookie)
    $page = $client.SendAsync($get).Result
    $html = $page.Content.ReadAsStringAsync().Result

    if ([int]$page.StatusCode -ne 200) {
      throw "GET /admin/promote returned $([int]$page.StatusCode), expected 200."
    }

    $form = [regex]::Match($html, '<form[^>]*method="POST".*?</form>').Value
    $body = New-Object System.Net.Http.MultipartFormDataContent

    # The hidden $ACTION_* fields are how Next.js names the server action when
    # the client runtime is not there to send a Next-Action header.
    foreach ($input in [regex]::Matches($form, '<input[^>]*type="hidden"[^>]*>')) {
      $name = [regex]::Match($input.Value, 'name="([^"]+)"').Groups[1].Value
      $raw = [regex]::Match($input.Value, 'value="([^"]*)"').Groups[1].Value
      $part = New-Object System.Net.Http.StringContent(
        [System.Net.WebUtility]::HtmlDecode($raw))
      $part.Headers.ContentType = $null
      $body.Add($part, $name)
    }

    $codePart = New-Object System.Net.Http.StringContent($inviteCode)
    $codePart.Headers.ContentType = $null
    $body.Add($codePart, "code")

    $post = New-Object System.Net.Http.HttpRequestMessage("POST", "$BaseUrl/admin/promote")
    $post.Headers.Add("Cookie", $auth.Cookie)
    $post.Content = $body
    return $client.SendAsync($post).Result
  }

  Write-Host "`nA wrong invite code changes nothing" -ForegroundColor Cyan

  $rejected = Invoke-PromoteForm "definitely-not-the-code"
  $rejectedBody = $rejected.Content.ReadAsStringAsync().Result

  Assert "request is accepted for processing" ([int]$rejected.StatusCode -eq 200) `
    "got $([int]$rejected.StatusCode)"
  Assert "the invalid-code message comes back" `
    ($rejectedBody -match "That invite code is not valid") `
    "response did not contain the error text"
  Assert "still a job seeker" ((Get-ProbeRole $probeId) -eq "job_seeker") `
    "a wrong code promoted the account"

  Write-Host "`nThe real invite code promotes the account" -ForegroundColor Cyan

  $accepted = Invoke-PromoteForm $code
  $status = [int]$accepted.StatusCode
  $location = $accepted.Headers.Location
  if (-not $location -and $accepted.Content) {
    # A server action redirect arrives as a 200 carrying an RSC redirect rather
    # than a 303 when the request came from the client runtime.
    $acceptedBody = $accepted.Content.ReadAsStringAsync().Result
  }

  Assert "the action ran" ($status -eq 200 -or $status -eq 303) "got $status"
  Assert "the account is now an admin" ((Get-ProbeRole $probeId) -eq "admin") `
    "role is still $(Get-ProbeRole $probeId)"

  $redirected = ($location -match "/admin") -or ($acceptedBody -match "/admin")
  Assert "it redirects to the console" $redirected `
    "no /admin redirect in the response"

  Write-Host "`nThe promoted account can now open the console" -ForegroundColor Cyan

  $fresh = Get-AccessToken $ProbeEmail $ProbePassword
  $consoleReq = New-Object System.Net.Http.HttpRequestMessage("GET", "$BaseUrl/admin")
  $consoleReq.Headers.Add("Cookie", $fresh.Cookie)
  $console = $client.SendAsync($consoleReq).Result

  Assert "/admin returns the console" ([int]$console.StatusCode -eq 200) `
    "got $([int]$console.StatusCode)"
}
finally {
  Write-Host "`nRemoving the throwaway account..." -ForegroundColor Cyan
  Invoke-WebRequest -UseBasicParsing -Method Delete -Headers $svcHeaders `
    -Uri "$url/auth/v1/admin/users/$probeId" | Out-Null
}

if ($failed -gt 0) {
  Write-Host "`n$failed check(s) failed." -ForegroundColor Red
  exit 1
}

Write-Host "`nAll promote checks passed." -ForegroundColor Green
