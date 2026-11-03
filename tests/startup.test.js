import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { configureCompatibility, createStartupLog, loadWindow } from '../desktop/startup.mjs';

test('Windows defaults keep GPU acceleration; only the exact CrossOver flag opts in', () => {
  let disabled = 0;
  const app = { disableHardwareAcceleration() { disabled++; } };
  for (const args of [[], ['NOVA DROP.exe'], ['--crossover=false'], ['C:/crossover/game']]) {
    assert.equal(configureCompatibility(app, args), false);
  }
  assert.equal(disabled, 0);
  assert.equal(configureCompatibility(app, ['NOVA DROP.exe', '--crossover']), true);
  assert.equal(disabled, 1);
});

function fakeWindow(loadURL) {
  const window = new EventEmitter();
  window.webContents = new EventEmitter();
  window.loadURL = loadURL;
  return window;
}

test('interface loading succeeds normally and reports a rejected load', async () => {
  const events = [];
  const window = fakeWindow(async url => { assert.equal(url, 'file:///ui.html'); });
  await loadWindow(window, 'file:///ui.html', event => events.push(event));
  assert.deepEqual(events, ['loading-interface', 'interface-loaded']);
  assert.equal(window.webContents.listenerCount('render-process-gone'), 0);
  await assert.rejects(loadWindow(fakeWindow(async () => { throw new Error('Missing UI'); }), 'file:///ui.html', () => {}), /Missing UI/);
});

test('hung loads, renderer crashes and closing never leave startup waiting indefinitely', async () => {
  const hung = fakeWindow(() => new Promise(() => {}));
  await assert.rejects(loadWindow(hung, 'file:///ui.html', () => {}, 10), /did not finish loading/);
  const crashed = fakeWindow(() => new Promise(() => {}));
  const loading = loadWindow(crashed, 'file:///ui.html', () => {});
  crashed.webContents.emit('render-process-gone', {}, { reason: 'crashed' });
  await assert.rejects(loading, /Renderer stopped during startup: crashed/);
  assert.equal(crashed.listenerCount('closed'), 0);
  const closed = fakeWindow(() => new Promise(() => {}));
  const closing = loadWindow(closed, 'file:///ui.html', () => {});
  closed.emit('closed');
  await assert.rejects(closing, /window closed/);
});

test('startup diagnostics exist before any session and rotate without changing settings', t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'nova-startup-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  fs.writeFileSync(path.join(directory, 'settings.json'), '{"gamePath":"keep"}');
  const log = createStartupLog(directory);
  log.write('starting', { crossover: false });
  assert.equal(JSON.parse(fs.readFileSync(log.file, 'utf8')).event, 'starting');
  fs.writeFileSync(log.file, 'x'.repeat(1024 * 1024));
  log.write('interface-loaded');
  assert.equal(fs.statSync(log.file + '.previous').size, 1024 * 1024);
  assert.equal(JSON.parse(fs.readFileSync(log.file, 'utf8')).event, 'interface-loaded');
  assert.equal(fs.readFileSync(path.join(directory, 'settings.json'), 'utf8'), '{"gamePath":"keep"}');
});
