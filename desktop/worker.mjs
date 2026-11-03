import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { prepareWorkspace } from './bootstrap.mjs';
import { validateOptions } from './options.mjs';

const controller = new AbortController();
const send = value => { if (process.connected) process.send(value); };
const status = (message, state = 'info') => send({ type: 'status', message, state });
let started = false;
process.on('disconnect', () => controller.abort());
process.on('message', async message => {
  if (message.type === 'stop') { controller.abort(); return; }
  if (message.type !== 'start' || started) return;
  started = true;
  try {
    const options = validateOptions(message.options);
    status('Checking your installation...', 'pending');
    let root = message.root;
    if (message.payload) {
      status('Preparing launcher files...', 'pending');
      root = await prepareWorkspace(message.payload, message.workspace, controller.signal);
      process.env.FORTNITE_LAUNCHER_BUNDLED = '1';
    }
    send({ type: 'workspace', root });
    const module = name => import(pathToFileURL(path.join(root, name)).href);
    if (message.action === 'download') {
      if (!message.payload) {
        const {prepareExtractor} = await module('scripts/prepare-extractor.mjs');
        await prepareExtractor({signal:controller.signal});
      }
      const { installGame } = await module('src/game-install.js');
      let lastUpdate = 0, lastStage;
      status('Downloading Fortnite 4.2. You can cancel and resume in the same location.', 'pending');
      const gamePath = await installGame(options.gamePath,{signal:controller.signal,progress:value=>{
        const now = Date.now();
        if (value.stage !== lastStage || now-lastUpdate >= 200 || value.received === value.total) {
          send({type:'download-progress',progress:value}); lastUpdate = now; lastStage = value.stage;
        }
      }});
      send({type:'installed',gamePath});
      status('Fortnite 4.2 installed and selected. Ready to launch.', 'ok');
      send({type:'done',cancelled:false});
      return;
    }
    const { prepareConfig, readConfig, saveConfig } = await module('src/config.js');
    const { parseJoinTarget, multiplayerName, hostAddresses } = await module('src/multiplayer.js');
    const { setup, verifyDll } = await module('scripts/setup.js');
    const { startBackend } = await module('src/backend.js');
    const { startGame } = await module('src/game.js');
    const { runSession } = await module('src/session.js');
    controller.signal.throwIfAborted();
    const host = message.action === 'launch' && options.mode === 'join' ? parseJoinTarget(options.host) : '127.0.0.1';
    const old = readConfig();
    const config = prepareConfig(options.gamePath, old);
    config.multiplayerName = /^Player_[a-f0-9]{12}$/.test(message.playerName ?? '') ? message.playerName : multiplayerName(old);
    if (options.mode !== 'solo') config.username = config.multiplayerName;
    saveConfig(config);
    send({ type: 'config', version: config.version, gamePath: config.gamePath });
    status(`Fortnite ${config.version} verified`, 'ok');
    if (message.action === 'check') {
      for (const name of ['sinum.dll', 'console.dll', 'memory.dll', 'reboot.dll']) {
        try { verifyDll(name); status(`${name}: verified`, 'ok'); }
        catch { status(`${name}: not ready. Use Prepare components.`, 'warning'); }
      }
    } else {
      status('Preparing components...', 'pending');
      await setup({ quiet: true, signal: controller.signal });
      controller.signal.throwIfAborted();
      status('Components ready', 'ok');
      if (message.action === 'launch') {
        const profileDirectory = path.join(message.workspace ? path.dirname(message.workspace) : path.join(root, 'data'), 'profile');
        await runSession({
          startBackend: () => startBackend({ gameHost: host, signal: controller.signal, autoSprint: options.autoSprint,
            profileDirectory, legacyWorkspaces: message.workspace, currentWorkspace: root }),
          startGame: (mode, phase) => startGame(mode, phase, { multiplayer: options.mode !== 'solo', gameHost: host, gameMode: options.gameMode, autoSprint: options.autoSprint, profileDirectory }),
          join: options.mode === 'join', signal: controller.signal,
          status: (text, state) => status(text.replace('Ctrl+C stops everything.', 'Use Stop session to close the game.'), state),
          onHostReady: () => { if (options.mode === 'host') send({ type: 'addresses', addresses: hostAddresses() }); }
        });
      }
    }
    send({ type: 'done', cancelled: controller.signal.aborted });
  } catch (error) {
    if (controller.signal.aborted) send({ type: 'done', cancelled: true });
    else send({ type: 'failure', message: error.message });
  } finally { if (process.connected) process.disconnect(); }
});
