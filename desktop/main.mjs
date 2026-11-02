import { app, BrowserWindow, ipcMain, dialog, shell, clipboard } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { validateOptions, normalizeSettings, links } from './options.mjs';
import { configureCompatibility, createStartupLog, loadWindow } from './startup.mjs';

const crossover = configureCompatibility(app);

const directory = path.dirname(fileURLToPath(import.meta.url));
const uiURL = pathToFileURL(path.join(directory, 'ui', 'index.html')).href;
app.setPath('userData', process.env.LAUNCHER_TEST_DATA || path.join(app.getPath('appData'), 'FortniteLauncher'));
const startupLog = createStartupLog(app.getPath('userData'));
let window, worker, workspace = path.resolve(directory, '..'), closing = false, finished = Promise.resolve();
let choosingDownloadFolder = false;
const state = { busy: false, phase: 'idle', message: 'Ready when you are.', events: [], addresses: [], progress: null, installedPath: null, version: app.getVersion() };
const settingsPath = () => path.join(app.getPath('userData'), 'settings.json');
function settings() {
  try { return normalizeSettings(JSON.parse(fs.readFileSync(settingsPath(), 'utf8'))); } catch {}
  if (!app.isPackaged && !process.env.LAUNCHER_TEST_DATA) {
    try { return normalizeSettings({ ...JSON.parse(fs.readFileSync(path.join(workspace, 'config.local.json'), 'utf8')), mode: 'solo', host: '' }); } catch {}
  }
  return { mode: 'solo', gamePath: '', host: '' };
}
function emit(event) {
  if (event.type === 'download-progress') state.progress = event.progress;
  if (event.type === 'status' || event.type === 'failure') {
    state.message = event.message;
    state.events.push({ ...event, time: new Date().toISOString() });
    state.events = state.events.slice(-150);
    if (event.type === 'failure') { state.phase = 'error'; state.addresses = []; }
  }
  if (event.type === 'addresses') state.addresses = event.addresses;
  if (event.type === 'workspace') workspace = event.root;
  if (event.type === 'config' || event.type === 'installed') {
    const saved = settings(); saved.gamePath = event.gamePath;
    fs.writeFileSync(settingsPath(), JSON.stringify(saved));
    if (event.type === 'installed') state.installedPath = event.gamePath;
  }
  if (event.type === 'done') { state.addresses = []; state.phase = event.cancelled ? 'idle' : 'complete'; state.message = state.action === 'download' ? event.cancelled ? 'Installation cancelled. Choose the same location to resume the download.' : 'Fortnite 4.2 installed. Ready to launch.' : event.cancelled ? 'Session stopped.' : 'All done. Ready for your next drop.'; }
  if (window && !window.isDestroyed()) window.webContents.send('launcher:state', structuredClone(state));
}
async function stop() {
  if (worker?.connected) { state.phase = 'stopping'; emit({ type: 'status', message: state.action === 'download' ? 'Stopping the installation...' : 'Stopping your session...', state: 'pending' }); worker.send({ type: 'stop' }); }
  await finished;
}
function start(action, input, allowDownload = false) {
  if (state.busy) throw new Error('A session is already running. Stop it before starting another.');
  if (!['launch', 'check', 'prepare'].includes(action) && !(allowDownload && action === 'download')) throw new Error('Unknown action.');
  const options = validateOptions(input);
  fs.mkdirSync(app.getPath('userData'), { recursive: true });
  const previous = settings();
  const playerName = /^Player_[a-f0-9]{12}$/.test(previous.multiplayerName ?? '') ? previous.multiplayerName : `Player_${randomBytes(6).toString('hex')}`;
  fs.writeFileSync(settingsPath(), JSON.stringify({ ...(action === 'download' ? previous : options), multiplayerName: playerName }));
  state.busy = true; state.phase = action; state.action = action; state.events = []; state.addresses = []; state.progress = null; state.installedPath = null;
  emit({ type: 'status', message: 'Getting things ready...', state: 'pending' });
  const logPath = path.join(app.getPath('userData'), 'launcher.log');
  const log = fs.createWriteStream(logPath, { flags: 'a' });
  log.on('error', error => emit({ type: 'failure', message: `Could not write the launcher log: ${error.message}` }));
  worker = spawn(process.execPath, [app.isPackaged ? path.join(process.resourcesPath, 'worker', 'worker.mjs') : path.join(directory, 'worker.mjs')], {
    cwd: app.getPath('userData'), windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe', 'ipc'], env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }
  });
  worker.stdout.pipe(log, { end: false }); worker.stderr.pipe(log, { end: false });
  let result = false;
  worker.on('message', event => { if (['done', 'failure'].includes(event.type)) result = true; emit(event); });
  worker.on('error', error => { result = true; emit({ type: 'failure', message: error.message }); });
  finished = new Promise(resolve => worker.once('close', () => {
    log.end(); worker = null; state.busy = false;
    if (!result) emit({ type: 'failure', message: 'The session helper stopped unexpectedly. Open logs for details.' });
    else emit({ type: 'settled' });
    resolve();
  }));
  worker.send({ type: 'start', action, options, playerName, root: path.resolve(directory, '..'),
    payload: app.isPackaged ? path.join(process.resourcesPath, 'payload') : undefined,
    workspace: path.join(app.getPath('userData'), 'workspaces') });
  return true;
}
function handle(name, callback) {
  ipcMain.handle(`launcher:${name}`, async (event, ...args) => {
    if (!window || event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame || event.senderFrame.url !== uiURL) throw new Error('Untrusted request.');
    try { return { ok: true, value: await callback(...args) }; }
    catch (error) { return { ok: false, error: error.message }; }
  });
}
if (!app.requestSingleInstanceLock()) { app.quit(); }
else {
  startupLog.write('starting', { version: app.getVersion(), electron: process.versions.electron, platform: process.platform, arch: process.arch, crossover });
  app.on('child-process-gone', (_event, details) => startupLog.write('child-process-gone', { type: details.type, reason: details.reason, exitCode: details.exitCode }));
  app.on('second-instance', () => { if (window?.isMinimized()) window.restore(); window?.show(); window?.focus(); });
  app.on('before-quit', event => {
    if (worker && !closing) { event.preventDefault(); closing = true; stop().finally(() => app.quit()); }
  });
  app.whenReady().then(async () => {
  app.setAppUserModelId('com.universeman.fortnitelauncher');
  handle('initial', () => ({ ...state, settings: settings(), packaged: app.isPackaged }));
  handle('browse', async () => {
    const result = await dialog.showOpenDialog(window, { title: 'Select the folder containing FortniteGame and Engine', properties: ['openDirectory'] });
    return result.canceled ? null : result.filePaths[0];
  });
  handle('start', (action,input) => start(action,input));
  handle('downloadGame', async () => {
    if (state.busy || choosingDownloadFolder) throw new Error('Finish the current action before downloading the game.');
    choosingDownloadFolder = true;
    try {
      const result = await dialog.showOpenDialog(window,{title:'Choose where to create Fortnite-4.2 (about 32 GiB free required)',properties:['openDirectory','createDirectory']});
      if (result.canceled) return false;
      return start('download',{...settings(),mode:settings().mode || 'solo',gamePath:result.filePaths[0]},true);
    } finally { choosingDownloadFolder = false; }
  });
  handle('stop', stop);
  handle('saveSettings', input => {
    if (state.busy) return false;
    const previous = settings();
    const next = normalizeSettings(input);
    fs.mkdirSync(app.getPath('userData'), {recursive:true});
    fs.writeFileSync(settingsPath(), JSON.stringify({...next, multiplayerName:previous.multiplayerName}));
    return true;
  });
  handle('copyInvite', address => {
    if (!state.busy || state.phase === 'stopping' || !state.addresses.some(item => item.address === address)) throw new Error('Start hosting before copying an invitation.');
    clipboard.writeText(`FN42:${address}`);
    return true;
  });
  handle('link', key => { if (!Object.hasOwn(links, key)) throw new Error('Unknown link.'); return shell.openExternal(links[key]); });
  handle('logs', async () => {
    const folder = fs.existsSync(path.join(workspace, 'logs')) ? path.join(workspace, 'logs') : app.getPath('userData');
    const error = await shell.openPath(folder); if (error) throw new Error(error);
  });
  handle('minimize', () => window.minimize());
  handle('close', () => window.close());
  window = new BrowserWindow({ width: 1200, height: 820, minWidth: 940, minHeight: 700, backgroundColor: '#0b0c12', title: 'NOVA DROP',
    icon: app.isPackaged ? path.join(process.resourcesPath, 'icon.png') : path.join(directory, '..', 'build', 'icon.png'),
    autoHideMenuBar: true, frame: false, show: crossover,
    webPreferences: { preload: path.join(directory, 'preload.cjs'), contextIsolation: true, sandbox: true, nodeIntegration: false, webSecurity: true } });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', event => event.preventDefault());
  window.webContents.session.setPermissionRequestHandler((_wc, _permission, done) => done(false));
  window.webContents.session.setPermissionCheckHandler(() => false);
  window.webContents.on('preload-error', (_event, _file, error) => startupLog.write('preload-error', { message: error.message }));
  window.webContents.on('did-fail-load', (_event, code, description, _url, mainFrame) => startupLog.write('did-fail-load', { code, description, mainFrame }));
  window.webContents.on('render-process-gone', (_event, details) => startupLog.write('render-process-gone', { reason: details.reason, exitCode: details.exitCode }));
  window.on('unresponsive', () => startupLog.write('window-unresponsive'));
  window.on('close', event => { if (worker) { event.preventDefault(); if (!closing) { closing = true; stop().finally(() => window.destroy()); } } });
  app.on('window-all-closed', () => app.quit());
  await loadWindow(window, uiURL, startupLog.write);
  window.show();
  }).catch(error => {
    startupLog.write('startup-failed', { message: error.message });
    console.error(error);
    // Closing during startup is deliberate; do not reopen a dialog for that case.
    if (!window?.isDestroyed()) dialog.showErrorBox('NOVA DROP could not start', `${error.message}\n\nDiagnostics: ${startupLog.file}`);
    app.exit(1);
  });
}
