# Accessible names of buttons and radio buttons in every Slate window -> C:\out\buttons.txt
Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes
$A = [System.Windows.Automation.AutomationElement]
$button = New-Object System.Windows.Automation.OrCondition(
    (New-Object System.Windows.Automation.PropertyCondition($A::ControlTypeProperty, [System.Windows.Automation.ControlType]::Button)),
    (New-Object System.Windows.Automation.PropertyCondition($A::ControlTypeProperty, [System.Windows.Automation.ControlType]::RadioButton)))
& {
    foreach ($window in $A::RootElement.FindAll([System.Windows.Automation.TreeScope]::Children, [System.Windows.Automation.Condition]::TrueCondition)) {
        if ($window.Current.ClassName -ne 'Chrome_WidgetWin_1' -or $window.Current.Name -ne 'Slate') { continue }
        "== $($window.Current.Name)"
        $window.FindAll([System.Windows.Automation.TreeScope]::Descendants, $button) | ForEach-Object { $_.Current.Name }
    }
} | Out-File -Encoding utf8 C:\out\buttons.txt
