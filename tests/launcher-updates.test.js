import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {LauncherUpdates,selectRelease,checksumFor,isNewer,downloadUpdate,LATEST_URL,REPOSITORY,fileHash} from '../desktop/updates.mjs';
import {updateKind} from '../desktop/update-install.mjs';
const bytes=Buffer.from('MZ verified launcher fixture'),sha256=crypto.createHash('sha256').update(bytes).digest('hex');
function release(version='0.4.3',kind='portable') {
  const tag=`v${version}`,name=`NOVA-DROP-${version}-x64-${kind}.exe`;
  const asset=(name,size)=>({name,size,browser_download_url:`https://github.com/${REPOSITORY}/releases/download/${tag}/${name}`});
  return {tag_name:tag,draft:false,prerelease:false,assets:[asset(name,bytes.length),asset('SHA256SUMS.txt',100)]};
}
function fakeFetch(value=release(),binary=bytes) {
  return async url=>url===LATEST_URL?Response.json(value):url.endsWith('SHA256SUMS.txt')?new Response(`${sha256}  ${value.assets[0].name}\n`):new Response(binary,{headers:{'content-length':String(binary.length)}});
}
async function context(t,options={}) {
  const cache=await fs.mkdtemp(path.join(os.tmpdir(),'nova-update-test-'));
  t.after(()=>fs.rm(cache,{recursive:true,force:true}));
  const updates=new LauncherUpdates({currentVersion:'0.4.2',kind:'portable',cache,fetchImpl:fakeFetch(),...options});
  return {cache,updates};
}
test('only newer regular versions are accepted; numeric versions do not sort lexically',()=>{
  assert(isNewer('v0.4.10','0.4.2'));assert(isNewer('1.0.0','0.99.99'));
  for(const value of ['0.4.2','0.4.1','0.4.3-beta','v0.4.3/evil','0.04.3','9999999999999999999.1.1'])assert(!isNewer(value,'0.4.2'));
  assert.equal(selectRelease(release('0.4.1'),'0.4.2','portable'),null);
  for(const key of ['draft','prerelease'])assert.throws(()=>selectRelease({...release(),[key]:true},'0.4.2','portable'));
});
test('release selection rejects wrong hosts, missing, duplicate, oversized and wrong-target assets',()=>{
  const bad=release();bad.assets[0].browser_download_url='https://example.com/evil.exe';
  assert.throws(()=>selectRelease(bad,'0.4.2','portable'));
  assert.throws(()=>selectRelease(release(),'0.4.2','nsis'));
  const duplicate=release();duplicate.assets.push(duplicate.assets[0]);assert.throws(()=>selectRelease(duplicate,'0.4.2','portable'));
  const large=release();large.assets[0].size=1024**3;assert.throws(()=>selectRelease(large,'0.4.2','portable'));
  const absent=release();absent.assets.pop();assert.throws(()=>selectRelease(absent,'0.4.2','portable'));
});
test('checksum entries must uniquely match the exact executable filename',()=>{
  const name=release().assets[0].name;
  assert.equal(checksumFor(`\uFEFF${sha256} *${name}\r\n`,name),sha256);
  assert.throws(()=>checksumFor(`${sha256}  ${name}\n${sha256}  ${name}`,name));
  assert.throws(()=>checksumFor(`${sha256}  ../${name}`,name));
  assert.throws(()=>checksumFor('not a checksum',name));
});
test('checking never downloads or installs; cached verified updates remain ready offline',async t=>{
  let installs=0,downloads=0;const mock=fakeFetch();
  const {updates}=await context(t,{fetchImpl:(url,...args)=>{if(url.endsWith('.exe'))downloads++;return mock(url,...args);},install:async()=>{installs++;}});
  await updates.check();assert.equal(updates.state.phase,'available');assert.equal(downloads,0);assert.equal(installs,0);
  await updates.download();assert.equal(updates.state.phase,'ready');assert.equal(installs,0);
  updates.fetchImpl=()=>{throw new Error('offline');};await updates.check();assert.equal(updates.state.phase,'ready');
  await updates.install();assert.equal(installs,1);
});
test('restart recovers verified download from cache without a second executable transfer',async t=>{
  const {cache,updates}=await context(t);await updates.check();await updates.download();
  const mock=fakeFetch();const restarted=new LauncherUpdates({currentVersion:'0.4.2',kind:'portable',cache,fetchImpl:(url,...args)=>{assert(!url.endsWith('.exe'));return mock(url,...args);}});
  await restarted.check();assert.equal(restarted.state.phase,'ready');
});
test('update installation is blocked during a game/session and detects post-download tampering',async t=>{
  let allowed=false,installed=false;
  const {updates}=await context(t,{canInstall:()=>allowed,install:async()=>{installed=true;}});
  await updates.check();await updates.download();
  await assert.rejects(updates.install(),/Stop your/);assert.equal(updates.state.phase,'ready');
  allowed=true;await fs.writeFile(updates.downloaded,'changed');
  await assert.rejects(updates.install(),/changed/);assert(!installed);assert.equal(updates.state.phase,'error');
});
test('failed transfers and bad checksums preserve existing files and remove partial downloads',async t=>{
  const {cache}=await context(t);const destination=path.join(cache,'test.exe');await fs.writeFile(destination,'old');
  const value={...selectRelease(release(),'0.4.2','portable'),sha256};
  await assert.rejects(downloadUpdate(value,destination,{fetchImpl:async()=>new Response(Buffer.alloc(bytes.length))}),/verification/);
  assert.equal(await fs.readFile(destination,'utf8'),'old');assert.deepEqual(await fs.readdir(cache),['test.exe']);
  await assert.rejects(downloadUpdate(value,destination,{fetchImpl:async()=>new Response('short')}),/verification/);
  assert.equal(await fs.readFile(destination,'utf8'),'old');
});
test('cancellation leaves the previous launcher intact and allows a retry',async t=>{
  const {cache,updates}=await context(t);
  await updates.check();
  updates.fetchImpl=async()=>new Response(new ReadableStream({start(controller){controller.enqueue(bytes.subarray(0,2));setTimeout(()=>{updates.cancel();controller.enqueue(bytes.subarray(2));controller.close();},10);}}));
  await updates.download();assert.equal(updates.state.phase,'available');assert.deepEqual(await fs.readdir(cache),[]);
  updates.fetchImpl=fakeFetch();await updates.download();assert.equal(updates.state.phase,'ready');assert.equal(await fileHash(updates.downloaded),sha256);
});
test('network, invalid JSON and rate-limit failures are recoverable without launching an installer',async t=>{
  const {updates}=await context(t,{fetchImpl:async()=>new Response('rate limit',{status:403})});
  await updates.check();assert.equal(updates.state.phase,'error');assert.match(updates.state.message,/limiting/);
  updates.fetchImpl=async()=>new Response('<html>');await updates.check();assert.equal(updates.state.phase,'error');assert.equal(updates.release,null);
  updates.fetchImpl=fakeFetch();await updates.check();assert.equal(updates.state.phase,'available');
});
test('concurrent update checks share a single operation and no update means no checksum fetch',async t=>{
  let releaseResponse,requests=0;const response=new Promise(resolve=>{releaseResponse=resolve;});
  const {updates}=await context(t,{fetchImpl:()=>{requests++;return response;}});
  const first=updates.check();await updates.check();assert.equal(requests,1);
  releaseResponse(Response.json(release('0.4.2')));await first;assert.equal(updates.state.phase,'current');assert.equal(requests,1);
});
test('development and unpacked builds cannot install; portable and NSIS choose matching packages',()=>{
  assert.equal(updateKind({packaged:false,platform:'win32',portableFile:'C:/app.exe'}),null);
  assert.equal(updateKind({packaged:true,platform:'linux',installed:true}),null);
  assert.equal(updateKind({packaged:true,platform:'win32',portableFile:'',installed:false}),null);
  assert.equal(updateKind({packaged:true,platform:'win32',portableFile:'C:/app.exe'}),'portable');
  assert.equal(updateKind({packaged:true,platform:'win32',portableFile:'',installed:true}),'nsis');
});
