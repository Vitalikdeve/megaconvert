param(
  [switch]$InstallMissing,
  [switch]$EnableRusOcr = $true
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$isWin = $PSVersionTable.Platform -eq $null -or $PSVersionTable.Platform -eq "Win32NT"

function Test-Tool {
  param(
    [Parameter(Mandatory = $true)][string]$CommandName,
    [string[]]$KnownPaths = @()
  )

  $found = Get-Command $CommandName -ErrorAction SilentlyContinue
  if ($found) {
    return [PSCustomObject]@{
      ok = $true
      source = "PATH"
      path = $found.Source
    }
  }

  foreach ($p in $KnownPaths) {
    if ($p -and (Test-Path $p)) {
      return [PSCustomObject]@{
        ok = $true
        source = "KnownPath"
        path = $p
      }
    }
  }

  return [PSCustomObject]@{
    ok = $false
    source = "missing"
    path = $null
  }
}

function Ensure-Winget {
  $winget = Get-Command winget -ErrorAction SilentlyContinue
  if (-not $winget) {
    throw "winget is not available on this host"
  }
}

function Install-WithWinget {
  param(
    [Parameter(Mandatory = $true)][string]$PackageId,
    [Parameter(Mandatory = $true)][string]$Label
  )

  Write-Host " -> Installing $Label ($PackageId)..." -ForegroundColor Cyan
  & winget install --id $PackageId --exact --silent --accept-package-agreements --accept-source-agreements
}

function Add-RussianTesseractData {
  $localRus = Join-Path $root "tessdata\\rus.traineddata"
  if (-not (Test-Path $localRus)) {
    Write-Host " - rus.traineddata not found in repo, skipping OCR language copy" -ForegroundColor Yellow
    return
  }

  $targets = @(
    "C:\\Program Files\\Tesseract-OCR\\tessdata\\rus.traineddata",
    "C:\\Program Files (x86)\\Tesseract-OCR\\tessdata\\rus.traineddata"
  )

  foreach ($target in $targets) {
    $dir = Split-Path -Parent $target
    if (Test-Path $dir) {
      if (Test-Path $target) {
        Write-Host " - rus.traineddata already present in $target" -ForegroundColor Green
        return
      }
      try {
        Copy-Item -Path $localRus -Destination $target -Force
        Write-Host " - Copied rus.traineddata to $target" -ForegroundColor Green
      } catch {
        Write-Host (" - Failed to copy rus.traineddata to {0}: {1}" -f $target, $_.Exception.Message) -ForegroundColor Yellow
      }
      return
    }
  }

  Write-Host " - Tesseract tessdata directory not found, skipping rus.traineddata copy" -ForegroundColor Yellow
}

$requirements = @(
  @{
    key = "soffice"
    label = "LibreOffice (soffice)"
    command = "soffice"
    package = "TheDocumentFoundation.LibreOffice"
    paths = @(
      "C:\\Program Files\\LibreOffice\\program\\soffice.com",
      "C:\\Program Files\\LibreOffice\\program\\soffice.exe",
      "C:\\Program Files (x86)\\LibreOffice\\program\\soffice.com",
      "C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe"
    )
  },
  @{
    key = "tesseract"
    label = "Tesseract OCR"
    command = "tesseract"
    package = "tesseract-ocr.tesseract"
    paths = @(
      "C:\\Program Files\\Tesseract-OCR\\tesseract.exe",
      "C:\\Program Files (x86)\\Tesseract-OCR\\tesseract.exe"
    )
  },
  @{
    key = "ffmpeg"
    label = "FFmpeg"
    command = "ffmpeg"
    package = "Gyan.FFmpeg"
    paths = @()
  },
  @{
    key = "magick"
    label = "ImageMagick"
    command = "magick"
    package = "ImageMagick.ImageMagick"
    paths = @()
  },
  @{
    key = "7z"
    label = "7-Zip"
    command = "7z"
    package = "7zip.7zip"
    paths = @(
      "C:\\Program Files\\7-Zip\\7z.exe",
      "C:\\Program Files (x86)\\7-Zip\\7z.exe"
    )
  },
  @{
    key = "pdftoppm"
    label = "Poppler"
    command = "pdftoppm"
    package = "oschwartz10612.Poppler"
    paths = @()
  },
  @{
    key = "ebook-convert"
    label = "Calibre (ebook-convert)"
    command = "ebook-convert"
    package = "calibre.calibre"
    paths = @(
      "C:\\Program Files\\Calibre2\\ebook-convert.exe",
      "C:\\Program Files (x86)\\Calibre2\\ebook-convert.exe"
    )
  },
  @{
    key = "gswin64c"
    label = "Ghostscript"
    command = "gswin64c"
    package = "ArtifexSoftware.GhostScript"
    paths = @(
      "C:\\Program Files\\gs\\gs10.06.0\\bin\\gswin64c.exe",
      "C:\\Program Files\\gs\\gs10.05.1\\bin\\gswin64c.exe",
      "C:\\Program Files\\gs\\gs10.04.0\\bin\\gswin64c.exe"
    )
  }
)

if (-not $isWin) {
  Write-Host "This script currently targets Windows host setup. Use worker Docker image on Linux/macOS." -ForegroundColor Yellow
  exit 0
}

Write-Host "==> Checking worker runtime dependencies..."
$status = @{}
foreach ($r in $requirements) {
  $status[$r.key] = Test-Tool -CommandName $r.command -KnownPaths $r.paths
}

if ($InstallMissing) {
  Ensure-Winget
  foreach ($r in $requirements) {
    if (-not $status[$r.key].ok) {
      Install-WithWinget -PackageId $r.package -Label $r.label
      $status[$r.key] = Test-Tool -CommandName $r.command -KnownPaths $r.paths
    }
  }
}

if ($EnableRusOcr) {
  Add-RussianTesseractData
}

Write-Host ""
Write-Host "Dependency status:"
$missing = @()
foreach ($r in $requirements) {
  $item = $status[$r.key]
  if ($item.ok) {
    Write-Host (" - {0}: OK ({1})" -f $r.command, $item.path) -ForegroundColor Green
  } else {
    Write-Host (" - {0}: MISSING" -f $r.command) -ForegroundColor Red
    $missing += $r.command
  }
}

if ($missing.Count -gt 0) {
  Write-Host ""
  Write-Host ("Missing required tools: {0}" -f ($missing -join ", ")) -ForegroundColor Red
  Write-Host "Run this script with -InstallMissing to attempt automatic installation." -ForegroundColor Yellow
  exit 1
}

Write-Host ""
Write-Host "All required worker dependencies are present." -ForegroundColor Green
