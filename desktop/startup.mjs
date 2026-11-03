import fs from 'node:fs';
import path from 'node:path';

// Explicit opt-in: normal Windows launches retain hardware acceleration.
export function configureCompatibility(app, argv = process.argv) {
  const crossover = argv.includes('--crossover');
  if (crossover) app.disableHardwareAcceleration();
  return crossover;
}

export function createStartupLog(directory) {
  const file = path.join(directory, 'startup.log');
  const limit = 1024 * 1024;
  let bytes = 0;
  const write = (event, details = {}) => {
    try {
      fs.mkdirSync(directory, { recursive: true });
      const line = JSON.stringify({ time: new Date().toISOString(), event, ...details }) + '\n';
      // Bound both a noisy run and accumulated logs. Logging must never block startup.
      if (bytes + Buffer.byteLength(line) > limit) return;
      if (fs.existsSync(file) && fs.statSync(file).size + Buffer.byteLength(line) > limit) {
        fs.copyFileSync(file, file + '.previous');
        fs.writeFileSync(file, '');
      }
      fs.appendFileSync(file, line);
      bytes += Buffer.byteLength(line);
    } catch (error) { console.error('Startup log unavailable:', error.message); }
  };
  return { file, write };
}

// A renderer that never finishes loading must not leave an invisible instance alive.
export async function loadWindow(window, url, log, timeoutMs = 45000) {
  let timer;
  let rejectFailure;
  const failure = new Promise((_, reject) => { rejectFailure = reject; });
  const gone = (_event, details) => rejectFailure(new Error(`Renderer stopped during startup: ${details.reason}`));
  const closed = () => rejectFailure(new Error('Launcher window closed during startup.'));
  window.webContents.on('render-process-gone', gone);
  window.once('closed', closed);
  try {
    timer = setTimeout(() => rejectFailure(new Error('The launcher interface did not finish loading within 45 seconds.')), timeoutMs);
    log('loading-interface');
    await Promise.race([window.loadURL(url), failure]);
    log('interface-loaded');
  } finally {
    clearTimeout(timer);
    window.webContents.removeListener('render-process-gone', gone);
    window.removeListener('closed', closed);
  }
}
