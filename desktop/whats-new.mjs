import fs from 'node:fs';
import path from 'node:path';
import {isNewer, versionParts} from './updates.mjs';

export const changes = Object.freeze([
  {title:'Movement fixes — ready to test', text:'Updated Auto-Sprint handling for stopping and starting again. Please check movement on foot and while gliding.'},
  {title:'Your outfit, in the match', text:'The local player now reads the saved lobby outfit, glider and pickaxe. Friends retain their own loadouts.'},
  {title:'Character proportions', text:'Corrected the body-part layout and skeleton selection used when spawning and resetting out of Thanos.'},
  {title:'Practice tools retained', text:'Clear inventory and practice respawn remain available. This build needs an in-game check before the fixes are confirmed.'}
]);

export class WhatsNew {
  constructor({directory,version,existingSettings}) {
    if (!versionParts(version)) throw Error('Invalid launcher version.');
    this.file=path.join(directory,'release-history.json'); this.version=version;
    let previous;
    try { previous=JSON.parse(fs.readFileSync(this.file,'utf8')).seenVersion; } catch {}
    this.pending=versionParts(previous) ? isNewer(version,previous) : Boolean(existingSettings);
    if (!this.pending && !versionParts(previous)) this.acknowledge();
  }
  snapshot() { return {version:this.version,show:this.pending,changes}; }
  acknowledge() {
    fs.mkdirSync(path.dirname(this.file),{recursive:true});
    fs.writeFileSync(this.file+'.tmp',JSON.stringify({seenVersion:this.version}));
    fs.renameSync(this.file+'.tmp',this.file); this.pending=false; return true;
  }
}
