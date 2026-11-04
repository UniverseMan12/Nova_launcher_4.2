import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));

function assertSameExistingFile(reported, expected, output) {
  assert.ok(reported, output);
  // Get-ChildItem can expand a runner TEMP path's 8.3 alias. Both spellings
  // must identify the same existing file; an unrelated log must still fail.
  assert.equal(fs.realpathSync.native(reported).toLowerCase(), fs.realpathSync.native(expected).toLowerCase(), output);
}

// Exercise the real PowerShell helper, including its exit/finally paths. The
// native adapter starts a harmless hidden child instead of loading Fortnite.
const nativeAdapter = String.raw`
using System;
using System.Diagnostics;
using System.IO;
using System.Text;
using System.Text.RegularExpressions;
public sealed class LocalGameSession : IDisposable {
    Process child;
    static string ReleaseFile { get { return Environment.GetEnvironmentVariable("NOVA_HELPER_TEST_RELEASE"); } }
    public int Start(string executable, string arguments, bool suspended, string directory) {
        return Start(executable, arguments, suspended, directory, false);
    }
    public int Start(string executable, string arguments, bool suspended, string directory, bool hidden) {
        if (!File.Exists(Environment.GetEnvironmentVariable("NOVA_HELPER_TEST_REPAIRED"))) throw new InvalidOperationException("Settings guard must run before process creation");
        if (arguments.Contains("-UserDir")) throw new InvalidOperationException("Ineffective UserDir override must not return");
        File.WriteAllText(Environment.GetEnvironmentVariable("NOVA_HELPER_TEST_STARTED"), arguments);
        string log = Regex.Match(arguments, "-ABSLOG=\"([^\"]+)\"").Groups[1].Value;
        string scenario = Environment.GetEnvironmentVariable("NOVA_HELPER_TEST_SCENARIO");
        string completed = "[UOnlineAccountCommon::ContinueLoggingIn] (Completed)\r\n";
        string header = "LogInit: Filtered Command Line: " + arguments + "\r\n";
        if (scenario == "global" || scenario == "early-exit") {
            string logs = Path.Combine(Environment.GetEnvironmentVariable("LOCALAPPDATA"), "FortniteGame", "Saved", "Logs");
            Directory.CreateDirectory(logs);
            // These all look successfully logged in, but none owns this launch.
            File.WriteAllText(Path.Combine(logs, "00-stale.log"), "LogInit: Filtered Command Line: -ABSLOG=\"old-session.log\"\r\n" + completed);
            File.WriteAllText(Path.Combine(logs, "01-sibling.log"), "LogInit: Filtered Command Line: -ABSLOG=\"" + log + ".sibling\"\r\n" + completed);
            File.WriteAllText(Path.Combine(logs, "02-modern.log"), "LogInit: Filtered Command Line: -LOG=\"" + log + "\"\r\n" + completed);
            log = Path.Combine(logs, "zz-current.log");
        }
        File.WriteAllText(log, header + (scenario == "early-exit" ? "Startup still loading\r\n" : completed));
        File.WriteAllText(Environment.GetEnvironmentVariable("NOVA_HELPER_TEST_ACTUAL_LOG"), log);
        string release = ReleaseFile.Replace("'", "''");
        string code = Environment.GetEnvironmentVariable("NOVA_HELPER_TEST_EXIT");
        string script = "$end=(Get-Date).AddSeconds(15); while(-not (Test-Path -LiteralPath '" + release + "')) { if((Get-Date) -gt $end){exit 88}; Start-Sleep -Milliseconds 50 }; Start-Sleep -Milliseconds 250; exit " + code;
        var info = new ProcessStartInfo(Environment.GetEnvironmentVariable("NOVA_HELPER_TEST_POWERSHELL"), "-NoProfile -NonInteractive -EncodedCommand " + Convert.ToBase64String(Encoding.Unicode.GetBytes(script)));
        info.UseShellExecute = false;
        info.CreateNoWindow = true;
        child = Process.Start(info);
        Environment.SetEnvironmentVariable("NOVA_HELPER_TEST_PID", child.Id.ToString());
        return child.Id;
    }
    public void LoadLibrary(int pid, string file) {
        File.AppendAllText(Environment.GetEnvironmentVariable("NOVA_HELPER_TEST_LOADS"), Path.GetFileName(file) + "\r\n");
        if (Path.GetFileName(file) == "reboot.dll") {
            string signals = Environment.GetEnvironmentVariable("FORTNITE_LAUNCHER_SIGNALS");
            File.WriteAllText(Path.Combine(signals, "server-settings.flag"), "ready");
            File.WriteAllText(Path.Combine(signals, "server-started.flag"), "ready");
            File.WriteAllText(ReleaseFile, "ready");
        }
        if (Path.GetFileName(file) == "console.dll" && Environment.GetEnvironmentVariable("LAUNCHER_AUTO_SPRINT") != "1") File.WriteAllText(ReleaseFile, "ready");
    }
    public void HideServerViewport(int pid) {
        // The production helper has retained its process handle by this point.
        // Exit before its first login check, without racing Get-Process itself.
        if (Environment.GetEnvironmentVariable("NOVA_HELPER_TEST_SCENARIO") == "early-exit") {
            File.WriteAllText(ReleaseFile, "ready");
            if (!child.WaitForExit(5000)) throw new TimeoutException("Fixture child did not exit");
        }
    }
    public void Dispose() {
        if (child != null) {
            if (!child.HasExited) child.Kill();
            child.Dispose();
        }
        File.WriteAllText(Environment.GetEnvironmentVariable("NOVA_HELPER_TEST_DISPOSED"), "disposed");
    }
}`;

// Verify the real helper calls the guarded three-argument entry point with the
// shared path before Start. The repair algorithm has its own fixture tests;
// this adapter never reads or changes the user's real Fortnite settings.
const displayAdapter = String.raw`
using System;
using System.IO;
public static class LegacyDisplay {
    public static int[] DesktopSize() { return new[]{1920,1080}; }
    public static string Repair(string file, int width, int height) {
        string expected = Path.Combine(Environment.GetEnvironmentVariable("LOCALAPPDATA"), "FortniteGame", "Saved", "Config", "WindowsClient", "GameUserSettings.ini");
        if (file != expected || width != 1920 || height != 1080) throw new InvalidOperationException("Incorrect shared settings repair arguments");
        File.WriteAllText(Environment.GetEnvironmentVariable("NOVA_HELPER_TEST_REPAIRED"), file);
        if (Environment.GetEnvironmentVariable("NOVA_HELPER_TEST_SCENARIO") == "guard-blocked") throw new InvalidOperationException("simulated shared-settings process guard");
        return null;
    }
}`;

const inputAdapter = String.raw`
using System;
using System.IO;
public sealed class AutoSprint : IDisposable {
    public AutoSprint(int pid) { }
    public void Tick() {
        File.WriteAllText(Environment.GetEnvironmentVariable("NOVA_HELPER_TEST_RELEASE"), "ready");
        throw new InvalidOperationException("simulated input transport failure");
    }
    public void Dispose() {
        File.WriteAllText(Environment.GetEnvironmentVariable("NOVA_HELPER_TEST_INPUT_DISPOSED"), "disposed");
    }
}`;

test('game helper guards settings, identifies its log, and preserves child failures', { skip: process.platform !== 'win32' }, async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'nova-game-helper-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const write = (relative, value) => {
    const file = path.join(directory, relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, value);
  };
  write('scripts/launch-game.ps1', fs.readFileSync(path.join(root, 'scripts/launch-game.ps1')));
  write('src/NativeProcess.cs', nativeAdapter);
  write('src/AutoSprint.cs', inputAdapter);
  write('src/LegacyDisplay.cs', displayAdapter);
  write('game/FortniteGame/Binaries/Win64/FortniteClient-Win64-Shipping.exe', 'fixture only, never executed');
  fs.mkdirSync(path.join(directory, 'game/Engine'));
  fs.mkdirSync(path.join(directory, 'logs'));
  write('config.local.json', JSON.stringify({ username: 'TestPlayer', gamePath: path.join(directory, 'game') }));
  const dlls = {};
  for (const name of ['sinum.dll', 'memory.dll', 'console.dll', 'reboot.dll']) {
    const content = Buffer.from(`fixture ${name}`);
    write(`runtime/${name}`, content);
    dlls[name] = crypto.createHash('sha256').update(content).digest('hex');
  }
  write('dependencies.lock.json', JSON.stringify({ dlls }));
  write('run.ps1', `param([string]$Helper, [string]$Mode)
$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'
$env:NOVA_HELPER_TEST_POWERSHELL=Join-Path $PSHOME 'powershell.exe'
function Invoke-RestMethod { @{ service='fortnite-backend-local'; ready=$true } }
function Get-NetUDPEndpoint { param($LocalPort, $ErrorAction) if ($env:NOVA_HELPER_TEST_PID) { @{ OwningProcess=[int]$env:NOVA_HELPER_TEST_PID } } }
& $Helper -Mode $Mode
exit $LASTEXITCODE
`);

  const cases = [];
  for (const autoSprint of [false, true]) for (const childExit of [0, 7]) {
    cases.push({ name: `child exit ${childExit}, Auto-Sprint ${autoSprint ? 'fails safely' : 'disabled'}`, mode: 'client', scenario: 'abslog', autoSprint, childExit });
  }
  for (const mode of ['client', 'server']) {
    cases.push({ name: `${mode} finds its global log despite stale, sibling and modern logs`, mode, scenario: 'global', childExit: 0 });
    cases.push({ name: `${mode} stops before spawning when shared settings guard rejects repair`, mode, scenario: 'guard-blocked', childExit: 0 });
  }
  cases.push({ name: 'early server crash reports the actual global log before reading stale login markers', mode: 'server', scenario: 'early-exit', childExit: 7 });
  for (const [index, { name, mode, scenario, autoSprint = false, childExit }] of cases.entries()) {
    await t.test(name, () => {
      const fixture = path.join(directory, `case-${index}`);
      fs.mkdirSync(fixture);
      const marker = name => path.join(fixture, name);
      const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', path.join(directory, 'run.ps1'), '-Helper', path.join(directory, 'scripts/launch-game.ps1'), '-Mode', mode], {
        windowsHide: true, encoding: 'utf8', timeout: 25000,
        env: { ...process.env, LOCALAPPDATA: marker('local-data'), LAUNCHER_PROFILE_DIR: marker('persistent/profile'),
          LAUNCHER_AUTO_SPRINT: autoSprint ? '1' : '0', NOVA_HELPER_TEST_EXIT: String(childExit),
          NOVA_HELPER_TEST_SCENARIO: scenario, NOVA_HELPER_TEST_PID: '',
          NOVA_HELPER_TEST_RELEASE: marker('release'), NOVA_HELPER_TEST_DISPOSED: marker('disposed'), NOVA_HELPER_TEST_INPUT_DISPOSED: marker('input-disposed'),
          NOVA_HELPER_TEST_REPAIRED: marker('repaired'), NOVA_HELPER_TEST_STARTED: marker('started'),
          NOVA_HELPER_TEST_ACTUAL_LOG: marker('actual-log'), NOVA_HELPER_TEST_LOADS: marker('loads') }
      });
      assert.ifError(result.error);
      const output = result.stdout + result.stderr;
      assert.equal(fs.readFileSync(marker('repaired'), 'utf8'), path.join(fixture, 'local-data/FortniteGame/Saved/Config/WindowsClient/GameUserSettings.ini'));
      assert.ok(!fs.existsSync(marker('persistent/game-data')), 'No ineffective per-role settings tree is created');
      if (scenario === 'guard-blocked') {
        assert.equal(result.status, 1, output);
        assert.match(result.stderr, /simulated shared-settings process guard/);
        assert.ok(!fs.existsSync(marker('started')), 'A rejected repair never starts any native process');
        assert.ok(!fs.existsSync(marker('loads')), 'No DLL is loaded after guard rejection');
        return;
      }
      assert.equal(result.status, childExit === 0 ? 0 : 1, output);
      const actualLog = fs.readFileSync(marker('actual-log'), 'utf8');
      const reportedLog = /^\[(?:client|server)\] Game log: ([^\r\n]+)/m.exec(result.stdout)?.[1];
      assertSameExistingFile(reportedLog, actualLog, output);
      assert.ok(fs.existsSync(marker('disposed')), 'All owned processes are disposed on either exit path');
      assert.doesNotMatch(output, /Game log: .*?(00-stale|01-sibling|02-modern)\.log/);
      if (scenario === 'global' || scenario === 'early-exit') {
        assertSameExistingFile(actualLog, path.join(fixture, 'local-data/FortniteGame/Saved/Logs/zz-current.log'), output);
        const requestedLog = /-ABSLOG="([^"]+)"/.exec(fs.readFileSync(marker('started'), 'utf8'))[1];
        assert.ok(!fs.existsSync(requestedLog), 'Shipping fixture deliberately ignores ABSLOG');
      }
      if (scenario === 'early-exit') {
        assert.match(result.stderr, /exited before login completed \(exit code 7\)/);
        const failureLog = /Log: ([^\r\n]+)/.exec(result.stderr)?.[1];
        assertSameExistingFile(failureLog, actualLog, output);
        assert.doesNotMatch(result.stdout, /LAUNCHER_READY:|Local login confirmed/);
        assert.equal(fs.readFileSync(marker('loads'), 'utf8').trim(), 'sinum.dll', 'No post-login DLL is loaded after an early crash');
        return;
      }
      assert.ok(result.stdout.includes(`LAUNCHER_READY:${mode}`), output);
      if (childExit) assert.match(result.stderr, /stopped unexpectedly \(exit code 7\)/);
      else assert.doesNotMatch(result.stderr, /stopped unexpectedly/);
      if (autoSprint) {
        assert.match(result.stderr, /Experimental Auto-Sprint stopped; normal controls remain available/);
        assert.ok(fs.existsSync(marker('input-disposed')), 'Input failure disposes its helper before awaiting the game');
      } else assert.ok(!fs.existsSync(marker('input-disposed')));
    });
  }
});
