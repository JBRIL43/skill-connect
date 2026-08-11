# Runs a SQL statement against the linked Supabase project via the Management API.
#
#   .\scripts\run-sql.ps1 -Query "select count(*) from public.profiles;"
#   .\scripts\run-sql.ps1 -File .\supabase\tests\rls_checks.sql
#
# Reads SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_REF from the environment, or
# from .env.local when they are not already set.

param(
  [string]$Query,
  [string]$File
)

$ErrorActionPreference = "Stop"

if (-not $env:SUPABASE_ACCESS_TOKEN -or -not $env:SUPABASE_PROJECT_REF) {
  if (Test-Path .env.local) {
    Get-Content .env.local |
      Where-Object { $_ -match '^\s*[A-Z_]+=.+' } |
      ForEach-Object {
        $name, $value = $_ -split '=', 2
        Set-Item -Path "env:$($name.Trim())" -Value $value.Trim()
      }
  }
}

if (-not $env:SUPABASE_ACCESS_TOKEN) { throw "SUPABASE_ACCESS_TOKEN is not set." }
if (-not $env:SUPABASE_PROJECT_REF) { throw "SUPABASE_PROJECT_REF is not set." }

if ($File) { $Query = Get-Content $File -Raw }
if (-not $Query) { throw "Pass either -Query or -File." }

$body = @{ query = $Query } | ConvertTo-Json -Depth 3 -Compress

$response = Invoke-RestMethod `
  -Method Post `
  -Uri "https://api.supabase.com/v1/projects/$($env:SUPABASE_PROJECT_REF)/database/query" `
  -Headers @{ Authorization = "Bearer $($env:SUPABASE_ACCESS_TOKEN)" } `
  -ContentType "application/json" `
  -Body $body

$response | ConvertTo-Json -Depth 6
