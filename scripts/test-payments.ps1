# Exercises the SME upgrade flow end to end against a running dev server.
#
#   npm run dev
#   .\scripts\test-payments.ps1 -BaseUrl "http://localhost:3000"
#
# Phase 7 asks for the full checkout to be run at least twice, so this runs it
# twice and checks the second run behaves like a repeat customer rather than a
# first one.
#
# It drives the real server actions by replaying the hidden fields Next.js
# renders for browsers without JavaScript, the same trick verify-promote.ps1
# uses. That means requireRole, the ownership check and the redirect are all
# covered, not just the database writes underneath them.
#
# The fixture SME is created and deleted here. It is deliberately not one of the
# seeded companies: paying as abeba.sme@example.com would leave her on Premium
# and change what the demo shows.

param(
  [string]$BaseUrl = "http://localhost:3000",
  [string]$ProbeEmail = "payments-fixture-sme@example.com",
  [string]$ProbePassword = "Test1234!",
  # Only used to read the admin console's counters, which are role gated.
  [string]$AdminEmail = "sneaky.admin@example.com"
)

$ErrorActionPreference = "Stop"
. "$PSScriptRoot\_shared.ps1"
Import-DotEnv

$url = $env:NEXT_PUBLIC_SUPABASE_URL
$svcHeaders = Get-ServiceHeaders
$failed = 0

function Assert($name, $condition, $detail) {
  if ($condition) {
    Write-Host "  PASS  $name" -ForegroundColor Green
  } else {
    Write-Host "  FAIL  $name" -ForegroundColor Red
    if ($detail) { Write-Host "        $detail" -ForegroundColor DarkGray }
    $script:failed++
  }
}

function Get-Payments($smeId) {
  $res = Invoke-WebRequest -UseBasicParsing -Headers $svcHeaders `
    -Uri "$url/rest/v1/payments?select=*&sme_id=eq.$smeId&order=created_at.asc"
  return @($res.Content | ConvertFrom-Json)
}

# PostgREST reports the total in Content-Range when asked for an exact count,
# which beats counting a page of rows client-side.
function Get-Count($query) {
  $headers = Get-ServiceHeaders
  $headers["Prefer"] = "count=exact"
  $res = Invoke-WebRequest -UseBasicParsing -Headers $headers `
    -Uri "$url/rest/v1/$query&select=id&limit=1"
  return ($res.Headers["Content-Range"] -split "/")[-1]
}

# ---------------------------------------------------------------------------
# A fresh SME every run, so a leftover paid row cannot make the premium
# assertions pass without this run having paid for anything.
# ---------------------------------------------------------------------------

Write-Host "`nBuilding a throwaway SME..." -ForegroundColor Cyan

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
    user_metadata = @{ role = "sme"; full_name = "Payments Fixture"; company_name = "Fixture Trading PLC" }
  } | ConvertTo-Json)).Content | ConvertFrom-Json

$probeId = $probe.id

try {
  $auth = Get-AccessToken $ProbeEmail $ProbePassword
  $client = New-NoRedirectClient

  # -------------------------------------------------------------------------
  # Replays a server-action form the way a browser without JavaScript would.
  # -------------------------------------------------------------------------

  function Invoke-ActionForm($path, $formPattern, $extraFields) {
    $get = New-Object System.Net.Http.HttpRequestMessage("GET", "$BaseUrl$path")
    $get.Headers.Add("Cookie", $auth.Cookie)
    $page = $client.SendAsync($get).Result
    $html = $page.Content.ReadAsStringAsync().Result

    if ([int]$page.StatusCode -ne 200) {
      throw "GET $path returned $([int]$page.StatusCode), expected 200."
    }

    $form = [regex]::Match($html, $formPattern).Value
    if (-not $form) { throw "No form matching $formPattern on $path." }

    $body = New-Object System.Net.Http.MultipartFormDataContent

    foreach ($input in [regex]::Matches($form, '<input[^>]*type="hidden"[^>]*>')) {
      $name = [regex]::Match($input.Value, 'name="([^"]+)"').Groups[1].Value
      $raw = [regex]::Match($input.Value, 'value="([^"]*)"').Groups[1].Value
      $part = New-Object System.Net.Http.StringContent(
        [System.Net.WebUtility]::HtmlDecode($raw))
      $part.Headers.ContentType = $null
      $body.Add($part, $name)
    }

    if ($extraFields) {
      foreach ($key in $extraFields.Keys) {
        $part = New-Object System.Net.Http.StringContent($extraFields[$key])
        $part.Headers.ContentType = $null
        $body.Add($part, $key)
      }
    }

    $post = New-Object System.Net.Http.HttpRequestMessage("POST", "$BaseUrl$path")
    $post.Headers.Add("Cookie", $auth.Cookie)
    $post.Content = $body
    $res = $client.SendAsync($post).Result

    return [PSCustomObject]@{
      Status   = [int]$res.StatusCode
      Location = $res.Headers.Location
      Body     = $res.Content.ReadAsStringAsync().Result
    }
  }

  function Get-UpgradePage {
    $req = New-Object System.Net.Http.HttpRequestMessage("GET", "$BaseUrl/dashboard/upgrade")
    $req.Headers.Add("Cookie", $auth.Cookie)
    $res = $client.SendAsync($req).Result
    return $res.Content.ReadAsStringAsync().Result
  }

  # -------------------------------------------------------------------------

  Write-Host "`nBefore paying" -ForegroundColor Cyan

  Assert "no payments rows yet" ((Get-Payments $probeId).Count -eq 0)

  # Platform-wide, so it has to be read before this run adds to it.
  $paidBefore = [int](Get-Count "payments?status=eq.paid")

  $before = Get-UpgradePage
  Assert "upgrade page offers checkout" ($before -match "Pay with telebirr")
  Assert "upgrade page says free plan" ($before -match "Free plan")
  Assert "the mock is labelled as a demo" ($before -match "Demo checkout") `
    "PAYMENTS_PROVIDER may be set to telebirr"

  # -------------------------------------------------------------------------
  # Phase 7 wants the full checkout run twice. The first run pays; the second
  # proves a paid account is recognised rather than quietly charged again.
  # -------------------------------------------------------------------------

  Write-Host "`nRun 1: opening checkout" -ForegroundColor Cyan

  $start = Invoke-ActionForm "/dashboard/upgrade" '<form[^>]*>(?:(?!</form>).)*Pay with telebirr(?:(?!</form>).)*</form>' $null
  $refMatch = [regex]::Match("$($start.Location)$($start.Body)", 'checkout\?ref=([A-Za-z0-9]+)')
  $ref = $refMatch.Groups[1].Value

  Assert "the action redirected to checkout" ($refMatch.Success) `
    "status $($start.Status), no checkout URL in the response"

  $rows = Get-Payments $probeId
  Assert "one payments row was opened" ($rows.Count -eq 1) "found $($rows.Count)"
  Assert "it is pending" ($rows[0].status -eq "pending") "status is $($rows[0].status)"
  Assert "provider is mock" ($rows[0].provider -eq "mock") "provider is $($rows[0].provider)"
  Assert "external_ref matches the redirect" ($rows[0].external_ref -eq $ref) `
    "row has $($rows[0].external_ref), URL had $ref"
  Assert "amount is a positive integer" ($rows[0].amount -gt 0)

  Write-Host "`nRun 1: the styled checkout screen" -ForegroundColor Cyan

  $checkoutReq = New-Object System.Net.Http.HttpRequestMessage(
    "GET", "$BaseUrl/dashboard/upgrade/checkout?ref=$ref")
  $checkoutReq.Headers.Add("Cookie", $auth.Cookie)
  $checkout = $client.SendAsync($checkoutReq).Result
  $checkoutBody = $checkout.Content.ReadAsStringAsync().Result

  Assert "checkout renders" ([int]$checkout.StatusCode -eq 200) `
    "got $([int]$checkout.StatusCode)"
  Assert "it shows the order number" ($checkoutBody -match [regex]::Escape($ref))
  Assert "it is styled as telebirr" ($checkoutBody -match "telebirr")

  Write-Host "`nRun 1: confirming" -ForegroundColor Cyan

  $confirm = Invoke-ActionForm "/dashboard/upgrade/checkout?ref=$ref" `
    '<form[^>]*>(?:(?!</form>).)*name="ref"(?:(?!</form>).)*</form>' `
    @{ phone = "0912345678"; pin = "000000" }

  $rows = Get-Payments $probeId
  Assert "still exactly one row" ($rows.Count -eq 1) "found $($rows.Count)"
  Assert "the row is paid" ($rows[0].status -eq "paid") "status is $($rows[0].status)"
  Assert "a provider reference was recorded" ([string]$rows[0].provider_tx_id -ne "") `
    "provider_tx_id is empty"
  Assert "it redirects to the completion screen" `
    ("$($confirm.Location)$($confirm.Body)" -match "upgrade/complete") `
    "status $($confirm.Status)"

  Write-Host "`nPremium is unlocked" -ForegroundColor Cyan

  $after = Get-UpgradePage
  Assert "the upgrade page reports Premium" ($after -match "You are on Premium")
  Assert "it no longer offers checkout" (-not ($after -match "Pay with telebirr"))

  # -------------------------------------------------------------------------
  # Section 13's demo ends on the admin console, so the counter behind it has to
  # actually move. Checked as an admin, because that page is role gated.
  # -------------------------------------------------------------------------

  Write-Host "`nThe admin console counts the upgrade" -ForegroundColor Cyan

  $paidNow = [int](Get-Count "payments?status=eq.paid")
  Assert "the paid count includes this payment" ($paidNow -ge 1)
  Assert "and it went up by one" ($paidNow -eq $paidBefore + 1) `
    "was $paidBefore, now $paidNow"

  $adminAuth = Get-AccessToken $AdminEmail $ProbePassword
  $adminReq = New-Object System.Net.Http.HttpRequestMessage("GET", "$BaseUrl/admin")
  $adminReq.Headers.Add("Cookie", $adminAuth.Cookie)
  $adminRes = $client.SendAsync($adminReq).Result
  $adminBody = $adminRes.Content.ReadAsStringAsync().Result

  Assert "the console renders" ([int]$adminRes.StatusCode -eq 200) `
    "got $([int]$adminRes.StatusCode)"
  Assert "it has a Premium upgrades counter" ($adminBody -match "Premium upgrades")

  # -------------------------------------------------------------------------
  # A settled order must not be payable a second time. Re-opening the checkout
  # link is the way a user would stumble into that -- a back button, or a tab
  # left open while the payment went through in another.
  # -------------------------------------------------------------------------

  Write-Host "`nRe-opening a settled checkout" -ForegroundColor Cyan

  $reopenReq = New-Object System.Net.Http.HttpRequestMessage(
    "GET", "$BaseUrl/dashboard/upgrade/checkout?ref=$ref")
  $reopenReq.Headers.Add("Cookie", $auth.Cookie)
  $reopen = $client.SendAsync($reopenReq).Result

  Assert "it redirects instead of asking for payment again" `
    ([int]$reopen.StatusCode -ge 300 -and [int]$reopen.StatusCode -lt 400) `
    "got $([int]$reopen.StatusCode)"
  Assert "and lands on the completion screen" `
    ("$($reopen.Headers.Location)" -match "upgrade/complete") `
    "location was $($reopen.Headers.Location)"

  $rows = Get-Payments $probeId
  Assert "no extra row appeared" ($rows.Count -eq 1) "found $($rows.Count)"
  Assert "it is still paid exactly once" `
    (@($rows | Where-Object { $_.status -eq "paid" }).Count -eq 1)

  # -------------------------------------------------------------------------

  Write-Host "`nRun 2: a second checkout on a paid account" -ForegroundColor Cyan

  # The upgrade page no longer renders the button, which is the correct product
  # behaviour, so run 2 checks that rather than forcing a duplicate charge.
  $second = Get-UpgradePage
  Assert "a paid SME is not offered checkout again" `
    (-not ($second -match "Pay with telebirr"))
  Assert "and is pointed at what they bought" ($second -match "Go to your templates")

  $rows = Get-Payments $probeId
  Assert "still one payment on the account" ($rows.Count -eq 1) "found $($rows.Count)"

  # -------------------------------------------------------------------------
  # The webhook. Telebirr posts this from their own servers with no session, so
  # it is checked here the same way: no cookie on the request.
  #
  # Driven against a mock-provider row on purpose. reconcilePayment asks
  # whichever provider opened the order, so the route, the lookup by
  # external_ref, the settle and the idempotency guard are all exercised without
  # needing live Telebirr credentials.
  # -------------------------------------------------------------------------

  Write-Host "`nThe notify webhook" -ForegroundColor Cyan

  $hookRef = "SCHOOK" + [Guid]::NewGuid().ToString("N").Substring(0, 12).ToUpper()

  $insertHeaders = Get-ServiceHeaders
  $insertHeaders["Prefer"] = "return=representation"
  Invoke-WebRequest -UseBasicParsing -Method Post -Headers $insertHeaders `
    -ContentType "application/json" -Uri "$url/rest/v1/payments" `
    -Body (@{
      sme_id       = $probeId
      provider     = "mock"
      amount       = 500
      status       = "pending"
      external_ref = $hookRef
    } | ConvertTo-Json) | Out-Null

  function Invoke-Notify($payload) {
    $req = New-Object System.Net.Http.HttpRequestMessage(
      "POST", "$BaseUrl/api/payments/telebirr/notify")
    $req.Content = New-Object System.Net.Http.StringContent(
      $payload, [Text.Encoding]::UTF8, "application/json")
    $res = $client.SendAsync($req).Result
    return [PSCustomObject]@{
      Status = [int]$res.StatusCode
      Body   = $res.Content.ReadAsStringAsync().Result
    }
  }

  $first = Invoke-Notify (@{ merch_order_id = $hookRef; trade_status = "Completed" } | ConvertTo-Json)

  Assert "it accepts an unauthenticated callback" ($first.Status -eq 200) `
    "got $($first.Status) -- a redirect here means middleware is gating it"

  $hookRow = @(Get-Payments $probeId | Where-Object { $_.external_ref -eq $hookRef })
  Assert "the order is settled" ($hookRow[0].status -eq "paid") `
    "status is $($hookRow[0].status)"

  $second = Invoke-Notify (@{ merch_order_id = $hookRef; trade_status = "Completed" } | ConvertTo-Json)

  Assert "a duplicate callback is accepted" ($second.Status -eq 200) "got $($second.Status)"

  $hookRows = @(Get-Payments $probeId | Where-Object { $_.external_ref -eq $hookRef })
  Assert "and does not create a second row" ($hookRows.Count -eq 1) `
    "found $($hookRows.Count)"
  Assert "and leaves it paid" ($hookRows[0].status -eq "paid")

  $unknown = Invoke-Notify (@{ merch_order_id = "SCNOSUCHORDER123" } | ConvertTo-Json)
  Assert "an unknown order is acknowledged, not retried forever" `
    ($unknown.Status -eq 200) "got $($unknown.Status)"

  $malformed = Invoke-Notify '{"trade_status":"Completed"}'
  Assert "a callback with no order number is rejected" ($malformed.Status -eq 400) `
    "got $($malformed.Status)"
}
finally {
  Write-Host "`nRemoving the throwaway SME and its payments..." -ForegroundColor Cyan
  Invoke-WebRequest -UseBasicParsing -Method Delete -Headers $svcHeaders `
    -Uri "$url/rest/v1/payments?sme_id=eq.$probeId" | Out-Null
  Invoke-WebRequest -UseBasicParsing -Method Delete -Headers $svcHeaders `
    -Uri "$url/auth/v1/admin/users/$probeId" | Out-Null
}

if ($failed -gt 0) {
  Write-Host "`n$failed check(s) failed." -ForegroundColor Red
  exit 1
}

Write-Host "`nAll payment checks passed." -ForegroundColor Green
