$ErrorActionPreference = "Stop"

$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$stateFile = Join-Path (Join-Path $root ".dev") "processes.json"

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

Write-Host "Ports:"
foreach ($port in 3000, 5173, 6379, 9000, 9001) {
  $lines = netstat -ano | Select-String ":$port" | Select-String "LISTENING"
  if ($lines) {
    $owners = @()
    foreach ($line in $lines) {
      $parts = ($line.ToString() -split '\s+') | Where-Object { $_ -ne "" }
      if ($parts.Count -ge 5) {
        $owners += $parts[-1]
      }
    }
    $owners = ($owners | Select-Object -Unique) -join ","
    Write-Host " - ${port}: LISTEN (pid=$owners)" -ForegroundColor Green
  } else {
    Write-Host " - ${port}: DOWN" -ForegroundColor Yellow
  }
}

Write-Host ""
Write-Host "API /health:"
try {
  $health = Invoke-WebRequest -UseBasicParsing "http://localhost:3000/health" -TimeoutSec 5
  Write-Host " - status=$($health.StatusCode) body=$($health.Content)" -ForegroundColor Green
} catch {
  Write-Host " - unreachable" -ForegroundColor Red
}

Write-Host ""
Write-Host "Toolchain:"
if (Test-CmdOrPath "soffice" @(
  "C:\Program Files\LibreOffice\program\soffice.com",
  "C:\Program Files\LibreOffice\program\soffice.exe",
  "C:\Program Files (x86)\LibreOffice\program\soffice.com",
  "C:\Program Files (x86)\LibreOffice\program\soffice.exe"
)) {
  Write-Host " - soffice: OK" -ForegroundColor Green
} else {
  Write-Host " - soffice: MISSING (PDF/DOCX tools fail)" -ForegroundColor Yellow
}
if (Test-CmdOrPath "ffmpeg") {
  Write-Host " - ffmpeg: OK" -ForegroundColor Green
} else {
  Write-Host " - ffmpeg: MISSING" -ForegroundColor Yellow
}
if (Test-CmdOrPath "magick") {
  Write-Host " - magick: OK" -ForegroundColor Green
} else {
  Write-Host " - magick: MISSING" -ForegroundColor Yellow
}
if (Test-CmdOrPath "tesseract" @(
  "C:\Program Files\Tesseract-OCR\tesseract.exe",
  "C:\Program Files (x86)\Tesseract-OCR\tesseract.exe"
)) {
  Write-Host " - tesseract: OK" -ForegroundColor Green
} else {
  Write-Host " - tesseract: MISSING (OCR tools fail)" -ForegroundColor Yellow
}
if (Test-CmdOrPath "pdftoppm") {
  Write-Host " - pdftoppm: OK" -ForegroundColor Green
} else {
  Write-Host " - pdftoppm: MISSING (PDF->image tools fail)" -ForegroundColor Yellow
}
if (Test-CmdOrPath "ebook-convert" @(
  "C:\Program Files\Calibre2\ebook-convert.exe",
  "C:\Program Files (x86)\Calibre2\ebook-convert.exe"
)) {
  Write-Host " - ebook-convert: OK" -ForegroundColor Green
} else {
  Write-Host " - ebook-convert: MISSING (PDF<->EPUB/MOBI tools fail)" -ForegroundColor Yellow
}
if (Test-CmdOrPath "7z" @(
  "C:\Program Files\7-Zip\7z.exe",
  "C:\Program Files (x86)\7-Zip\7z.exe"
)) {
  Write-Host " - 7z: OK" -ForegroundColor Green
} else {
  Write-Host " - 7z: MISSING (archive tools fail)" -ForegroundColor Yellow
}

if (Test-Path $stateFile) {
  Write-Host ""
  Write-Host "Managed processes (.dev/processes.json):"
  try {
    $state = Get-Content $stateFile -Raw | ConvertFrom-Json
    foreach ($svc in $state.services) {
      $alive = Get-Process -Id ([int]$svc.pid) -ErrorAction SilentlyContinue
      if ($alive) {
        Write-Host " - $($svc.name): pid=$($svc.pid) alive" -ForegroundColor Green
      } else {
        Write-Host " - $($svc.name): pid=$($svc.pid) stale" -ForegroundColor Yellow
      }
    }
  } catch {}
}
