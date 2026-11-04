import fs from 'node:fs';
import path from 'node:path';
import {isNewer, versionParts} from './updates.mjs';

export const changes = Object.freeze([
  {title:'Smooth sprinting, with an optional beta', text:'Manual sprint and Auto-Sprint now pass the movement and gliding playtest. Auto-Sprint stays off by default, with a warning before enabling it in Settings.'},
  {title:'Thanos and full reset restored', text:'Transform into Thanos normally, then return to your chosen character with Full reset. Repeated resets passed the playtest; multiplayer scoring still needs a separate check.'},
  {title:'Your outfit, in the match', text:'Selected outfits and equipment carry into the match. Black Knight and Cloud Strike passed the local check; multiplayer still needs testing.'},
  {title:'More reliable game startup', text:'Portable relaunches keep the running launcher intact. Game-server startup is restored, and unexpected game exits show an error. HUD Scale / Apply passed the latest playtest.'},
  {title:'Updates checked again before installing', text:'Downloaded updates are checked against the current GitHub release. Withdrawn or changed packages are rejected, and saved launcher settings are protected during writes.'},
  {title:'A clearer Play screen', text:'Solo stays Solo when you choose Infinity Showdown. Thanos and Showdown share one card, with clearer selections and readable settings.'},
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
