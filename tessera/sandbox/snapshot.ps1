$ErrorActionPreference = "Continue"
$out = "C:\out\$(Get-Date -Format 'HHmmss').txt"

& {
    "== $(Get-Date -Format o)"

    "== processes"
    $rows = foreach ($p in Get-CimInstance Win32_Process -Filter "Name LIKE 'slate%'") {
        $live = Get-Process -Id $p.ProcessId -ErrorAction SilentlyContinue
        if ($null -eq $live) { continue }
        $role = if ($p.CommandLine -match '--type=(\S+)') { $Matches[1] } elseif ($p.CommandLine -match '\s(service|worker|run)\b') { $Matches[1] } else { 'main' }
        [pscustomobject]@{
            Pid       = $p.ProcessId
            Name      = $p.Name
            Role      = $role
            PrivateMB = [math]::Round($live.PrivateMemorySize64 / 1MB, 1)
            WorkingMB = [math]::Round($live.WorkingSet64 / 1MB, 1)
        }
    }
    $rows | Sort-Object Name, Role | Format-Table -AutoSize | Out-String -Width 200
    $rows | Group-Object Name | ForEach-Object {
        "{0}: private {1} MB, working set {2} MB" -f $_.Name,
            [math]::Round(($_.Group | Measure-Object PrivateMB -Sum).Sum, 1),
            [math]::Round(($_.Group | Measure-Object WorkingMB -Sum).Sum, 1)
    }

    "== service"
    Get-Service slate-daemon -ErrorAction SilentlyContinue | Format-List Name, Status, StartType | Out-String

    "== adapters"
    Get-NetAdapter | Format-Table Name, InterfaceDescription, Status -AutoSize | Out-String -Width 200

    "== default routes"
    Get-NetRoute -DestinationPrefix 0.0.0.0/0, ::/0 -ErrorAction SilentlyContinue |
        Format-Table InterfaceAlias, NextHop, RouteMetric -AutoSize | Out-String -Width 200

    "== egress, bypassing the system proxy"
    foreach ($family in '-4', '-6') {
        "$family " + ((curl.exe $family -s -m 15 https://www.cloudflare.com/cdn-cgi/trace | Select-String '^(ip|loc)=') -join ' ')
    }

    "== daemon events"
    try {
        Get-WinEvent -FilterHashtable @{ LogName = 'Application'; ProviderName = 'slate-daemon' } -MaxEvents 30 -ErrorAction Stop |
            Format-Table TimeCreated, LevelDisplayName, Message -Wrap | Out-String -Width 200
    } catch {}
} *>&1 | Tee-Object -FilePath $out

"Saved: $out"
