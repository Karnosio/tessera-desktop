# Bring the Slate window to the front at a fixed place so screenshots are predictable
Add-Type @"
using System; using System.Runtime.InteropServices;
public static class W { [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool MoveWindow(IntPtr h, int x, int y, int w, int ht, bool r);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int c); }
"@
$p = Get-Process Slate -ErrorAction SilentlyContinue | Where-Object MainWindowHandle -ne 0 | Select-Object -First 1
if ($p) { [W]::ShowWindow($p.MainWindowHandle, 9) | Out-Null; [W]::MoveWindow($p.MainWindowHandle, 40, 20, 440, 700, $true) | Out-Null; [W]::SetForegroundWindow($p.MainWindowHandle) | Out-Null; "ok $($p.MainWindowTitle)" } else { "no window" }
