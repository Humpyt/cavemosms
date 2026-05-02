$ErrorActionPreference = "Stop"

$adbExe = Join-Path $env:LOCALAPPDATA "Android\Sdk\platform-tools\adb.exe"
$gmtoolExe = "C:\Program Files\Genymobile\Genymotion\gmtool.exe"
$androidStudioJbr = "C:\Program Files\Android\Android Studio\jbr"

if (-not (Test-Path $adbExe)) {
  throw "ADB not found at $adbExe"
}

if (-not (Test-Path $gmtoolExe)) {
  throw "Genymotion tool not found at $gmtoolExe"
}

if (-not $env:JAVA_HOME -and (Test-Path $androidStudioJbr)) {
  $env:JAVA_HOME = $androidStudioJbr
}

if ($env:JAVA_HOME) {
  $env:Path = "$env:JAVA_HOME\bin;$env:Path"
}

& $adbExe start-server | Out-Null

$connectedDevices = & $adbExe devices | Select-Object -Skip 1 | Where-Object { $_ -match "\S+\s+device$" }

if (-not $connectedDevices) {
  Write-Host "No running Android device found in ADB."
  Write-Host "Open or start a Genymotion virtual device first with: npm run genymotion:open"
  Write-Host ""
  Write-Host "Configured Genymotion devices:"
  & $gmtoolExe admin list
  exit 1
}

$targetSerial = ($connectedDevices[0] -split "\s+")[0]

Write-Host "Using Android target: $targetSerial"
$env:Path = "$(Split-Path $adbExe);$env:Path"

npx cap run android --target $targetSerial
