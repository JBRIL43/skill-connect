# Role-routing test suite for Skill-Connect Ethiopia.
#
#   npm run dev            # in another terminal
#   .\scripts\verify-routing.ps1
#
# If Next reports "Port 3000 is in use ... using available port 3001", pass the
# port it actually bound: .\scripts\verify-routing.ps1 -BaseUrl http://localhost:3001
#
# Section 4 of the spec says each role has one correct landing page and cannot
# reach another role's. RLS protects the data; this protects the navigation.
# Signs in as each test account through the auth API, mints the session cookie
# @supabase/ssr expects, and asserts what the server actually returns.
#
# Any FAIL is a P0. Run it after touching middleware.ts, lib/auth.ts, or any
# page that calls requireRole.

param(
  [string]$BaseUrl = "http://localhost:3000",
  [string]$Password = "Test1234!"
)

$ErrorActionPreference = "Stop"
. "$PSScriptRoot\_shared.ps1"

Import-DotEnv

if (-not $env:NEXT_PUBLIC_SUPABASE_URL -or -not $env:NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  Write-Host "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set in .env.local." -ForegroundColor Red
  exit 1
}

$cookieName = Get-AuthCookieName
$script:failures = 0

function Write-Pass($label) {
  Write-Host ("  PASS  {0}" -f $label) -ForegroundColor Green
}

function Write-Fail($label, $detail) {
  Write-Host ("  FAIL  {0} -- {1}" -f $label, $detail) -ForegroundColor Red
  $script:failures++
}

# --- requests ---------------------------------------------------------------

$client = New-NoRedirectClient

function Get-Route($path, $cookie) {
  $req = New-Object System.Net.Http.HttpRequestMessage([System.Net.Http.HttpMethod]::Get, "$BaseUrl$path")
  if ($cookie) { [void]$req.Headers.TryAddWithoutValidation("Cookie", $cookie) }

  $res = $client.SendAsync($req).GetAwaiter().GetResult()
  $location = ""
  if ($res.Headers.Location) { $location = $res.Headers.Location.ToString() }

  return [PSCustomObject]@{
    Status   = [int]$res.StatusCode
    Location = $location
    Body     = $res.Content.ReadAsStringAsync().GetAwaiter().GetResult()
  }
}

function Assert-RedirectsTo($label, $result, $expected) {
  if ($result.Status -lt 300 -or $result.Status -ge 400) {
    Write-Fail $label "expected a redirect to $expected, got HTTP $($result.Status)"
  } elseif ($result.Location -notlike "*$expected*") {
    Write-Fail $label "expected a redirect to $expected, got $($result.Location)"
  } else {
    Write-Pass $label
  }
}

function Assert-Shows($label, $result, $needle) {
  if ($result.Status -ne 200) {
    Write-Fail $label "expected HTTP 200, got $($result.Status) $($result.Location)"
  } elseif ($result.Body -notlike "*$needle*") {
    Write-Fail $label "page did not contain '$needle'"
  } else {
    Write-Pass $label
  }
}

function Assert-Hides($label, $result, $needle) {
  if ($result.Body -like "*$needle*") {
    Write-Fail $label "page leaked '$needle'"
  } else {
    Write-Pass $label
  }
}

# --- run --------------------------------------------------------------------

Write-Host "`nChecking the dev server at $BaseUrl ..." -ForegroundColor Cyan
try {
  [void](Get-Route "/" $null)
} catch {
  Write-Host "No server responding at $BaseUrl. Start one with 'npm run dev' and re-run." -ForegroundColor Red
  exit 1
}

Write-Host "Signing in as each role..." -ForegroundColor Cyan
$seeker = (Get-AccessToken "selam.seeker@example.com" $Password).Cookie
$sme    = (Get-AccessToken "abeba.sme@example.com" $Password).Cookie
$admin  = (Get-AccessToken "sneaky.admin@example.com" $Password).Cookie

# If the cookie shape were wrong every signed-in check below would fail the
# same way, which reads like a routing bug rather than a harness bug. Prove the
# session is being read before asserting anything about routing.
$probe = Get-Route "/dashboard" $seeker
if ($probe.Status -ne 200) {
  Write-Host "`nThe session cookie was not accepted -- the server treated a signed-in request as anonymous." -ForegroundColor Red
  Write-Host "  cookie name  : $cookieName"
  Write-Host "  header bytes : $($seeker.Length)"
  Write-Host "  status       : $($probe.Status)"
  Write-Host "  location     : $($probe.Location)"
  Write-Host "First check $BaseUrl is this project and not a stale server on the same port." -ForegroundColor Yellow
  Write-Host "Otherwise it is a harness problem, not a routing failure -- verify the six cases by hand:" -ForegroundColor Yellow
  Write-Host "  1. Signed out, open /dashboard  -> bounced to /login?next=/dashboard"
  Write-Host "  2. Sign in as selam.seeker      -> job seeker dashboard, Sandbox and Coach cards"
  Write-Host "  3. As selam.seeker, open /admin -> bounced to /dashboard"
  Write-Host "  4. Sign in as abeba.sme         -> SME dashboard, Matcher and Company profile cards"
  Write-Host "  5. As abeba.sme, open /admin    -> bounced to /dashboard"
  Write-Host "  6. Sign in as sneaky.admin      -> lands on /admin, counters render"
  exit 1
}

Write-Host "`nSigned-out users cannot reach private routes" -ForegroundColor Cyan
Assert-RedirectsTo "anonymous /dashboard goes to login" (Get-Route "/dashboard" $null) "/login"
Assert-RedirectsTo "anonymous /admin goes to login" (Get-Route "/admin" $null) "/login"
Assert-Shows "anonymous landing page still renders" (Get-Route "/" $null) "Skill-Connect"

Write-Host "`nEach role lands on its own page" -ForegroundColor Cyan
Assert-Shows "job seeker sees the seeker dashboard" $probe "Walk-With-AI Sandbox"
Assert-Hides "job seeker dashboard hides SME tools" $probe "Role Skill Templates"

$smeDashboard = Get-Route "/dashboard" $sme
Assert-Shows "SME sees the SME dashboard" $smeDashboard "Role Skill Templates"
Assert-Hides "SME dashboard hides seeker tools" $smeDashboard "Walk-With-AI Sandbox"

Assert-RedirectsTo "admin visiting /dashboard is sent to the console" (Get-Route "/dashboard" $admin) "/admin"

Write-Host "`nOnly an admin reaches the console" -ForegroundColor Cyan
Assert-RedirectsTo "job seeker cannot open /admin" (Get-Route "/admin" $seeker) "/dashboard"
Assert-RedirectsTo "SME cannot open /admin" (Get-Route "/admin" $sme) "/dashboard"
Assert-Shows "admin opens the console" (Get-Route "/admin" $admin) "Admin console"

Write-Host ""
if ($script:failures -eq 0) {
  Write-Host "All routing checks passed." -ForegroundColor Green
  Write-Host "Still needs one human click: sign in, open /admin/promote, submit the invite code." -ForegroundColor Yellow
  exit 0
} else {
  Write-Host "$($script:failures) routing check(s) FAILED. This is a P0." -ForegroundColor Red
  exit 1
}
