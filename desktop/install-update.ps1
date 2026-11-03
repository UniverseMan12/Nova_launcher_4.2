param([Parameter(Mandatory=$true)][string]$RequestFile)
$ErrorActionPreference='Stop'
$request=$null
$replaced=$false
$pathsChecked=$false
$launcherChecked=$false
function Save-Result([bool]$success,[string]$message) {
    if($request -and $pathsChecked){[IO.File]::WriteAllText($request.result,(@{success=$success;message=$message;version=$request.version}|ConvertTo-Json),[Text.UTF8Encoding]::new($false))}
}
function Hash([string]$file) {
    $stream=[IO.File]::OpenRead($file)
    $hash=[Security.Cryptography.SHA256]::Create()
    try {return [BitConverter]::ToString($hash.ComputeHash($stream)).Replace('-','').ToLowerInvariant()}
    finally {$hash.Dispose();$stream.Dispose()}
}
function Start-Launcher {
    if($pathsChecked -and (Test-Path -LiteralPath $request.pending)) {
        $pending=Get-Content -LiteralPath $request.pending -Raw -Encoding UTF8 | ConvertFrom-Json
        if($pending.id -eq $request.id){Remove-Item -LiteralPath $request.pending -Force}
    }
    # Do not inherit the old portable wrapper's extraction path into the new launch.
    foreach($name in @('PORTABLE_EXECUTABLE_FILE','PORTABLE_EXECUTABLE_DIR','PORTABLE_EXECUTABLE_APP_FILENAME','ELECTRON_RUN_AS_NODE')) {
        [Environment]::SetEnvironmentVariable($name,$null,'Process')
    }
    $start=[Diagnostics.ProcessStartInfo]::new()
    $start.FileName=$request.target
    $start.WorkingDirectory=[IO.Path]::GetDirectoryName($request.target)
    $start.UseShellExecute=$false
    $start.CreateNoWindow=$true
    $process=[Diagnostics.Process]::Start($start)
    if(-not $process){throw 'The updated launcher could not be started.'}
    $process.Dispose()
}
try {
    $request=Get-Content -LiteralPath $RequestFile -Raw -Encoding UTF8 | ConvertFrom-Json
    $root=[IO.Path]::GetFullPath([IO.Path]::GetDirectoryName($RequestFile))
    foreach($field in @('ready','result','pending')) {
        if([IO.Path]::GetDirectoryName([IO.Path]::GetFullPath($request.$field)) -ne $root){throw 'Invalid update result path.'}
    }
    $pathsChecked=$true
    if($request.kind -notin @('portable','nsis') -or $request.sha256 -notmatch '^[a-f0-9]{64}$' -or $request.currentSha256 -notmatch '^[a-f0-9]{64}$'){throw 'Invalid update request.'}
    $target=[IO.Path]::GetFullPath($request.target)
    $source=[IO.Path]::GetFullPath($request.source)
    if($target -eq $source -or [IO.Path]::GetExtension($target) -ne '.exe' -or [IO.Path]::GetExtension($source) -ne '.exe'){throw 'Invalid launcher paths.'}
    if([IO.Path]::GetDirectoryName($source) -ne $root){throw 'Update package is outside the update cache.'}
    if((Hash $source) -ne $request.sha256 -or (Hash $target) -ne $request.currentSha256){throw 'Update file verification failed.'}
    $launcherChecked=$true
    # The running process decides the exact target; never accept a path from the UI.
    # File.Replace's source and backup are both in that same checked directory.
    $candidate=$target+'.nova-update-'+$request.id+'.exe'
    $backup=$target+'.nova-backup-'+$request.id+'.exe'
    if($request.id -notmatch '^[a-f0-9-]{36}$'){throw 'Invalid update transaction.'}
    if(Test-Path -LiteralPath $candidate){throw 'An update staging file already exists.'}
    if(Test-Path -LiteralPath $backup){throw 'An update backup already exists.'}
    if($request.kind -eq 'portable') {
        Copy-Item -LiteralPath $source -Destination $candidate
        if((Hash $candidate) -ne $request.sha256){throw 'Staged update verification failed.'}
    }
    # An explicit handoff file is created by the app only after it receives readiness.
    [IO.File]::WriteAllText($request.ready,'ready')
    $deadline=[DateTime]::UtcNow.AddSeconds(90)
    while([DateTime]::UtcNow -lt $deadline) {
        try {
            $parent=[Diagnostics.Process]::GetProcessById($request.parentPid)
            $alive=$parent -and [math]::Abs(($parent.StartTime.ToUniversalTime()-[DateTime]::Parse($request.parentStarted).ToUniversalTime()).TotalSeconds) -lt 1
            $parent.Dispose()
        }catch{$alive=$false}
        if(-not $alive){break}
        Start-Sleep -Milliseconds 200
    }
    if($alive){throw 'The launcher did not close. The update was not installed.'}
    if(-not (Test-Path -LiteralPath ($RequestFile+'.apply'))){throw 'The launcher cancelled the update handoff.'}
    if((Hash $source) -ne $request.sha256 -or (Hash $target) -ne $request.currentSha256){throw 'A launcher file changed during the update.'}
    if($request.kind -eq 'portable') {
        # A portable launcher has a wrapper process which can outlive its Electron child.
        # Retry replacement while that wrapper releases the old EXE; never terminate it.
        $replaced=$false
        $deadline=[DateTime]::UtcNow.AddSeconds(60)
        while([DateTime]::UtcNow -lt $deadline) {
            try {
                if((Hash $target) -ne $request.currentSha256){throw 'The portable launcher changed while waiting for its file lock.'}
                [IO.File]::Replace($candidate,$target,$backup);$replaced=$true;break
            }
            catch [IO.IOException] {Start-Sleep -Milliseconds 300}
        }
        if(-not $replaced){throw 'The portable launcher is still locked. Close it and try again.'}
        if((Hash $target) -ne $request.sha256){throw 'Installed update verification failed.'}
    } else {
        $start=[Diagnostics.ProcessStartInfo]::new()
        $start.FileName=$source
        # NSIS requires /D to be last and unquoted, even when its absolute path has spaces.
        $start.Arguments='/S --updated /D='+[IO.Path]::GetDirectoryName($target)
        $start.UseShellExecute=$false
        $start.CreateNoWindow=$true
        $installer=[Diagnostics.Process]::Start($start)
        $installer.WaitForExit()
        if($installer.ExitCode -ne 0){throw "Installer exited with code $($installer.ExitCode)."}
        $installer.Dispose()
        if(-not (Test-Path -LiteralPath $target)){throw 'The installed launcher could not be found.'}
        $version=[Diagnostics.FileVersionInfo]::GetVersionInfo($target).ProductVersion
        # Electron's Windows product resource includes a fourth zero component.
        if($version -ne $request.version -and $version -ne ($request.version+'.0')){throw "The installer reports version $version instead of $($request.version)."}
    }
    Save-Result $true 'Launcher updated successfully.'
    Start-Launcher
} catch {
    $message=$_.Exception.Message
    if($replaced -and (Test-Path -LiteralPath $backup)) {
        try {[IO.File]::Replace($backup,$target,$null)} catch {$message+=' Automatic restore failed; the previous EXE is saved beside the launcher.'}
    }
    Save-Result $false $message
    # If the app already closed, bring the previous/installed launcher back to show the error.
    if($launcherChecked -and (Test-Path -LiteralPath ($RequestFile+'.apply')) -and (Test-Path -LiteralPath $request.target)) {
        try {Start-Launcher} catch {}
    }
    exit 1
} finally {
    # Only the exact transaction file is removed; backups remain available for recovery.
    if($candidate -and (Test-Path -LiteralPath $candidate)){Remove-Item -LiteralPath $candidate -Force -ErrorAction SilentlyContinue}
}
