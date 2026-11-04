// Harmless regression fixture: the actual spawning process exits during handoff.
// Removing consent first prevents replacement or execution of either dummy EXE.
import fs from 'node:fs';
import path from 'node:path';
import {launchUpdateHelper} from '../../desktop/update-install.mjs';
import {fileHash} from '../../desktop/updates.mjs';

const cache=process.argv[2];
const target=path.join(cache,'old.exe'),file=path.join(cache,'new.exe');
await launchUpdateHelper({file,target,cache,sha256:await fileHash(file),version:'0.4.5',kind:'portable',
  helperSource:path.resolve('desktop/install-update.ps1'),quit:()=>{
    const consent=fs.readdirSync(cache).filter(name=>name.endsWith('.json.apply'));
    if(consent.length!==1)throw new Error('Expected exactly one fixture handoff.');
    fs.unlinkSync(path.join(cache,consent[0]));
    fs.writeFileSync(path.join(cache,'parent-exited.json'),JSON.stringify({pid:process.pid}));
    process.exit(0);
  }});
throw new Error('Fixture parent should exit during handoff.');
