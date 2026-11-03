import fs from 'node:fs';
import path from 'node:path';
import {isNewer, versionParts} from './updates.mjs';

export const changes = Object.freeze([
  {title:'Move your way', text:'Auto-Sprint is now in Settings. Hold W to sprint; turn it off to return to your previous sprint controls.'},
  {title:'A proper fresh start', text:'New Full reset and Clear inventory tools in Reboot, plus clearer console commands. Full reset removes the Thanos transformation.'},
  {title:'Keep your look', text:'Your locker choices carry into matches and stay saved across launcher updates, including outfits, gliders and emotes.'},
  {title:'One Thanos card. Two ways to play.', text:'Choose Thanos normal or Infinity Showdown from one card. Larger text and a lighter visual refresh make the launcher easier to read.'},
  {title:'Small fixes that matter', text:'Corrected saved-settings downloads and protected reset actions from stale character references.'}
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
