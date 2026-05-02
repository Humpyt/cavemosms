$gmtoolExe = "C:\Program Files\Genymobile\Genymotion\gmtool.exe"
$adbExe = Join-Path $env:LOCALAPPDATA "Android\Sdk\platform-tools\adb.exe"

if (-not (Test-Path $gmtoolExe)) {
  Write-Error "Genymotion tool not found at $gmtoolExe"
  exit 1
}

Write-Host "Genymotion virtual devices:"
& $gmtoolExe admin list

if (Test-Path $adbExe) {
  Write-Host ""
  Write-Host "ADB connected devices:"
  & $adbExe start-server | Out-Null
  & $adbExe devices
} else {
  Write-Warning "ADB not found at $adbExe"
}
