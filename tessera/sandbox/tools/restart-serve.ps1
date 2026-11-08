Get-CimInstance Win32_Process -Filter "Name = 'powershell.exe'" | Where-Object CommandLine -match '\\serve\.ps1' | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
& C:\out\start-serve.ps1
