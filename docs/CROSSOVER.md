# CrossOver startup diagnostics (experimental)

These changes diagnose the **Windows launcher UI** in CrossOver. They do not
provide a native macOS game port or confirm that Fortnite, PowerShell, the
backend or Reboot work in CrossOver.

## Preserve the normal Windows path

Launch the EXE normally on Windows. Hardware acceleration, renderer sandbox,
context isolation, downloads and the game/server startup scripts keep their
existing settings. There is no automatic Wine detection, Electron downgrade,
security bypass or change to game DLLs. The existing release is not replaced
by this development branch.

## Test in CrossOver

Use the **portable EXE built from this branch** to avoid the NSIS installer's
"cannot close NOVA DROP" step. In CrossOver's Run Command dialog, choose the
portable EXE and append `--crossover`, for example:

```text
"C:\path\NOVA-DROP-0.4.0-x64-portable.exe" --crossover
```

Close any existing NOVA DROP instance in that bottle before switching modes;
the application intentionally keeps its single-instance lock. This flag
disables hardware acceleration for the launcher and shows its window immediately.
It is not persisted and is not passed to Fortnite. Omit it on the next launch
to use the normal mode. Do not add `--no-sandbox`.

## Diagnostics

`%APPDATA%\FortniteLauncher\startup.log` is written before the first window or
session action. Under CrossOver it is inside the selected bottle's
`drive_c/users/crossover/AppData/Roaming/FortniteLauncher` folder. It records
startup milestones, Electron version, compatibility mode, preload failures,
page-load failures and GPU/renderer process exits. It does not record command
line arguments, authentication data or game profiles. Logs are local and bounded
to approximately 1 MiB plus one previous file; nothing is uploaded automatically.

The normal Windows window still appears after its page loads. A page that
never loads now fails after 45 seconds with a diagnostic dialog instead of
leaving a hidden launcher running indefinitely. Missing preload connections
show a visible error and disable controls; the startup overlay still disappears.

Earlier **0.4.0** tests in this Mac's CrossOver bottle showed repeated GPU process
crashes. Passing `--disable-gpu` removed those crashes during the captured run,
but did not produce a visible launcher. That is evidence for a graphics problem,
not proof that hardware acceleration is the only problem. This branch adds the
visibility and diagnostics needed to investigate the remaining startup failure.
