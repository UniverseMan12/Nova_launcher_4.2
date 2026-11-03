param([ValidateSet('client','server')][string]$Mode = 'client')
$ErrorActionPreference = 'Stop'
Import-Module "$PSHOME\Modules\Microsoft.PowerShell.Utility\Microsoft.PowerShell.Utility.psd1" -Force
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding
$projectRoot = Split-Path $PSScriptRoot -Parent
$session = $null
$autoSprint = $null
$logReader = $null
$signalDirectory = $null
try {
    if (-not [Environment]::Is64BitProcess) { throw 'Please use 64-bit PowerShell.' }
    $config = Get-Content -LiteralPath (Join-Path $projectRoot 'config.local.json') -Raw | ConvertFrom-Json
    $manifest = Get-Content -LiteralPath (Join-Path $projectRoot 'dependencies.lock.json') -Raw | ConvertFrom-Json
    if ($config.username -notmatch '^[A-Za-z0-9_-]{3,24}$') { throw 'Invalid player name.' }
    $binaries = Join-Path $config.gamePath 'FortniteGame\Binaries\Win64'
    $exe = Join-Path $binaries 'FortniteClient-Win64-Shipping.exe'
    foreach ($folder in @('Engine', 'FortniteGame')) {
        if (-not (Test-Path -LiteralPath (Join-Path $config.gamePath $folder) -PathType Container)) { throw "Missing folder: $folder." }
    }
    if (-not (Test-Path -LiteralPath $exe -PathType Leaf)) { throw 'The Shipping EXE is missing.' }
    $dllNames = @('sinum.dll','memory.dll')
    if ($Mode -eq 'server') { $dllNames += 'reboot.dll' } else { $dllNames += 'console.dll' }
    foreach ($name in $dllNames) {
        $file = Join-Path $projectRoot "runtime\$name"
        $sha = [System.Security.Cryptography.SHA256]::Create()
        try { $hash = [BitConverter]::ToString($sha.ComputeHash([IO.File]::ReadAllBytes($file))).Replace('-', '') }
        finally { $sha.Dispose() }
        if ($hash -ne $manifest.dlls.$name) { throw "Checksum mismatch: $name" }
    }
    $health = Invoke-RestMethod 'http://127.0.0.1:3551/local/health' -TimeoutSec 3
    if ($health.service -ne 'fortnite-backend-local' -or -not $health.ready) { throw 'The local backend is not ready.' }
    if ($Mode -eq 'server' -and (Get-NetUDPEndpoint -LocalPort 7777 -ErrorAction SilentlyContinue)) { throw 'UDP port 7777 is already in use.' }
    Add-Type -Path (Join-Path $projectRoot 'src\NativeProcess.cs')
    Add-Type -Path (Join-Path $projectRoot 'src\LegacyDisplay.cs')
    $desktopSize = [LegacyDisplay]::DesktopSize()
    $settingsFile = Join-Path $env:LOCALAPPDATA 'FortniteGame\Saved\Config\WindowsClient\GameUserSettings.ini'
    $settingsBackup = [LegacyDisplay]::Repair($settingsFile, $desktopSize[0], $desktopSize[1])
    if ($settingsBackup) { Write-Output "[$Mode] Startup resolution adjusted for Fortnite 4.2. Original settings: $settingsBackup" }
    $session = New-Object LocalGameSession
    # Work around legacy Unreal/OpenSSL initialization issues on newer Intel CPUs.
    $env:OPENSSL_ia32cap = '~0x20000000'
    $working = Join-Path $projectRoot "data\$Mode"
    New-Item -ItemType Directory -Force -Path $working | Out-Null
    if ($Mode -eq 'server') {
        $signalDirectory = Join-Path $working ([Guid]::NewGuid().ToString('N'))
        New-Item -ItemType Directory -Path $signalDirectory | Out-Null
        $env:FORTNITE_LAUNCHER_SIGNALS = $signalDirectory
    }
    # The two presence processes remain suspended: their anti-cheat code is not executed.
    foreach ($name in @('FortniteLauncher.exe','FortniteClient-Win64-Shipping_EAC.exe')) {
        $file = Join-Path $binaries $name
        if (Test-Path -LiteralPath $file) { $null = $session.Start($file, '', $true, $binaries) }
    }
    $log = Join-Path $projectRoot ("logs\{0}-{1}.log" -f $Mode, (Get-Date -Format 'yyyyMMdd-HHmmss-fff'))
    $playerName = $config.username
    if ($Mode -eq 'server') { $playerName = 'LocalHost' }
    $arguments = '-epicapp=Fortnite -epicenv=Prod -epiclocale=en-us -epicportal -skippatchcheck -nobe -AUTH_TYPE=epic -AUTH_LOGIN=' + $playerName + '@local.invalid -AUTH_PASSWORD=LocalOnly -log -forcelogflush -ABSLOG="' + $log + '"'
    if ($Mode -eq 'server') { $arguments += ' -nosplash -nosound -nullrhi -windowed -port=7777' }
    else { $arguments += ' -windowed -ResX=1280 -ResY=720' }
    $gameId = $session.Start($exe, $arguments, $false, $working, ($Mode -eq 'server'))
    Write-Output "[$Mode] Fortnite started (PID $gameId). Connecting to the local backend..."
    $session.LoadLibrary($gameId, (Join-Path $projectRoot 'runtime\sinum.dll'))
    $game = Get-Process -Id $gameId
    $deadline = (Get-Date).AddMinutes(4)
    $loggedIn = $false
    $actualLog = $log
    $carry = ''
    while ((Get-Date) -lt $deadline) {
        if ($Mode -eq 'server') { $session.HideServerViewport($gameId) }
        $game.Refresh()
        if ($game.HasExited) { throw "Fortnite exited before login completed. Log: $log" }
        # Some Shipping builds ignore ABSLOG. Identify their default log by this
        # instance's unique command-line marker, never by a stale login message.
        if ($null -eq $logReader) {
            if (-not (Test-Path -LiteralPath $actualLog)) {
                $defaultLogs = Join-Path $env:LOCALAPPDATA 'FortniteGame\Saved\Logs'
                foreach ($candidate in @(Get-ChildItem -LiteralPath $defaultLogs -Filter '*.log' -ErrorAction SilentlyContinue)) {
                    $header = Get-Content -LiteralPath $candidate.FullName -TotalCount 160 -ErrorAction SilentlyContinue
                    if ($header | Select-String -SimpleMatch $log) { $actualLog = $candidate.FullName; break }
                }
            }
            if (Test-Path -LiteralPath $actualLog) {
                $stream = [IO.File]::Open($actualLog, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::ReadWrite)
                $logReader = New-Object IO.StreamReader($stream)
                Write-Output "[$Mode] Game log: $actualLog"
            }
        }
        if ($null -ne $logReader) {
            $tail = $carry + $logReader.ReadToEnd()
            $carry = $tail.Substring([Math]::Max(0, $tail.Length - 512))
            if ($tail -match '\[UOnlineAccountCommon::ContinueLoggingIn\][^\r\n]*\(Completed\)') { $loggedIn = $true; break }
            if ($tail -match 'Unable to login to Fortnite servers|Fatal error!|Critical error') { throw "Login or game startup failed. Log: $actualLog" }
        }
        Start-Sleep -Milliseconds 400
    }
    if (-not $loggedIn) { throw "Login was not confirmed within 4 minutes. Log: $actualLog" }
    if ($null -ne $logReader) { $logReader.Dispose(); $logReader = $null }
    Write-Output "[$Mode] Local login confirmed."
    $session.LoadLibrary($gameId, (Join-Path $projectRoot 'runtime\memory.dll'))
    if ($Mode -eq 'server') {
        $session.LoadLibrary($gameId, (Join-Path $projectRoot 'runtime\reboot.dll'))
        $settingsFlag = Join-Path $signalDirectory 'server-settings.flag'
        $startFlag = Join-Path $signalDirectory 'server-started.flag'
        $deadline = (Get-Date).AddSeconds(60)
        while (-not (Test-Path -LiteralPath $settingsFlag)) {
            $session.HideServerViewport($gameId)
            $game.Refresh()
            if ($game.HasExited) { throw 'Game server exited before opening settings.' }
            if ((Get-Date) -gt $deadline) { throw 'Reboot settings did not open. Check the pinned server build.' }
            Start-Sleep -Milliseconds 400
        }
        Write-Output 'LAUNCHER_CONFIGURE:server'
        # The user can take as long as needed to choose a playlist.
        while (-not (Test-Path -LiteralPath $startFlag)) {
            $session.HideServerViewport($gameId)
            $game.Refresh()
            if ($game.HasExited) { throw 'Game server closed during playlist selection.' }
            Start-Sleep -Milliseconds 400
        }
        Write-Output 'LAUNCHER_STARTING:server'
        $deadline = (Get-Date).AddMinutes(2)
        $listening = $false
        while ((Get-Date) -lt $deadline) {
            $session.HideServerViewport($gameId)
            $game.Refresh()
            if ($game.HasExited) { throw 'Game server exited before opening its game port.' }
            $endpoint = Get-NetUDPEndpoint -LocalPort 7777 -ErrorAction SilentlyContinue | Where-Object { $_.OwningProcess -eq $gameId }
            if ($endpoint) { $listening = $true; break }
            Start-Sleep -Milliseconds 500
        }
        if (-not $listening) { throw 'Game server did not open UDP port 7777 within 2 minutes.' }
        # Listening is a startup prerequisite, not proof of a successful playable match.
        Write-Output 'LAUNCHER_READY:server'
    } else {
        $session.LoadLibrary($gameId, (Join-Path $projectRoot 'runtime\console.dll'))
        if ($env:LAUNCHER_AUTO_SPRINT -eq '1') {
            Add-Type -Path (Join-Path $projectRoot 'src\AutoSprint.cs')
            $autoSprint = New-Object AutoSprint($gameId)
            Write-Output '[client] Auto-Sprint: separate sprint input, limited to this Fortnite window.'
        }
        $hostAddress = '127.0.0.1'
        if ($env:LAUNCHER_GAME_HOST) { $hostAddress = $env:LAUNCHER_GAME_HOST }
        Write-Output "[client] Console loaded. Once the host is ready: press F8, type open ${hostAddress}:7777, press Enter."
        Write-Output 'LAUNCHER_READY:client'
    }
    if ($Mode -eq 'server') {
        while (-not $game.WaitForExit(500)) { $session.HideServerViewport($gameId) }
    } elseif ($null -ne $autoSprint) {
        while (-not $game.WaitForExit(8)) { $autoSprint.Tick() }
    } else { $game.WaitForExit() }
} catch {
    [Console]::Error.WriteLine("[$Mode] " + $_.Exception.Message)
    exit 1
} finally {
    if ($null -ne $autoSprint) {
        try { $autoSprint.Dispose() } catch { [Console]::Error.WriteLine($_.Exception.Message) }
    }
    if ($null -ne $logReader) { $logReader.Dispose() }
    if ($null -ne $session) { $session.Dispose() }
}
