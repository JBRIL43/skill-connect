# Tests POST /api/notifications/check (Phase 5).
#
#   npm run dev            # in another terminal
#   .\scripts\test-notifications.ps1 -BaseUrl http://localhost:3001
#
# Dev 3 calls this route right after a challenge is graded, so its contract
# matters to someone else's code. Covers the four things that contract promises:
# an opted-out candidate is never surfaced, a cleared template files exactly one
# notification, a second call files none, and a bar the candidate misses files
# none either.
#
# Builds its own fixtures through the service role and removes them afterwards.

param(
  [string]$BaseUrl = "http://localhost:3000",
  [string]$Password = "Test1234!"
)

$ErrorActionPreference = "Stop"
. "$PSScriptRoot\_shared.ps1"

Import-DotEnv

$url = $env:NEXT_PUBLIC_SUPABASE_URL
$svc = Get-ServiceHeaders
$json = @{ "Content-Type" = "application/json" }
$script:failures = 0

function Assert-Equal($label, $actual, $expected) {
  if ($actual -eq $expected) {
    Write-Host ("  PASS  {0}" -f $label) -ForegroundColor Green
  } else {
    Write-Host ("  FAIL  {0} (got '{1}', expected '{2}')" -f $label, $actual, $expected) -ForegroundColor Red
    $script:failures++
  }
}

function Invoke-Rest($method, $path, $body) {
  $args = @{
    Method  = $method
    Uri     = "$url/rest/v1/$path"
    Headers = $svc + $json + @{ Prefer = "return=representation" }
  }
  if ($body) { $args.Body = ($body | ConvertTo-Json -Depth 6) }
  return Invoke-RestMethod @args
}

$client = New-NoRedirectClient

function Invoke-Check($cookie, $candidateId) {
  $req = New-Object System.Net.Http.HttpRequestMessage([System.Net.Http.HttpMethod]::Post, "$BaseUrl/api/notifications/check")
  [void]$req.Headers.TryAddWithoutValidation("Cookie", $cookie)
  $payload = @{ candidate_id = $candidateId } | ConvertTo-Json
  $req.Content = New-Object System.Net.Http.StringContent($payload, [Text.Encoding]::UTF8, "application/json")

  $res = $client.SendAsync($req).GetAwaiter().GetResult()
  $text = $res.Content.ReadAsStringAsync().GetAwaiter().GetResult()
  return [PSCustomObject]@{ Status = [int]$res.StatusCode; Body = ($text | ConvertFrom-Json) }
}

# --- fixtures ---------------------------------------------------------------

Write-Host "`nBuilding fixtures..." -ForegroundColor Cyan

$seeker = Get-AccessToken "selam.seeker@example.com" $Password
$smeAuth = Get-AccessToken "abeba.sme@example.com" $Password
$seekerId = $seeker.UserId
$smeId = $smeAuth.UserId

# Deliberately outside the frozen vocabulary in lib/sandbox/competencies.ts, and
# deliberately used on both the score and the threshold side so the two still
# meet. A real key such as adaptability would let seeded candidates clear these
# fixtures and report a pass the mechanism did not earn. Do not "correct" this to
# a frozen key -- the isolation is the point.
$competency = "notif_test_competency"

Invoke-Rest Post "sandbox_scores" @{
  user_id     = $seekerId
  node_id     = "notif-test-node"
  scores_json = @{ $competency = 80 }
} | Out-Null

$cleared = (Invoke-Rest Post "role_skill_templates" @{
  sme_id          = $smeId
  role_name       = "Notif test - clearable"
  thresholds_json = @{ $competency = 70 }
  notify_on_match = $true
})[0]

$unreachable = (Invoke-Rest Post "role_skill_templates" @{
  sme_id          = $smeId
  role_name       = "Notif test - out of reach"
  thresholds_json = @{ $competency = 95 }
  notify_on_match = $true
})[0]

function Set-Discoverable($value) {
  Invoke-RestMethod -Method Patch -Uri "$url/rest/v1/profiles?id=eq.$seekerId" `
    -Headers ($svc + $json) -Body (@{ opt_in_discoverable = $value } | ConvertTo-Json) | Out-Null
}

function Get-NotificationCount($templateId) {
  $rows = Invoke-RestMethod -Method Get `
    -Uri "$url/rest/v1/notifications?select=id&template_id=eq.$templateId&candidate_id=eq.$seekerId" -Headers $svc
  return @($rows).Count
}

try {
  Write-Host "`nAn opted-out candidate is never surfaced" -ForegroundColor Cyan
  Set-Discoverable $false
  $optedOut = Invoke-Check $seeker.Cookie $seekerId
  Assert-Equal "check returns 200" $optedOut.Status 200
  Assert-Equal "skipped as not_discoverable" $optedOut.Body.skipped "not_discoverable"
  Assert-Equal "no notification written" (Get-NotificationCount $cleared.id) 0

  Write-Host "`nOpting in files one notification per cleared template" -ForegroundColor Cyan
  Set-Discoverable $true
  $first = Invoke-Check $seeker.Cookie $seekerId
  Assert-Equal "one new notification" $first.Body.notified 1
  Assert-Equal "notification row exists" (Get-NotificationCount $cleared.id) 1

  Write-Host "`nA bar the candidate misses files nothing" -ForegroundColor Cyan
  Assert-Equal "80 does not clear a bar of 95" (Get-NotificationCount $unreachable.id) 0

  Write-Host "`nRunning again is a no-op" -ForegroundColor Cyan
  $second = Invoke-Check $seeker.Cookie $seekerId
  Assert-Equal "no new notifications" $second.Body.notified 0
  Assert-Equal "still exactly one row" (Get-NotificationCount $cleared.id) 1

  Write-Host "`nA candidate cannot run the check for someone else" -ForegroundColor Cyan
  $other = Invoke-Check $seeker.Cookie $smeId
  Assert-Equal "forbidden" $other.Status 403
}
finally {
  Write-Host "`nCleaning up fixtures..." -ForegroundColor Cyan
  Invoke-RestMethod -Method Delete -Uri "$url/rest/v1/notifications?candidate_id=eq.$seekerId&template_id=in.($($cleared.id),$($unreachable.id))" -Headers $svc | Out-Null
  Invoke-RestMethod -Method Delete -Uri "$url/rest/v1/role_skill_templates?id=in.($($cleared.id),$($unreachable.id))" -Headers $svc | Out-Null
  Invoke-RestMethod -Method Delete -Uri "$url/rest/v1/sandbox_scores?node_id=eq.notif-test-node" -Headers $svc | Out-Null
  Set-Discoverable $false
}

Write-Host ""
if ($script:failures -eq 0) {
  Write-Host "All notification checks passed." -ForegroundColor Green
  exit 0
} else {
  Write-Host "$($script:failures) notification check(s) FAILED." -ForegroundColor Red
  exit 1
}
