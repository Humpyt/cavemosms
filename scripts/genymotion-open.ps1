$genymotionExe = "C:\Program Files\Genymobile\Genymotion\genymotion.exe"

if (-not (Test-Path $genymotionExe)) {
  Write-Error "Genymotion is not installed at $genymotionExe"
  exit 1
}

Start-Process -FilePath $genymotionExe
Write-Host "Opened Genymotion."
