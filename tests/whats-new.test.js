import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {WhatsNew} from '../desktop/whats-new.mjs';

test('release notes appear once per upgrade, including migration from versions without history', t => {
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'release-history-'));t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
  const migrated=new WhatsNew({directory,version:'0.4.3',existingSettings:true});assert.equal(migrated.snapshot().show,true);
  assert.equal(new WhatsNew({directory,version:'0.4.3',existingSettings:true}).snapshot().show,true,'Not acknowledged yet');
  migrated.acknowledge();assert.equal(new WhatsNew({directory,version:'0.4.3',existingSettings:true}).snapshot().show,false);
  assert.equal(new WhatsNew({directory,version:'0.4.4',existingSettings:true}).snapshot().show,true);
  assert.equal(new WhatsNew({directory,version:'0.4.2',existingSettings:true}).snapshot().show,false,'Downgrades do not announce an update');
});
test('a fresh install records its version without interrupting setup', t => {
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'release-new-'));t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
  const fresh=new WhatsNew({directory,version:'0.4.3',existingSettings:false});assert.equal(fresh.snapshot().show,false);
  assert.ok(fresh.snapshot().changes.length);assert.equal(new WhatsNew({directory,version:'0.4.3',existingSettings:true}).snapshot().show,false);
});
