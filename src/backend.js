import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { ROOT } from './config.js';
import { prepareLocker } from './locker.js';
import { inputHotfix } from './input-settings.js';
import inputSettings from '../scripts/backend-extensions/launcher-input.cjs';
import { validateHost } from './multiplayer.js';

export async function assertFreePort(port) {
  await new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', () => reject(new Error(`Port ${port} is already in use. Close the other service or the second backend instance.`)));
    probe.listen(port, '127.0.0.1', () => probe.close(resolve));
  });
}
export async function startBackend({ port = 3551, xmppPort = 80, gameHost = '127.0.0.1', directory = path.join(ROOT, 'vendor', 'LawinServer'), autoSprint = false, profileDirectory = path.join(ROOT, 'data/profile'), legacyWorkspaces, currentWorkspace = ROOT, settingsRoot, signal } = {}) {
  signal?.throwIfAborted();
  if (gameHost !== '127.0.0.1') gameHost = validateHost(gameHost);
  await assertFreePort(port); await assertFreePort(xmppPort);
  signal?.throwIfAborted();
  if (autoSprint === true) {
    const localData = settingsRoot || process.env.LOCALAPPDATA;
    const file = localData ? path.join(localData,'LawinServer/ClientSettings/ClientSettings-4072250.Sav') : path.join(directory,'ClientSettings/ClientSettings-4072250.Sav');
    try { inputSettings.read(file, true); }
    catch (error) { throw new Error(`Auto-Sprint could not prepare your Fortnite 4.2 controls: ${error.message} Turn Auto-Sprint off in Settings to launch with your existing controls.`); }
  }
  prepareLocker(profileDirectory, {workspaces:legacyWorkspaces, current:currentWorkspace, backend:directory});
  const inputFile = path.join(directory, 'CloudStorage/DefaultInput.ini');
  fs.writeFileSync(inputFile, inputHotfix(fs.readFileSync(inputFile, 'utf8'), autoSprint === true));
  fs.mkdirSync(path.join(ROOT, 'logs'), { recursive: true });
  const log = fs.createWriteStream(path.join(ROOT, 'logs', 'backend.log'), { flags: 'a' });
  log.write(`\n--- ${new Date().toISOString()} ---\n`);
  const child = spawn(process.execPath, ['index.js'], {
    cwd: directory, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PORT: String(port), XMPP_PORT: String(xmppPort), LAUNCHER_GAME_HOST: gameHost, LAUNCHER_AUTO_SPRINT: autoSprint === true ? '1' : '0', LAUNCHER_PROFILE_DIR: profileDirectory, ...(settingsRoot ? {LOCALAPPDATA:settingsRoot} : {}) }
  });
  let error;
  child.on('error', e => { error = e; });
  log.on('error', e => { error = new Error(`Could not write backend log: ${e.message}`); child.kill(); });
  child.stdout.pipe(log, { end: false }); child.stderr.pipe(log, { end: false });
  // Register before startup can fail: an ENOENT child can close before stop()
  // is reached, and waiting for a second close event would hang cancellation.
  let closed = false;
  const closure = new Promise(resolve => child.once('close', () => { closed = true; log.end(); resolve(); }));
  const stop = async () => {
    if (!closed && child.exitCode === null && child.signalCode === null) child.kill();
    await closure;
  };
  try {
    for (let attempt = 0; attempt < 100; attempt++) {
      signal?.throwIfAborted();
      if (error) throw error;
      if (child.exitCode !== null) throw new Error('The backend stopped. See logs/backend.log for details.');
      try {
        const response = await fetch(`http://127.0.0.1:${port}/local/health`, { signal: AbortSignal.timeout(500) });
        const status = await response.json();
        if (response.ok && status.service === 'fortnite-backend-local' && status.ready) return { child, stop, url: `http://127.0.0.1:${port}` };
      } catch {}
      await delay(100, undefined, { signal });
    }
    throw new Error('The backend did not become ready in time. See logs/backend.log for details.');
  } catch (error) { await stop(); throw error; }
}
