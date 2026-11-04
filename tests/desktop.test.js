import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { prepareWorkspace } from '../desktop/bootstrap.mjs';
import { validateOptions, normalizeSettings } from '../desktop/options.mjs';

test('corrupt saved settings recover without losing valid user selections', () => {
  for (const value of [null, 'broken', [], 42, {gamePath:[],host:{},mode:'invalid'}]) assert.deepEqual(normalizeSettings(value), {autoSprint:false,mode:'solo',gameMode:'classic',gamePath:'',host:''});
  assert.deepEqual(normalizeSettings({mode:'join',gamePath:'C:/game',host:'FN42:25.1.2.3',gameMode:'infinity',unknown:1}), {autoSprint:false,mode:'join',gameMode:'infinity',gamePath:'C:/game',host:'FN42:25.1.2.3'});
});

test('desktop launch requests reject unsupported actions and missing paths', () => {
  for (const value of [null, {}, { mode: 'shell', gamePath: 'C:/game' }, { mode: 'solo', gamePath: '' }]) assert.throws(() => validateOptions(value));
  assert.deepEqual(validateOptions({ mode: 'join', gamePath: ' C:/game ', host: ' 25.1.2.3 ', unexpected: true }), { autoSprint:false, mode: 'join', gamePath: 'C:/game', host: '25.1.2.3', gameMode: 'classic' });
  assert.equal(validateOptions({mode:'host',gamePath:'C:/game',gameMode:'infinity'}).gameMode,'infinity');
  assert.equal(validateOptions({mode:'solo',gamePath:'C:/game',gameMode:'thanos'}).gameMode,'thanos');
  assert.equal(normalizeSettings({gameMode:'thanos'}).gameMode,'thanos');
  assert.throws(()=>validateOptions({mode:'host',gamePath:'C:/game',gameMode:'anything'}),/Choose Classic/);
});

test('Auto-Sprint requires the current beta warning and legacy enabled profiles return to off', () => {
  const options={mode:'solo',gameMode:'classic',gamePath:'C:/game',host:'',autoSprint:true};
  for(const autoSprintBetaAcknowledged of [undefined,false,true,0,2,'1']) {
    assert.equal(normalizeSettings({...options,autoSprintBetaAcknowledged}).autoSprint,false);
    assert.throws(()=>validateOptions({...options,autoSprintBetaAcknowledged}),/experimental beta/);
  }
  const confirmed={...options,autoSprintBetaAcknowledged:1};
  assert.equal(normalizeSettings(confirmed).autoSprint,true);
  assert.equal(validateOptions(confirmed).autoSprintBetaAcknowledged,1);
  const disabled=normalizeSettings({...confirmed,autoSprint:false});
  assert.equal(disabled.autoSprint,false);
  assert.equal(disabled.autoSprintBetaAcknowledged,undefined,'Turning off clears acknowledgement so enabling asks again');
  assert.equal(normalizeSettings({...disabled,autoSprint:true}).autoSprint,false);
});

test('packaged workspace verifies payload integrity, rejects path traversal and recovers from interrupted setup', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'launcher-bundle-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const payload = path.join(root, 'payload'), destination = path.join(root, 'data');
  await fs.mkdir(payload);
  const hash = crypto.createHash('sha256').update('valid').digest('hex');
  await fs.writeFile(path.join(payload, 'runtime.txt'), 'damaged');
  await fs.writeFile(path.join(payload, 'payload.json'), JSON.stringify({ files: { 'runtime.txt': hash } }));
  await assert.rejects(prepareWorkspace(payload, destination), /Damaged installer/);
  await fs.writeFile(path.join(payload, 'runtime.txt'), 'valid');
  const workspace = await prepareWorkspace(payload, destination);
  assert.equal(await fs.readFile(path.join(workspace, 'runtime.txt'), 'utf8'), 'valid');
  await fs.writeFile(path.join(workspace, 'user-profile.json'), 'keep');
  assert.equal(await prepareWorkspace(payload, destination), workspace);
  assert.equal(await fs.readFile(path.join(workspace, 'user-profile.json'), 'utf8'), 'keep');
  const cachedAbort = new AbortController(); cachedAbort.abort();
  await assert.rejects(prepareWorkspace(payload, destination, cachedAbort.signal), /abort/i);
  await fs.writeFile(path.join(payload, 'payload.json'), JSON.stringify({ files: { '../outside': hash } }));
  await assert.rejects(prepareWorkspace(payload, destination), /Invalid bundled file path/);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(prepareWorkspace(payload, destination, controller.signal), /abort/i);
});
