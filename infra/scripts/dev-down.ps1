$ErrorActionPreference = "Stop"

$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$stateFile = Join-Path (Join-Path $root ".dev") "processes.json"

if (Test-Path $stateFile) {
  try {
    $state = Get-Content $stateFile -Raw | ConvertFrom-Json
    foreach ($svc in $state.services) {
      try {
        if ($svc.pid) {
          Stop-Process -Id ([int]$svc.pid) -Force -ErrorAction SilentlyContinue
        }
      } catch {}
    }
  } catch {}
}

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

Stop-ByPort 3000
Stop-ByPort 5173

Write-Host "Dev processes stopped."
