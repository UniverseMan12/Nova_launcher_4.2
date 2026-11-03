param([string]$Source)
$ErrorActionPreference = 'Stop'
Add-Type -Path @($Source, (Join-Path $PSScriptRoot 'AutoSprintWindowCheck.cs'))
function Check($Actual, $Expected, $Name) {
    if ($Actual -ne $Expected) { throw "${Name}: expected $Expected, got $Actual" }
}
$state = New-Object AutoSprintState
Check ($state.Step($false,$true,$false)) 0 'Other window'
Check ($state.Step($true,$true,$false)) 0 'Focus while W held'
Check ($state.Step($true,$false,$false)) 0 'Release to arm'
Check ($state.Step($true,$true,$false)) 1 'Start'
for ($i=0; $i -lt 100; $i++) { Check ($state.Step($true,$true,$false)) 0 'No repeat pulses' }
Check ($state.Step($true,$false,$false)) -1 'Stop'
Check ($state.Step($true,$false,$false)) 0 'No duplicate release'
Check ($state.Step($true,$true,$false)) 1 'Restart'
Check ($state.Step($false,$true,$false)) -1 'Lose focus'
Check ($state.Step($false,$true,$false)) 0 'Stay unfocused'
Check ($state.Step($true,$true,$false)) 0 'No rearm on held W'
Check ($state.Step($true,$false,$false)) 0 'Rearm'
Check ($state.Step($true,$true,$true)) 0 'Physical F6'
Check ($state.Step($true,$true,$false)) 1 'Resume after physical release'
Check ($state.Step($true,$true,$true)) 0 'Player takes over Shift'
Check ($state.Step($true,$false,$true)) 0 'Do not release player-owned Shift'
Check ($state.Step($true,$true,$false)) 1 'Start again'
Check ($state.Step($false,$false,$false)) -1 'Dispose releases once'
Check ($state.Step($false,$false,$false)) 0 'Dispose again'
[AutoSprintWindowCheck]::Run()
'Auto-Sprint transition checks passed.'
