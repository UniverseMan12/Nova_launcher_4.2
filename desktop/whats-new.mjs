import fs from 'node:fs';
import path from 'node:path';
import {isNewer, versionParts} from './updates.mjs';

export const changes = Object.freeze([
  {title:'Auto-Sprint is now clearly a beta', text:'Off by default, with a warning before every enable. Existing unconfirmed settings return to off. Movement glitches are still being investigated.'},
  {title:'Thanos and respawn fixes', text:'Upright resets restore compatible body parts; respawn-mode kills count once. Repeated transformations and multiplayer scoring still need an in-game check.'},
  {title:'Your outfit, in the match', text:'Selected outfits and equipment carry into the match. Black Knight and Cloud Strike passed the local check; multiplayer still needs testing.'},
  {title:'Separate Fortnite 4.2 settings', text:'The host and player keep their own settings. Game crashes are reported instead of showing a normal end to the session. The HUD Apply crash still needs testing.'},
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
