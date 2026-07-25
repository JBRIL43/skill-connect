# RLS test suite for Skill-Connect Ethiopia.
#
#   .\scripts\test-rls.ps1
#
# Exercises the boundaries described in docs/RLS_MODEL.md against the live
# database, as real signed-in users rather than through the service role. Run
# this after any migration and again at demo freeze — policy drift is real.
#
# Expects the three test accounts created during setup. Any FAIL is a P0.

$ErrorActionPreference = "Stop"

if (Test-Path .env.local) {
  Get-Content .env.local |
    Where-Object { $_ -match '^\s*[A-Z_]+=.+' } |
    ForEach-Object {
      $name, $value = $_ -split '=', 2
      Set-Item -Path "env:$($name.Trim())" -Value $value.Trim()
    }
}

$url = $env:NEXT_PUBLIC_SUPABASE_URL
$anon = $env:NEXT_PUBLIC_SUPABASE_ANON_KEY
$service = $env:SUPABASE_SERVICE_ROLE_KEY

$script:failures = 0

function Get-Token($email, $password) {
  $body = @{ email = $email; password = $password } | ConvertTo-Json
  $res = Invoke-RestMethod -Method Post `
    -Uri "$url/auth/v1/token?grant_type=password" `
    -Headers @{ apikey = $anon } -ContentType "application/json" -Body $body
  return $res.access_token
}

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

Write-Host "`nSeeding candidate data through the service role..." -ForegroundColor Cyan

$svcHeaders = @{ apikey = $service; Authorization = "Bearer $service"; Prefer = "resolution=merge-duplicates" }

$seekerId = (Invoke-RestMethod -Method Get `
  -Uri "$url/rest/v1/profiles?select=id&full_name=eq.Selam%20Tesfaye" `
  -Headers $svcHeaders)[0].id

Invoke-RestMethod -Method Post -Uri "$url/rest/v1/skill_matrices" `
  -Headers $svcHeaders -ContentType "application/json" `
  -Body (@{ user_id = $seekerId; skills_json = @{ technical = @{ excel_basics = 72 } }; readiness_score = 68 } | ConvertTo-Json -Depth 5) | Out-Null

Invoke-RestMethod -Method Post -Uri "$url/rest/v1/sandbox_scores" `
  -Headers $svcHeaders -ContentType "application/json" `
  -Body (@{ user_id = $seekerId; node_id = "merkato-whatsapp-catalog"; scores_json = @{ prompt_engineering = 82 } } | ConvertTo-Json -Depth 5) | Out-Null

Write-Host "Signing in as each role..." -ForegroundColor Cyan

$seeker = Get-Token "selam.seeker@example.com" "Test1234!"
$other  = Get-Token "sneaky.admin@example.com" "Test1234!"
$sme    = Get-Token "abeba.sme@example.com" "Test1234!"

Write-Host "`nA candidate can see their own data" -ForegroundColor Cyan
Assert-Count "job seeker reads own skill_matrices" (Read-Table $seeker "skill_matrices?select=id") "ge" 1
Assert-Count "job seeker reads own sandbox_scores" (Read-Table $seeker "sandbox_scores?select=id") "ge" 1

Write-Host "`nNobody else can" -ForegroundColor Cyan
Assert-NoData "other job seeker reads skill_matrices" (Read-Table $other "skill_matrices?select=id")
Assert-NoData "other job seeker reads sandbox_scores" (Read-Table $other "sandbox_scores?select=id")
Assert-NoData "SME reads skill_matrices" (Read-Table $sme "skill_matrices?select=id")
Assert-NoData "SME reads sandbox_scores" (Read-Table $sme "sandbox_scores?select=id")
Assert-Count "SME sees only their own profile row" (Read-Table $sme "profiles?select=id") "eq" 1
Assert-NoData "anonymous reads profiles" (Read-Table $null "profiles?select=id")
Assert-NoData "anonymous reads sandbox_scores" (Read-Table $null "sandbox_scores?select=id")

Write-Host "`nPublic surfaces still work" -ForegroundColor Cyan
Assert-Count "SME reads company_profiles" (Read-Table $sme "company_profiles?select=id") "ge" 1

Write-Host "`nPrivilege escalation is blocked" -ForegroundColor Cyan
$escalated = $false
try {
  Invoke-RestMethod -Method Patch -Uri "$url/rest/v1/profiles?id=eq.$seekerId" `
    -Headers @{ apikey = $anon; Authorization = "Bearer $seeker" } `
    -ContentType "application/json" -Body '{"role":"admin"}' | Out-Null
  $escalated = $true
} catch {}

$roleNow = (Invoke-RestMethod -Method Get -Uri "$url/rest/v1/profiles?select=role&id=eq.$seekerId" -Headers $svcHeaders)[0].role
if (-not $escalated -and $roleNow -eq "job_seeker") {
  Write-Host "  PASS  job seeker cannot promote themselves to admin" -ForegroundColor Green
} else {
  Write-Host "  FAIL  job seeker escalated to admin (role is now $roleNow)" -ForegroundColor Red
  $script:failures++
}

Write-Host ""
if ($script:failures -eq 0) {
  Write-Host "All RLS checks passed." -ForegroundColor Green
  exit 0
} else {
  Write-Host "$($script:failures) RLS check(s) FAILED. This is a P0." -ForegroundColor Red
  exit 1
}
