import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

export const REPOSITORY = 'UniverseMan12/Nova_launcher_4.2';
export const LATEST_URL = `https://api.github.com/repos/${REPOSITORY}/releases/latest`;
const MAX_EXE = 512 * 1024 * 1024;
const headers = {'User-Agent':'NOVA-DROP-updater',Accept:'application/vnd.github+json'};

export function versionParts(value) {
  if (typeof value !== 'string' || !/^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(value)) return null;
  const parts=value.replace(/^v/,'').split('.').map(Number);
  return parts.every(Number.isSafeInteger) ? parts : null;
}
export function isNewer(candidate,current) {
  const a=versionParts(candidate),b=versionParts(current);
  if (!a || !b) return false;
  for(let i=0;i<3;i++) if(a[i]!==b[i]) return a[i]>b[i];
  return false;
}
function assetURL(url,tag,name) {
  const expected=`https://github.com/${REPOSITORY}/releases/download/${tag}/${name}`;
  if(url!==expected) throw new Error('The update download address is invalid.');
  return expected;
}
export function selectRelease(release,current,kind) {
  if(!['nsis','portable'].includes(kind)) throw new Error('Updates need an installed or portable Windows launcher.');
  if(!release || release.draft || release.prerelease || !versionParts(release.tag_name)) throw new Error('The update feed did not return a regular release.');
  if(!isNewer(release.tag_name,current)) return null;
  const version=release.tag_name.replace(/^v/,''),name=`NOVA-DROP-${version}-x64-${kind}.exe`;
  const assets=Array.isArray(release.assets)?release.assets:[];
  const pick=(filename,max)=>{
    const matches=assets.filter(a=>a.name===filename);
    if(matches.length!==1 || !Number.isSafeInteger(matches[0].size) || matches[0].size<1 || matches[0].size>max) throw new Error('This release is missing a complete update package. Try again later.');
    return {name:filename,size:matches[0].size,url:assetURL(matches[0].browser_download_url,release.tag_name,filename)};
  };
  return {version,tag:release.tag_name,asset:pick(name,MAX_EXE),checksums:pick('SHA256SUMS.txt',65536)};
}
export function checksumFor(text,name) {
  const matches=text.replace(/^\uFEFF/,'').split(/\r?\n/).map(line=>/^([a-f0-9]{64}) [ *](.+)$/i.exec(line)).filter(m=>m && m[2]===name);
  if(matches.length!==1) throw new Error('The release does not contain one valid checksum for this launcher.');
  return matches[0][1].toLowerCase();
}
async function boundedResponse(response,limit,signal) {
  if(!response.ok) {
    await response.body?.cancel();
    throw new Error([403,429].includes(response.status)?'GitHub is limiting update checks. Please try again later.':`Update service returned HTTP ${response.status}. Please try again later.`);
  }
  if(Number(response.headers.get('content-length'))>limit) {await response.body?.cancel();throw new Error('The update response is too large.');}
  const parts=[];let length=0;
  for await(const chunk of response.body) {signal?.throwIfAborted();length+=chunk.length;if(length>limit)throw new Error('The update response is too large.');parts.push(chunk);}
  return Buffer.concat(parts);
}
export async function fileHash(file) {
  const handle=await fs.open(file,'r');
  try {const hash=crypto.createHash('sha256');for await(const chunk of handle.createReadStream({autoClose:false}))hash.update(chunk);return hash.digest('hex');}
  finally {await handle.close();}
}
export async function downloadUpdate(release,destination,{fetchImpl=fetch,signal,onProgress=()=>{}}={}) {
  const temporary=destination+'.'+crypto.randomUUID()+'.part';
  let handle;
  try {
    const response=await fetchImpl(release.asset.url,{signal});
    if(!response.ok) {await response.body?.cancel();throw new Error(`Update download failed (HTTP ${response.status}). Try again.`);}
    const length=response.headers.get('content-length');
    if(length!==null && Number(length)!==release.asset.size) {await response.body?.cancel();throw new Error('The update download size does not match the release.');}
    handle=await fs.open(temporary,'wx');let received=0,lastProgress=0;const hash=crypto.createHash('sha256');
    for await(const chunk of response.body) {
      signal?.throwIfAborted();received+=chunk.length;
      if(received>release.asset.size || received>MAX_EXE) throw new Error('The update download is larger than expected.');
      await handle.writeFile(chunk);hash.update(chunk);
      if(Date.now()-lastProgress>=100 || received===release.asset.size){onProgress({received,total:release.asset.size});lastProgress=Date.now();}
    }
    signal?.throwIfAborted();
    if(received!==release.asset.size || hash.digest('hex')!==release.sha256) throw new Error('Update verification failed. Download it again.');
    await handle.sync();await handle.close();handle=undefined;
    // Only this update cache file is replaced; never the running launcher.
    await fs.rename(temporary,destination);
    return destination;
  } finally {await handle?.close();await fs.rm(temporary,{force:true});}
}
export class LauncherUpdates {
  constructor({currentVersion,kind,cache,enabled=true,fetchImpl=fetch,onState=()=>{},canInstall=()=>true,install=async()=>{}}) {
    Object.assign(this,{currentVersion,kind,cache,enabled,fetchImpl,onState,canInstall,installer:install});
    this.state={phase:enabled?'idle':'unsupported',version:null,received:0,total:0,message:enabled?'Check for launcher updates whenever you like.':'Updates are available in installed and portable Windows builds.'};
    this.operation=null;this.release=null;this.downloaded=null;
  }
  snapshot(){return {...this.state};}
  set(values){Object.assign(this.state,values);this.onState(this.snapshot());}
  async check() {
    if(!this.enabled || this.operation || this.state.phase==='installing')return this.snapshot();
    const controller=new AbortController();this.operation=controller;
    // Refresh even a cached offer: a broken release may have been withdrawn.
    // The file stays in the cache, but cannot be installed from stale metadata.
    this.downloaded=null;
    this.set({phase:'checking',version:null,message:'Checking for a new launcher version...',received:0,total:0});
    try {
      const signal=AbortSignal.any([controller.signal,AbortSignal.timeout(20000)]);
      const raw=await boundedResponse(await this.fetchImpl(LATEST_URL,{headers,signal}),2*1024*1024,signal);
      const latest=JSON.parse(raw.toString('utf8'));
      this.release=selectRelease(latest,this.currentVersion,this.kind);
      if(!this.release){
        const message=isNewer(this.currentVersion,latest.tag_name)
          ? `Your version is newer than the latest available release (${latest.tag_name.replace(/^v/,'')}). No newer update is available.`
          : 'Your launcher is up to date.';
        this.set({phase:'current',version:null,message});return this.snapshot();
      }
      const sums=await boundedResponse(await this.fetchImpl(this.release.checksums.url,{signal}),65536,signal);
      this.release.sha256=checksumFor(sums.toString('utf8'),this.release.asset.name);
      await fs.mkdir(this.cache,{recursive:true});
      const file=path.join(this.cache,this.release.asset.name);
      if(await fs.stat(file).then(s=>s.size===this.release.asset.size).catch(()=>false) && await fileHash(file)===this.release.sha256){
        this.downloaded=file;this.set({phase:'ready',version:this.release.version,message:'Update downloaded. Install and restart when you are ready.'});
      }else this.set({phase:'available',version:this.release.version,message:`NOVA DROP ${this.release.version} is available.`});
    }catch(error){this.release=null;this.set({phase:'error',version:null,message:controller.signal.aborted?'Update check cancelled.':`Could not check for updates. ${error.message}`});}
    finally{this.operation=null;}
    return this.snapshot();
  }
  async download() {
    if(!this.enabled || this.operation || !this.release || !['available','error'].includes(this.state.phase))return this.snapshot();
    const controller=new AbortController();this.operation=controller;
    this.set({phase:'downloading',received:0,total:this.release.asset.size,message:'Downloading the launcher update...'});
    try {
      const signal=AbortSignal.any([controller.signal,AbortSignal.timeout(15*60*1000)]);
      this.downloaded=await downloadUpdate(this.release,path.join(this.cache,this.release.asset.name),{fetchImpl:this.fetchImpl,signal,onProgress:progress=>this.set(progress)});
      this.set({phase:'ready',message:'Update downloaded. Install and restart when you are ready.'});
    }catch(error){this.downloaded=null;this.set({phase:controller.signal.aborted?'available':'error',message:controller.signal.aborted?'Download cancelled. You can update later.':error.message});}
    finally{this.operation=null;}
    return this.snapshot();
  }
  cancel(){this.operation?.abort();}
  async install() {
    if(this.state.phase!=='ready' || !this.release || !this.downloaded || this.operation)throw new Error('Download and verify the update first.');
    if(!this.canInstall())throw new Error('Stop your current session or game installation before updating the launcher.');
    this.set({phase:'installing',message:'Preparing update. The launcher will restart...'});
    try {
      if(await fileHash(this.downloaded)!==this.release.sha256)throw new Error('The downloaded update changed. Please download it again.');
      const signal=AbortSignal.timeout(20000);
      let offered,sha256;
      try {
        const raw=await boundedResponse(await this.fetchImpl(LATEST_URL,{headers,signal}),2*1024*1024,signal);
        offered=selectRelease(JSON.parse(raw.toString('utf8')),this.currentVersion,this.kind);
        if(!offered || offered.tag!==this.release.tag || offered.asset.url!==this.release.asset.url || offered.asset.size!==this.release.asset.size)
          throw new Error('The available release changed or was withdrawn. Check for updates again.');
        const sums=await boundedResponse(await this.fetchImpl(offered.checksums.url,{signal}),65536,signal);
        sha256=checksumFor(sums.toString('utf8'),offered.asset.name);
      } catch(error) {
        throw new Error(`The update could not be revalidated. ${error.message} Your current launcher and cached download were kept.`);
      }
      if(sha256!==this.release.sha256)throw new Error('The release package changed after downloading. Check for updates and download it again.');
      // Re-check after hashing: a game launch could have been requested in the meantime.
      if(!this.canInstall())throw new Error('Stop your current session before updating the launcher.');
      await this.installer({file:this.downloaded,sha256:this.release.sha256,version:this.release.version,kind:this.kind});
    }catch(error){this.downloaded=null;this.set({phase:'error',message:error.message});throw error;}
  }
}
