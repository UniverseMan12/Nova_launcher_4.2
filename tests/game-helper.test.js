import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));

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
        string log = Regex.Match(arguments, "-ABSLOG=\"([^\"]+)\"").Groups[1].Value;
        File.WriteAllText(log, "[UOnlineAccountCommon::ContinueLoggingIn] (Completed)\r\n");
        string release = ReleaseFile.Replace("'", "''");
        string code = Environment.GetEnvironmentVariable("NOVA_HELPER_TEST_EXIT");
        string script = "$end=(Get-Date).AddSeconds(15); while(-not (Test-Path -LiteralPath '" + release + "')) { if((Get-Date) -gt $end){exit 88}; Start-Sleep -Milliseconds 50 }; Start-Sleep -Milliseconds 250; exit " + code;
        var info = new ProcessStartInfo(Environment.GetEnvironmentVariable("NOVA_HELPER_TEST_POWERSHELL"), "-NoProfile -NonInteractive -EncodedCommand " + Convert.ToBase64String(Encoding.Unicode.GetBytes(script)));
        info.UseShellExecute = false;
        info.CreateNoWindow = true;
        child = Process.Start(info);
        return child.Id;
    }
    public void LoadLibrary(int pid, string file) {
        if (Path.GetFileName(file) == "console.dll" && Environment.GetEnvironmentVariable("LAUNCHER_AUTO_SPRINT") != "1") File.WriteAllText(ReleaseFile, "ready");
    }
    public void HideServerViewport(int pid) { }
    public void Dispose() {
        if (child != null) {
            if (!child.HasExited) child.Kill();
            child.Dispose();
        }
        File.WriteAllText(Environment.GetEnvironmentVariable("NOVA_HELPER_TEST_DISPOSED"), "disposed");
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

test('game helper preserves real child exit status, including after experimental input fails', { skip: process.platform !== 'win32' }, async t => {
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
  write('src/LegacyGameData.cs', fs.readFileSync(path.join(root, 'src/LegacyGameData.cs')));
  write('src/LegacyDisplay.cs', 'public static class LegacyDisplay { public static int[] DesktopSize() { return new[]{1920,1080}; } public static string Repair(string file,int width,int height,bool isolated) { return null; } }');
  write('game/FortniteGame/Binaries/Win64/FortniteClient-Win64-Shipping.exe', 'fixture only, never executed');
  fs.mkdirSync(path.join(directory, 'game/Engine'));
  fs.mkdirSync(path.join(directory, 'logs'));
  write('config.local.json', JSON.stringify({ username: 'TestPlayer', gamePath: path.join(directory, 'game') }));
  const dlls = {};
  for (const name of ['sinum.dll', 'memory.dll', 'console.dll']) {
    const content = Buffer.from(`fixture ${name}`);
    write(`runtime/${name}`, content);
    dlls[name] = crypto.createHash('sha256').update(content).digest('hex');
  }
  write('dependencies.lock.json', JSON.stringify({ dlls }));
  write('run.ps1', `param([string]$Helper)
$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'
$env:NOVA_HELPER_TEST_POWERSHELL=Join-Path $PSHOME 'powershell.exe'
function Invoke-RestMethod { @{ service='fortnite-backend-local'; ready=$true } }
& $Helper -Mode client
exit $LASTEXITCODE
`);

  for (const autoSprint of [false, true]) for (const childExit of [0, 7]) {
    await t.test(`child exit ${childExit}, Auto-Sprint ${autoSprint ? 'fails safely' : 'disabled'}`, () => {
      const id = `${autoSprint}-${childExit}`;
      const release = path.join(directory, `${id}.release`);
      const disposed = path.join(directory, `${id}.disposed`);
      const inputDisposed = path.join(directory, `${id}.input-disposed`);
      const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', path.join(directory, 'run.ps1'), '-Helper', path.join(directory, 'scripts/launch-game.ps1')], {
        windowsHide: true, encoding: 'utf8', timeout: 25000,
        env: { ...process.env, LOCALAPPDATA: path.join(directory, 'old-data'), LAUNCHER_PROFILE_DIR: path.join(directory, 'persistent/profile'),
          LAUNCHER_AUTO_SPRINT: autoSprint ? '1' : '0', NOVA_HELPER_TEST_EXIT: String(childExit),
          NOVA_HELPER_TEST_RELEASE: release, NOVA_HELPER_TEST_DISPOSED: disposed, NOVA_HELPER_TEST_INPUT_DISPOSED: inputDisposed }
      });
      assert.ifError(result.error);
      assert.equal(result.status, childExit === 0 ? 0 : 1, result.stdout + result.stderr);
      assert.match(result.stdout, /LAUNCHER_READY:client/);
      assert.ok(fs.existsSync(disposed), 'All owned processes are disposed on either exit path');
      if (childExit) assert.match(result.stderr, /stopped unexpectedly \(exit code 7\)/);
      else assert.doesNotMatch(result.stderr, /stopped unexpectedly/);
      if (autoSprint) {
        assert.match(result.stderr, /Experimental Auto-Sprint stopped; normal controls remain available/);
        assert.ok(fs.existsSync(inputDisposed), 'Input failure disposes its helper before awaiting the game');
      } else assert.ok(!fs.existsSync(inputDisposed));
      assert.ok(fs.existsSync(path.join(directory, 'persistent/game-data/4.2/client/Saved/Config/WindowsClient/GameUserSettings.ini')));
      assert.ok(!fs.existsSync(path.join(directory, 'old-data')), 'The shared Fortnite settings directory remains untouched');
    });
  }
});
