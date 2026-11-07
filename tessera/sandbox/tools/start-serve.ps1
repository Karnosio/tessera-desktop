Start-Process powershell -WindowStyle Hidden -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File C:\out\serve.ps1"
Start-Sleep 2
try { "status " + (Invoke-WebRequest -UseBasicParsing -TimeoutSec 5 http://127.0.0.1:8099/profile.json).StatusCode } catch { "error " + $_.Exception.Message }
