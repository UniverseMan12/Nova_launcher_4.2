import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import input from '../scripts/backend-extensions/launcher-input.cjs';
import {inputHotfix} from '../src/input-settings.js';

test('W sprint uses hold mode and returns custom sprint controls byte for byte', () => {
  for (const key of ['None','RightShift','LeftControl','W']) for (const toggle of [true,false]) {
    const original = input.rewrite(input.seed(), {key,toggle});
    const enabled = input.autoSprint(original), parsed = input.parse(enabled);
    assert.equal(parsed.sprint[0].value, 'W'); assert.equal(enabled[parsed.toggle.boolOffset], 0);
    assert.deepEqual(input.restorePreferences(enabled, original), original);
    assert.deepEqual(input.autoSprint(enabled), enabled);
  }
  const defaultSave = input.autoSprint(null), parsed = input.parse(defaultSave);
  assert.deepEqual(input.restorePreferences(defaultSave,null),input.seed(),'An unknown default toggle is not replaced by a guessed preference');
  assert.equal(parsed.sprint[0].value,'W'); assert.equal(defaultSave[parsed.toggle.boolOffset],0);
});

test('malformed or other game settings fail without replacing a saved file', t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(),'sprint-settings-')); t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
  const file = path.join(directory,'settings.sav'), original = input.seed(); fs.writeFileSync(file,original);
  for (const bytes of [Buffer.alloc(0), original.subarray(0,100), Buffer.concat([original,Buffer.from([1])])]) {
    assert.throws(()=>input.write(file,bytes,true)); assert.deepEqual(fs.readFileSync(file), original);
  }
  const wrongBuild=Buffer.from(original); wrongBuild.writeUInt32LE(9999999,14); assert.throws(()=>input.autoSprint(wrongBuild),/Unsupported/);
  const corrupt=Buffer.from(original); corrupt.writeUInt32LE(0x7fffffff,input.parse(original).array.sizeOffset);
  assert.throws(()=>input.autoSprint(corrupt),/Truncated/);
});

test('sprint hotfix toggles without accumulating mappings or changing F8', () => {
  const original='[/Script/Engine.InputSettings]\n+ConsoleKeys=F8\n';
  const enabled=inputHotfix(original,true);
  assert.match(enabled,/ActionName="Sprint",Key=W/); assert.match(enabled,/ConsoleKeys=F8/);
  assert.equal(inputHotfix(enabled,true), enabled); assert.equal(inputHotfix(enabled,false),original);
});
