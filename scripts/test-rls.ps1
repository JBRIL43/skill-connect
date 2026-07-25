# RLS test suite for Skill-Connect Ethiopia.
#
#   .\scripts\test-rls.ps1
#
# Exercises the boundaries described in docs/RLS_MODEL.md against the live
# database, as real signed-in users rather than through the service role. Run
# this after any migration and again at demo freeze - policy drift is real.
#
# Expects the three test accounts created during setup. Any FAIL is a P0.

$ErrorActionPreference = "Stop"
. "$PSScriptRoot\_shared.ps1"

Import-DotEnv

$url = $env:NEXT_PUBLIC_SUPABASE_URL
$anon = $env:NEXT_PUBLIC_SUPABASE_ANON_KEY
$service = $env:SUPABASE_SERVICE_ROLE_KEY

$script:failures = 0

function Read-Table($token, $path) {
  $headers = @{ apikey = $anon }
  if ($token) { $headers.Authorization = "Bearer $token" }
  try {
    $rows = Invoke-RestMethod -Method Get -Uri "$url/rest/v1/$path" -Headers $headers
    return @($rows).Count
  } catch {
    return -1  # denied outright rather than filtered to empty
  }
}

# A deny can surface either as zero rows (RLS filtered them) or as an error
# (the request was rejected before it got that far). Both are acceptable.
function Assert-NoData($label, $actual) {
  if ($actual -le 0) {
    Write-Host ("  PASS  {0}" -f $label) -ForegroundColor Green
  } else {
    Write-Host ("  FAIL  {0} (leaked {1} row(s))" -f $label, $actual) -ForegroundColor Red
    $script:failures++
  }
}

function Assert-Count($label, $actual, $comparison, $expected) {
  $ok = switch ($comparison) {
    "eq" { $actual -eq $expected }
    "ge" { $actual -ge $expected }
  }
  if ($ok) {
    Write-Host ("  PASS  {0}" -f $label) -ForegroundColor Green
  } else {
    Write-Host ("  FAIL  {0} (got {1}, expected {2} {3})" -f $label, $actual, $comparison, $expected) -ForegroundColor Red
    $script:failures++
  }
}

$svcHeaders = @{ apikey = $service; Authorization = "Bearer $service" }

# The suite owns this account rather than borrowing one of the demo logins, so
# that promoting or deleting a demo account cannot quietly weaken the tests.
function Confirm-FixtureSeeker($email) {
  try {
    Invoke-RestMethod -Method Post -Uri "$url/auth/v1/admin/users" `
      -Headers $svcHeaders -ContentType "application/json" `
      -Body (@{
        email         = $email
        password      = "Test1234!"
        email_confirm = $true
        user_metadata = @{ role = "job_seeker"; full_name = "RLS Fixture Seeker" }
      } | ConvertTo-Json) | Out-Null
  } catch {
    # Already exists, which is the normal case after the first run.
  }
  return Get-AccessToken $email "Test1234!"
}

Write-Host "Signing in as each role..." -ForegroundColor Cyan

# Identify accounts by the id the auth server returns, not by full_name -- the
# demo seed contains a persona with the same display name.
$seekerAuth = Get-AccessToken "selam.seeker@example.com" "Test1234!"
$smeAuth    = Get-AccessToken "abeba.sme@example.com" "Test1234!"
$adminAuth  = Get-AccessToken "sneaky.admin@example.com" "Test1234!"
$otherAuth  = Confirm-FixtureSeeker "rls-fixture-seeker@example.com"

$seeker = $seekerAuth.Token
$other  = $otherAuth.Token
$sme    = $smeAuth.Token
$seekerId = $seekerAuth.UserId
$smeId    = $smeAuth.UserId
# Any profile that is not the test SME stands in for "a different company".
$otherPartyId = $adminAuth.UserId

Write-Host "`nSeeding candidate data through the service role..." -ForegroundColor Cyan

$mergeHeaders = $svcHeaders + @{ Prefer = "resolution=merge-duplicates" }

Invoke-RestMethod -Method Post -Uri "$url/rest/v1/skill_matrices" `
  -Headers $mergeHeaders -ContentType "application/json" `
  -Body (@{ user_id = $seekerId; skills_json = @{ technical = @{ excel_basics = 72 } }; readiness_score = 68 } | ConvertTo-Json -Depth 5) | Out-Null

Invoke-RestMethod -Method Post -Uri "$url/rest/v1/sandbox_scores" `
  -Headers $mergeHeaders -ContentType "application/json" `
  -Body (@{ user_id = $seekerId; node_id = "merkato-whatsapp-catalog"; scores_json = @{ prompt_engineering = 82 } } | ConvertTo-Json -Depth 5) | Out-Null

Write-Host "`nA candidate can see their own data" -ForegroundColor Cyan
Assert-Count "job seeker reads own skill_matrices" (Read-Table $seeker "skill_matrices?select=id") "ge" 1
Assert-Count "job seeker reads own sandbox_scores" (Read-Table $seeker "sandbox_scores?select=id") "ge" 1

Write-Host "`nNobody else can" -ForegroundColor Cyan
Assert-NoData "another job seeker reads skill_matrices" (Read-Table $other "skill_matrices?select=id")
Assert-NoData "another job seeker reads sandbox_scores" (Read-Table $other "sandbox_scores?select=id")
Assert-NoData "SME reads skill_matrices" (Read-Table $sme "skill_matrices?select=id")
Assert-NoData "SME reads sandbox_scores" (Read-Table $sme "sandbox_scores?select=id")
Assert-Count "SME sees only their own profile row" (Read-Table $sme "profiles?select=id") "eq" 1
Assert-NoData "anonymous reads profiles" (Read-Table $null "profiles?select=id")
Assert-NoData "anonymous reads sandbox_scores" (Read-Table $null "sandbox_scores?select=id")

Write-Host "`nPublic surfaces still work" -ForegroundColor Cyan
Assert-Count "SME reads company_profiles" (Read-Table $sme "company_profiles?select=id") "ge" 1

# ---------------------------------------------------------------------------
# Fixtures for the three boundaries the checks above cannot reach: a handover
# brief the outgoing employee has not reviewed, and another company's
# notifications and payments.
# ---------------------------------------------------------------------------

function New-Row($table, $body) {
  return (Invoke-RestMethod -Method Post -Uri "$url/rest/v1/$table" `
    -Headers ($svcHeaders + @{ Prefer = "return=representation" }) `
    -ContentType "application/json" -Body ($body | ConvertTo-Json -Depth 6))[0]
}

$posting = New-Row "sme_postings" @{
  sme_id             = $smeId
  description        = "RLS fixture - transition role"
  is_transition_role = $true
}

$brief = New-Row "continuity_briefs" @{
  posting_id           = $posting.id
  generated_brief      = "Names a client the outgoing employee has not redacted yet."
  reviewed_by_employee = $false
}

$theirNotification = New-Row "notifications" @{
  sme_id       = $otherPartyId
  template_id  = (New-Row "role_skill_templates" @{
    sme_id          = $otherPartyId
    role_name       = "RLS fixture - other company template"
    thresholds_json = @{ excel_basics = 70 }
  }).id
  candidate_id = $seekerId
}

$theirPayment = New-Row "payments" @{
  sme_id   = $otherPartyId
  provider = "mock"
  amount   = 500
  status   = "pending"
}

try {
  Write-Host "`nAn unreviewed handover brief is invisible, even to the SME who owns it" -ForegroundColor Cyan
  Assert-NoData "SME reads unreviewed continuity_brief" (Read-Table $sme "continuity_briefs?select=id&id=eq.$($brief.id)")

  Invoke-RestMethod -Method Patch -Uri "$url/rest/v1/continuity_briefs?id=eq.$($brief.id)" `
    -Headers $svcHeaders -ContentType "application/json" -Body '{"reviewed_by_employee":true}' | Out-Null

  Assert-Count "SME reads it once the employee has reviewed it" (Read-Table $sme "continuity_briefs?select=id&id=eq.$($brief.id)") "eq" 1

  Write-Host "`nOne company cannot see another's activity" -ForegroundColor Cyan
  Assert-NoData "SME reads another company's notifications" (Read-Table $sme "notifications?select=id&id=eq.$($theirNotification.id)")
  Assert-NoData "SME reads another company's payments" (Read-Table $sme "payments?select=id&id=eq.$($theirPayment.id)")
  Assert-NoData "job seeker reads notifications about themselves" (Read-Table $seeker "notifications?select=id&candidate_id=eq.$seekerId")
  Assert-NoData "anonymous reads payments" (Read-Table $null "payments?select=id")

  Write-Host "`nPrivilege escalation is blocked" -ForegroundColor Cyan
$escalated = $false
try {
  Invoke-RestMethod -Method Patch -Uri "$url/rest/v1/profiles?id=eq.$seekerId" `
    -Headers @{ apikey = $anon; Authorization = "Bearer $seeker" } `
    -ContentType "application/json" -Body '{"role":"admin"}' | Out-Null
  $escalated = $true
} catch {}

  $roleNow = (Invoke-RestMethod -Method Get -Uri "$url/rest/v1/profiles?select=role,id&id=eq.$seekerId" -Headers $svcHeaders)[0].role
  if (-not $escalated -and $roleNow -eq "job_seeker") {
    Write-Host "  PASS  job seeker cannot promote themselves to admin" -ForegroundColor Green
  } else {
    Write-Host "  FAIL  job seeker escalated to admin (role is now $roleNow)" -ForegroundColor Red
    $script:failures++
  }
}
finally {
  Write-Host "`nRemoving fixtures..." -ForegroundColor Cyan
  Invoke-RestMethod -Method Delete -Uri "$url/rest/v1/payments?id=eq.$($theirPayment.id)" -Headers $svcHeaders | Out-Null
  Invoke-RestMethod -Method Delete -Uri "$url/rest/v1/notifications?id=eq.$($theirNotification.id)" -Headers $svcHeaders | Out-Null
  Invoke-RestMethod -Method Delete -Uri "$url/rest/v1/role_skill_templates?id=eq.$($theirNotification.template_id)" -Headers $svcHeaders | Out-Null
  # The brief goes with the posting via on delete cascade.
  Invoke-RestMethod -Method Delete -Uri "$url/rest/v1/sme_postings?id=eq.$($posting.id)" -Headers $svcHeaders | Out-Null
}

Write-Host ""
if ($script:failures -eq 0) {
  Write-Host "All RLS checks passed." -ForegroundColor Green
  exit 0
} else {
  Write-Host "$($script:failures) RLS check(s) FAILED. This is a P0." -ForegroundColor Red
  exit 1
}
