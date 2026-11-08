# Press a button or radio button by its accessible name in any Slate window (* for a wildcard); the last match wins
param([string]$Name)
Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes
$A = [System.Windows.Automation.AutomationElement]
$anyButton = New-Object System.Windows.Automation.OrCondition(
    (New-Object System.Windows.Automation.PropertyCondition($A::ControlTypeProperty, [System.Windows.Automation.ControlType]::Button)),
    (New-Object System.Windows.Automation.PropertyCondition($A::ControlTypeProperty, [System.Windows.Automation.ControlType]::RadioButton)))
$button = New-Object System.Windows.Automation.AndCondition(
    (New-Object System.Windows.Automation.PropertyCondition($A::NameProperty, $Name)), $anyButton)
$element = $null
for ($i = 0; $i -lt 20 -and -not $element; $i++) {
    foreach ($window in $A::RootElement.FindAll([System.Windows.Automation.TreeScope]::Children, [System.Windows.Automation.Condition]::TrueCondition)) {
        if ($window.Current.ClassName -ne 'Chrome_WidgetWin_1' -or $window.Current.Name -ne 'Slate') { continue }
        if ($Name.Contains("*")) {
            $all = @($window.FindAll([System.Windows.Automation.TreeScope]::Descendants, $anyButton) | Where-Object { $_.Current.Name -like $Name })
        } else {
            $all = @($window.FindAll([System.Windows.Automation.TreeScope]::Descendants, $button))
        }
        if ($all.Count -gt 0) { $element = $all[$all.Count - 1] }
    }
    if (-not $element) { Start-Sleep -Milliseconds 500 }
}
if (-not $element) { "not found: $Name"; exit 1 }
$pattern = $null
if ($element.TryGetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern, [ref]$pattern)) { $pattern.Invoke(); "invoked: $Name" }
elseif ($element.TryGetCurrentPattern([System.Windows.Automation.SelectionItemPattern]::Pattern, [ref]$pattern)) { $pattern.Select(); "selected: $Name" }
elseif ($element.TryGetCurrentPattern([System.Windows.Automation.ExpandCollapsePattern]::Pattern, [ref]$pattern)) {
    if ($pattern.Current.ExpandCollapseState -eq [System.Windows.Automation.ExpandCollapseState]::Collapsed) { $pattern.Expand() } else { $pattern.Collapse() }; "toggled: $Name" }
elseif ($element.TryGetCurrentPattern([System.Windows.Automation.TogglePattern]::Pattern, [ref]$pattern)) { $pattern.Toggle(); "toggled: $Name" }
else { "no pattern: $Name"; exit 2 }
