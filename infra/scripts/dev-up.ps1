param(
  [switch]$WithFrontend
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$stateDir = Join-Path $root ".dev"
$logsDir = Join-Path $root "logs"
$apiDir = Join-Path $root "api"
$workerDir = Join-Path $root "worker"
$frontendDir = Join-Path $root "frontend"
$stateFile = Join-Path $stateDir "processes.json"

New-Item -ItemType Directory -Force -Path $stateDir | Out-Null
New-Item -ItemType Directory -Force -Path $logsDir | Out-Null

function Stop-ByPort([int]$Port) {
  try {
    $pids = Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue |
      Select-Object -ExpandProperty OwningProcess -Unique
    foreach ($procId in $pids) {
      if ($procId) {
        Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
      }
    }
  } catch {}
}

function Test-CmdOrPath([string]$CommandName, [string[]]$KnownPaths = @()) {
  if (Get-Command $CommandName -ErrorAction SilentlyContinue) {
    return $true
  }
  foreach ($candidate in $KnownPaths) {
    if ($candidate -and (Test-Path $candidate)) {
      return $true
    }
  }
  return $false
}

function Start-ServiceProc(
  [string]$Name,
  [string]$Workdir,
  [string]$Arguments,
  [string]$OutLog,
  [string]$ErrLog
) {
  if (Test-Path $OutLog) { Remove-Item $OutLog -Force }
  if (Test-Path $ErrLog) { Remove-Item $ErrLog -Force }
  $p = Start-Process -FilePath "npm.cmd" -ArgumentList $Arguments -WorkingDirectory $Workdir `
    -RedirectStandardOutput $OutLog -RedirectStandardError $ErrLog -PassThru
  return [PSCustomObject]@{
    name = $Name
    pid = $p.Id
    outLog = $OutLog
    errLog = $ErrLog
  }
}

Write-Host "==> Bringing up docker dependencies (redis/minio/minio-init)..."
Push-Location $root
docker compose up -d redis minio minio-init | Out-Null
$dockerExit = $LASTEXITCODE
Pop-Location
if ($dockerExit -ne 0) {
  Write-Host "WARNING: docker compose failed. Continuing with host services only." -ForegroundColor Yellow
}

Write-Host "==> Cleaning stale listeners on API/Frontend ports..."
Stop-ByPort 3000
if ($WithFrontend) {
  Stop-ByPort 5173
}

$services = @()

Write-Host "==> Starting API..."
$services += Start-ServiceProc `
  -Name "api" `
  -Workdir $apiDir `
  -Arguments "run start" `
  -OutLog (Join-Path $logsDir "api.out.log") `
  -ErrLog (Join-Path $logsDir "api.err.log")

Write-Host "==> Starting Worker..."
$services += Start-ServiceProc `
  -Name "worker" `
  -Workdir $workerDir `
  -Arguments "run start" `
  -OutLog (Join-Path $logsDir "worker.out.log") `
  -ErrLog (Join-Path $logsDir "worker.err.log")

if ($WithFrontend) {
  Write-Host "==> Starting Frontend..."
  $services += Start-ServiceProc `
    -Name "frontend" `
    -Workdir $frontendDir `
    -Arguments "run dev -- --host localhost --port 5173" `
    -OutLog (Join-Path $logsDir "frontend.out.log") `
    -ErrLog (Join-Path $logsDir "frontend.err.log")
}

Start-Sleep -Seconds 2

$health = $null
try {
  $health = Invoke-WebRequest -UseBasicParsing "http://localhost:3000/health" -TimeoutSec 5
} catch {
  $health = $null
}

$sofficeExists = Test-CmdOrPath "soffice" @(
  "C:\Program Files\LibreOffice\program\soffice.com",
  "C:\Program Files\LibreOffice\program\soffice.exe",
  "C:\Program Files (x86)\LibreOffice\program\soffice.com",
  "C:\Program Files (x86)\LibreOffice\program\soffice.exe"
)
$tesseractExists = Test-CmdOrPath "tesseract" @(
  "C:\Program Files\Tesseract-OCR\tesseract.exe",
  "C:\Program Files (x86)\Tesseract-OCR\tesseract.exe"
)

$state = [PSCustomObject]@{
  startedAt = (Get-Date).ToString("s")
  services = $services
  healthOk = [bool]($health -and $health.StatusCode -eq 200)
  sofficeInstalled = $sofficeExists
  tesseractInstalled = $tesseractExists
}
$state | ConvertTo-Json -Depth 6 | Set-Content $stateFile -Encoding UTF8

Write-Host ""
Write-Host "==> Dev stack started"
Write-Host "API health: " -NoNewline
if ($state.healthOk) { Write-Host "OK" -ForegroundColor Green } else { Write-Host "FAILED" -ForegroundColor Red }
Write-Host "Soffice installed: " -NoNewline
if ($state.sofficeInstalled) { Write-Host "YES" -ForegroundColor Green } else { Write-Host "NO (PDF/DOCX tools will fail)" -ForegroundColor Yellow }
Write-Host "Tesseract installed: " -NoNewline
if ($state.tesseractInstalled) { Write-Host "YES" -ForegroundColor Green } else { Write-Host "NO (OCR tools will fail)" -ForegroundColor Yellow }
Write-Host ""
Write-Host "Logs:"
$services | ForEach-Object { Write-Host " - $($_.name): $($_.outLog) / $($_.errLog)" }
Write-Host ""
Write-Host "Run status check: powershell -ExecutionPolicy Bypass -File infra/scripts/dev-status.ps1"
Write-Host "Run stop:         powershell -ExecutionPolicy Bypass -File infra/scripts/dev-down.ps1"
