import fs from 'node:fs';
import path from 'node:path';
import {isNewer, versionParts} from './updates.mjs';

export const changes = Object.freeze([
  {title:'Auto-Sprint — second test', text:'Separate movement and sprint inputs. Please check repeated starts, stops and gliding. The HUD-scale Apply crash is still under investigation.'},
  {title:'Your outfit, in the match', text:'Black Knight, Cloud Strike and the selected pickaxe appeared in the local test. Multiplayer loadouts still need a separate check.'},
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
