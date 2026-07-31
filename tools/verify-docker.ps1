param(
  [string]$EnvFile = ".env.docker",
  [int]$FrontendPort = 8080,
  [int]$BackendPort = 4000,
  [switch]$SkipBuild,
  [switch]$SkipImageScan
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  throw "Docker CLI is not installed or is not available in PATH."
}

if (-not (Test-Path -LiteralPath $EnvFile)) {
  throw "Missing $EnvFile. Create it from .env.docker.example and set strong secrets."
}

function Invoke-Compose {
  $composeArguments = $args
  & docker compose --env-file $EnvFile @composeArguments
  if ($LASTEXITCODE -ne 0) {
    throw "docker compose $($composeArguments -join ' ') failed with exit code $LASTEXITCODE."
  }
}

function Wait-Http {
  param(
    [string]$Url,
    [int]$TimeoutSeconds = 180
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  do {
    try {
      $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 5
      if ($response.StatusCode -eq 200) {
        return
      }
    } catch {
      Start-Sleep -Seconds 3
    }
  } while ((Get-Date) -lt $deadline)

  throw "Timed out waiting for $Url."
}

Write-Host "Validating Compose configuration..."
Invoke-Compose config --quiet

if (-not $SkipBuild) {
  Write-Host "Building clean images..."
  Invoke-Compose build --pull
}

Write-Host "Starting stack..."
Invoke-Compose up -d

$frontendUrl = "http://127.0.0.1:$FrontendPort"
$backendUrl = "http://127.0.0.1:$BackendPort/api/health"
Wait-Http "$frontendUrl/api/health"
Wait-Http $backendUrl
Wait-Http $frontendUrl

Write-Host "Checking non-root backend..."
$backendUid = (& docker compose --env-file $EnvFile exec -T backend id -u).Trim()
if ($LASTEXITCODE -ne 0 -or $backendUid -eq "0") {
  throw "Backend container must run as a non-root user."
}

Write-Host "Checking migration ledger..."
$postgresUser = (
  & docker compose --env-file $EnvFile exec -T postgres printenv POSTGRES_USER
).Trim()
$postgresDatabase = (
  & docker compose --env-file $EnvFile exec -T postgres printenv POSTGRES_DB
).Trim()
if (
  $LASTEXITCODE -ne 0 -or
  [string]::IsNullOrWhiteSpace($postgresUser) -or
  [string]::IsNullOrWhiteSpace($postgresDatabase)
) {
  throw "Could not read PostgreSQL connection settings from the container."
}

$migrationCount = (
  & docker compose --env-file $EnvFile exec -T postgres psql `
    -U $postgresUser `
    -d $postgresDatabase `
    -tAc "SELECT COUNT(*) FROM schema_migrations;"
).Trim()
$parsedMigrationCount = 0
if (
  $LASTEXITCODE -ne 0 -or
  -not [int]::TryParse($migrationCount, [ref]$parsedMigrationCount) -or
  $parsedMigrationCount -le 0
) {
  throw "Could not verify PostgreSQL migration ledger."
}

Write-Host "Checking database volume persistence..."
Invoke-Compose restart postgres
$postgresDeadline = (Get-Date).AddSeconds(120)
do {
  & docker compose --env-file $EnvFile exec -T postgres `
    pg_isready -U $postgresUser -d $postgresDatabase *> $null
  if ($LASTEXITCODE -eq 0) {
    break
  }
  Start-Sleep -Seconds 2
} while ((Get-Date) -lt $postgresDeadline)
if ($LASTEXITCODE -ne 0) {
  throw "PostgreSQL did not become ready after restart."
}

$persistedMigrationCount = (
  & docker compose --env-file $EnvFile exec -T postgres psql `
    -U $postgresUser `
    -d $postgresDatabase `
    -tAc "SELECT COUNT(*) FROM schema_migrations;"
).Trim()
if (
  $LASTEXITCODE -ne 0 -or
  $persistedMigrationCount -ne $migrationCount
) {
  throw "Database migration ledger did not survive PostgreSQL restart."
}
Wait-Http $backendUrl

Write-Host "Checking upload volume persistence..."
Invoke-Compose exec -T backend touch uploads/.docker-persistence-check
Invoke-Compose restart backend
Wait-Http $backendUrl
& docker compose --env-file $EnvFile exec -T backend test `
  -f uploads/.docker-persistence-check
if ($LASTEXITCODE -ne 0) {
  throw "Public upload volume did not survive backend restart."
}
Invoke-Compose exec -T backend rm -f uploads/.docker-persistence-check

if (-not $SkipImageScan) {
  if (-not (Get-Command trivy -ErrorAction SilentlyContinue)) {
    throw "Trivy is required for the image scan. Install it or rerun with -SkipImageScan for local-only verification."
  }

  function Invoke-TrivyImageScan {
    param([Parameter(Mandatory = $true)][string]$Image)

    $reportPath = Join-Path `
      ([System.IO.Path]::GetTempPath()) `
      "thpt-pct-pt-trivy-$([Guid]::NewGuid().ToString('N')).json"

    try {
      & trivy image `
        --scanners vuln `
        --severity HIGH,CRITICAL `
        --exit-code 1 `
        --quiet `
        --format json `
        --output $reportPath `
        $Image
      if ($LASTEXITCODE -ne 0) {
        & trivy image `
          --scanners vuln `
          --severity HIGH,CRITICAL `
          --format table `
          $Image
        throw "$Image scan failed."
      }

      Write-Host "$Image scan passed."
    } finally {
      if (Test-Path -LiteralPath $reportPath) {
        Remove-Item -LiteralPath $reportPath -Force
      }
    }
  }

  Write-Host "Scanning images for HIGH/CRITICAL vulnerabilities..."
  Invoke-TrivyImageScan "thpt-pct-pt-backend"
  Invoke-TrivyImageScan "thpt-pct-pt-frontend"
  Invoke-TrivyImageScan "thpt-pct-pt-postgres:18.4"
}

Write-Host "Docker verification passed."
