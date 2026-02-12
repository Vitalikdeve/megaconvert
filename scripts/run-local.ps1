$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$logs = Join-Path $root 'logs'
New-Item -ItemType Directory -Force -Path $logs | Out-Null

$redisExe = Join-Path $root 'redis\redis-server.exe'
if (Test-Path $redisExe) {
  $out = Join-Path $logs 'redis.out.log'
  $err = Join-Path $logs 'redis.err.log'
  Start-Process -FilePath $redisExe -ArgumentList @('--bind','127.0.0.1','--port','6379') -RedirectStandardOutput $out -RedirectStandardError $err -WindowStyle Hidden
} else {
  Write-Host 'Redis binary not found in ./redis. Download it or start Redis manually.'
}

function Start-NodeService($name, $workdir, $command) {
  $out = Join-Path $logs "$name.out.log"
  $err = Join-Path $logs "$name.err.log"
  Start-Process -FilePath "pwsh" -ArgumentList @(
    "-NoProfile",
    "-Command",
    $command
  ) -WorkingDirectory $workdir -RedirectStandardOutput $out -RedirectStandardError $err -WindowStyle Hidden
}

Start-NodeService -name 'api' -workdir (Join-Path $root 'server\api') -command 'npm run start'
Start-NodeService -name 'worker' -workdir (Join-Path $root 'server\worker') -command 'npm run start'
Start-NodeService -name 'frontend' -workdir $root -command 'npm run dev'

Write-Host "Started. Logs: $logs"
