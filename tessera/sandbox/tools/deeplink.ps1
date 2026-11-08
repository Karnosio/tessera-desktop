# Open Slate with sing-box://import-remote-profile pointing at the test server: deeplink.ps1 -Path links.txt [-Name Panel | -NoName]
param([string]$Path = "profile.json", [string]$Name = "Test", [switch]$NoName)
$url = [Uri]::EscapeDataString("http://127.0.0.1:8099/" + $Path)
$link = "sing-box://import-remote-profile?url=" + $url
if (-not $NoName) { $link += "#" + $Name }
Start-Process "C:\Program Files\Slate\Slate.exe" -ArgumentList $link
