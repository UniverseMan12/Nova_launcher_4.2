import fs from 'node:fs';
import path from 'node:path';
import { createInterface } from 'node:readline';
import { spawn } from 'node:child_process';
import { ROOT } from './config.js';
import { createReadiness } from './readiness.js';

// Keep technical helper output in a log; only readiness drives the startup sequence.
export function startGame(mode, onPhase = () => {}, { multiplayer = false, gameHost = '127.0.0.1', gameMode = 'classic', profileDirectory = path.join(ROOT, 'data/profile') } = {}) {
  const logPath = path.join(ROOT, 'logs', `${mode}-helper.log`);
  const log = fs.createWriteStream(logPath, { flags: 'a' });
  log.write(`\n--- ${new Date().toISOString()} ---\n`);
  const helper = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(ROOT, 'scripts', 'launch-game.ps1'), '-Mode', mode], {
    cwd: ROOT, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, FORTNITE_LAUNCHER_MULTIPLAYER: multiplayer ? '1' : '0', LAUNCHER_GAME_HOST: gameHost, LAUNCHER_PROFILE_DIR: profileDirectory,
      FORTNITE_LAUNCHER_SHOWDOWN: mode === 'server' && gameMode === 'infinity' ? '1' : '0',
      FORTNITE_LAUNCHER_THANOS: mode === 'server' && gameMode === 'thanos' ? '1' : '0' }
  });
  const label = mode === 'server' ? 'Game server' : 'Fortnite';
  const readiness = createReadiness(mode, onPhase, () => new Error(label + ' could not start. See logs/' + mode + '-helper.log.'));
  log.on('error', () => { readiness.fail(); helper.kill(); });
  const lines = createInterface({ input: helper.stdout });
  helper.stdout.pipe(log, { end: false });
  helper.stderr.pipe(log, { end: false });
  lines.on('line', line => readiness.line(line));
  helper.once('error', cause => { log.write(cause.message + '\n'); readiness.fail(); });
  const closed = new Promise(resolve => helper.once('close', (code, signal) => {
    lines.close(); log.end(); readiness.fail();
    resolve({ code, signal });
  }));
  return {
    ready: readiness.ready, closed,
    async stop() {
      if (helper.exitCode === null && helper.signalCode === null) helper.kill();
      await closed;
    }
  };
}
