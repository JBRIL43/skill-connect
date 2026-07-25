# Shared helpers for the PowerShell test scripts. Dot-source it:
#
#   . "$PSScriptRoot\_shared.ps1"
#
# Not meant to be run on its own.

Add-Type -AssemblyName System.Net.Http

function Import-DotEnv {
  param([string]$Path = ".env.local")

  if (-not (Test-Path $Path)) { return }

  Get-Content $Path |
    Where-Object { $_ -match '^\s*[A-Z_]+=.+' } |
    ForEach-Object {
      $name, $value = $_ -split '=', 2
      Set-Item -Path "env:$($name.Trim())" -Value $value.Trim()
    }
}

# supabase-js namespaces the session by project ref, taken from the hostname:
# sb-<ref>-auth-token. Same derivation as SupabaseClient's defaultStorageKey.
function Get-AuthCookieName {
  $ref = ([Uri]$env:NEXT_PUBLIC_SUPABASE_URL).Host.Split(".")[0]
  return "sb-$ref-auth-token"
}

# @supabase/ssr writes the session as "base64-" + base64url(JSON), splitting
# anything over MAX_CHUNK_SIZE across <name>.0, <name>.1 and rejoining on read.
# The alphabet is URL-safe, so the header never needs percent-encoding.
function New-SessionCookieHeader {
  param([string]$SessionJson)

  $maxChunk = 3180
  $name = Get-AuthCookieName
  $bytes = [Text.Encoding]::UTF8.GetBytes($SessionJson)
  $value = "base64-" + [Convert]::ToBase64String($bytes).TrimEnd("=").Replace("+", "-").Replace("/", "_")

  if ($value.Length -le $maxChunk) { return "$name=$value" }

  $pairs = @()
  $index = 0
  for ($offset = 0; $offset -lt $value.Length; $offset += $maxChunk) {
    $length = [Math]::Min($maxChunk, $value.Length - $offset)
    $pairs += "$name.$index=" + $value.Substring($offset, $length)
    $index++
  }
  return ($pairs -join "; ")
}

function Get-AccessToken {
  param([string]$Email, [string]$Password = "Test1234!")

  $body = @{ email = $Email; password = $Password } | ConvertTo-Json
  $res = Invoke-WebRequest -UseBasicParsing -Method Post `
    -Uri "$($env:NEXT_PUBLIC_SUPABASE_URL)/auth/v1/token?grant_type=password" `
    -Headers @{ apikey = $env:NEXT_PUBLIC_SUPABASE_ANON_KEY } `
    -ContentType "application/json" -Body $body

  $session = $res.Content | ConvertFrom-Json

  return [PSCustomObject]@{
    Json   = $res.Content
    Cookie = New-SessionCookieHeader $res.Content
    Token  = $session.access_token
    # Look users up by this, never by full_name -- seed personas and test
    # accounts can share a name.
    UserId = $session.user.id
  }
}

function Get-ServiceHeaders {
  return @{
    apikey        = $env:SUPABASE_SERVICE_ROLE_KEY
    Authorization = "Bearer $($env:SUPABASE_SERVICE_ROLE_KEY)"
  }
}

function New-NoRedirectClient {
  $handler = New-Object System.Net.Http.HttpClientHandler
  $handler.AllowAutoRedirect = $false
  $handler.UseCookies = $false
  $client = New-Object System.Net.Http.HttpClient($handler)
  # The dev server compiles a route on first hit, which can take a while.
  $client.Timeout = [TimeSpan]::FromSeconds(120)
  return $client
}
