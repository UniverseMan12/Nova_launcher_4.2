import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import locker from '../scripts/backend-extensions/launcher-locker.cjs';
import {prepareLocker} from '../src/locker.js';

const profile = () => ({stats:{attributes:{favorite_character:'knight',favorite_glider:'umbrella',favorite_dance:['wave','','','','',''],level:999}},items:{knight:{attributes:{variants:[{channel:'Color',active:'Blue'}]}},umbrella:{},wave:{}}});
test('locker persistence keeps selected cosmetics and variants without replacing progression or catalog', () => {
  const selected=locker.extract(profile()), updated=profile(); updated.stats.attributes.level=1; updated.items.newItem={};
  locker.restore(updated,selected);
  assert.equal(updated.stats.attributes.favorite_character,'knight');
  assert.deepEqual(updated.stats.attributes.favorite_dance,['wave','','','','','']);
  assert.deepEqual(updated.items.knight.attributes.variants,[{channel:'Color',active:'Blue'}]);
  assert.equal(updated.stats.attributes.level,1); assert.ok(updated.items.newItem);
  delete updated.items.knight; updated.stats.attributes.favorite_character=''; locker.restore(updated,selected);
  assert.equal(updated.stats.attributes.favorite_character,'','Removed cosmetics do not create invalid selections');
});
test('first launch after update migrates a previous locker once and never overwrites it with defaults', t => {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'locker-migration-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const workspaces=path.join(root,'workspaces'), old=path.join(workspaces,'a'.repeat(16)), current=path.join(workspaces,'b'.repeat(16)), persistent=path.join(root,'profile');
  const backend=path.join(current,'vendor/LawinServer');
  fs.mkdirSync(path.join(old,'vendor/LawinServer/profiles'),{recursive:true});fs.writeFileSync(path.join(old,'.complete'),'verified');
  fs.writeFileSync(path.join(old,'vendor/LawinServer/profiles/athena.json'),JSON.stringify(profile()));
  fs.utimesSync(path.join(old,'.complete'),new Date(1000),new Date(1000));
  const unused=path.join(workspaces,'c'.repeat(16));fs.mkdirSync(path.join(unused,'vendor/LawinServer/profiles'),{recursive:true});
  fs.writeFileSync(path.join(unused,'vendor/LawinServer/profiles/athena.json'),JSON.stringify({stats:{attributes:{favorite_character:''}},items:{}}));
  fs.writeFileSync(path.join(unused,'.complete'),'verified');
  fs.utimesSync(path.join(unused,'vendor/LawinServer/profiles/athena.json'),new Date(2000),new Date(2000));
  fs.mkdirSync(path.join(backend,'profiles'),{recursive:true});fs.writeFileSync(path.join(backend,'profiles/athena.json'),JSON.stringify({stats:{attributes:{favorite_character:''}},items:{}}));
  prepareLocker(persistent,{workspaces,current,backend});
  const saved=JSON.parse(fs.readFileSync(path.join(persistent,'locker.json')));assert.equal(saved.selected.favorite_character,'knight');
  prepareLocker(persistent,{workspaces,current,backend});assert.deepEqual(JSON.parse(fs.readFileSync(path.join(persistent,'locker.json'))),saved);
});
