# Put text on the clipboard; by default a vless:// link that the converter rejects as broken
param([string]$Text = "vless://00000000-0000-0000-0000-000000000000@example.com:443?security=reality#example")
Set-Clipboard -Value $Text
