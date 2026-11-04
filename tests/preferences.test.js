import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {writePreferences} from '../desktop/preferences.mjs';
import {pendingUpdateIsRunning} from '../desktop/update-install.mjs';

test('preference replacement preserves the previous file on partial writes or rename failure',t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'nova-preferences-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const file=path.join(root,'settings.json'),old={gamePath:'D:/My Fortnite',autoSprint:false};
  writePreferences(file,old);
  for(const operation of ['writeFileSync','fsyncSync','renameSync']) {
    const io={...fs,[operation](...args){if(operation==='writeFileSync')fs.writeFileSync(args[0],'{partial');throw Object.assign(new Error('simulated disk failure'),{code:'ENOSPC'});}};
    assert.throws(()=>writePreferences(file,{gamePath:'D:/Other'}, {io}),/disk failure/);
    assert.deepEqual(JSON.parse(fs.readFileSync(file,'utf8')),old);
    assert.deepEqual(fs.readdirSync(root),['settings.json']);
  }
  const updated={...old,host:'25.1.2.3'};writePreferences(file,updated);
  assert.deepEqual(JSON.parse(fs.readFileSync(file,'utf8')),updated);
});

test('stale update markers cannot suppress startup using an unrelated reused process ID',async()=>{
  const now=Date.now(),target='C:/NOVA DROP.exe',helperStarted=new Date(now-2000).toISOString();
  const pending={target,pid:1234,startedAt:now-1000,helperStarted};
  assert.equal(await pendingUpdateIsRunning(pending,target,{now,processStarted:async()=>helperStarted}),true);
  assert.equal(await pendingUpdateIsRunning(pending,target,{now,processStarted:async()=>new Date(now).toISOString()}),false);
  assert.equal(await pendingUpdateIsRunning(pending,target,{now,processStarted:async()=>{throw Error('Process exited');}}),false);
  for(const bad of [null,{...pending,helperStarted:undefined},{...pending,target:'D:/Other.exe'},{...pending,startedAt:now+1},{...pending,startedAt:now-900000},{...pending,pid:-1}])
    assert.equal(await pendingUpdateIsRunning(bad,target,{now,processStarted:async()=>{throw Error('Must not query invalid markers');}}),false);
});
