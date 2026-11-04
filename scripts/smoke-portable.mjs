import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import net from 'node:net';
import { createHash } from 'node:crypto';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { setTimeout as delay } from 'node:timers/promises';
import { ROOT } from '../src/config.js';
// An optional executable permits a negative run against an older package.
// Never use the owner's TEMP: old wrappers share a build-wide extraction folder
// and a duplicate launch can delete files beneath an already-running instance.
const executable=path.resolve(process.argv[2] || path.join(ROOT,'dist/NOVA-DROP-0.4.4-x64-portable.exe'));
assert(fs.statSync(executable).isFile(),'Portable executable is missing.');
const tempParent=fs.realpathSync(os.tmpdir());
const temporary=fs.mkdtempSync(path.join(tempParent,'launcher-portable-'));
const userData=path.join(temporary,'profile'), extraction=path.join(temporary,'runtime-temp');
fs.mkdirSync(userData);fs.mkdirSync(extraction);
const probe=net.createServer();await new Promise(resolve=>probe.listen(0,'127.0.0.1',resolve));
const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));
const env={...process.env,LAUNCHER_TEST_DATA:userData,LAUNCHER_TEST_HIDDEN:'1',TEMP:extraction,TMP:extraction};
for(const key of ['ELECTRON_RUN_AS_NODE','PORTABLE_EXECUTABLE_FILE','PORTABLE_EXECUTABLE_DIR','PORTABLE_EXECUTABLE_APP_FILENAME'])delete env[key];
const wrappers=[];
function launch(args) {
  const child=spawn(executable,args,{env,windowsHide:true,stdio:'ignore'});
  const record={child,result:null,error:null};
  child.once('error',error=>{record.error=error;});
  record.closed=new Promise(resolve=>child.once('close',(code,signal)=>{record.result={code,signal};resolve(record.result);}));
  wrappers.push(record);return record;
}
async function waitClosed(record,timeout,message) {
  const result=await Promise.race([record.closed,delay(timeout,null,{ref:false})]);
  if(record.error)throw record.error;
  assert(result,message);return result;
}
function withinTemporary(candidate) {
  const relative=path.relative(temporary,path.resolve(candidate));
  return relative!=='' && relative!=='..' && !relative.startsWith('..'+path.sep) && !path.isAbsolute(relative);
}
async function extractedRuntime(wrapperPid) {
  // NSIS can keep both a staging copy and the running app under its private
  // TEMP. Identify the actual Electron child instead of guessing from folders.
  assert(Number.isSafeInteger(wrapperPid)&&wrapperPid>0);
  const {stdout}=await promisify(execFile)('powershell.exe',['-NoProfile','-NonInteractive','-Command',`
$matches=@(Get-CimInstance Win32_Process | Where-Object {
  $_.ParentProcessId -eq [int]$env:NOVA_TEST_WRAPPER -and $_.Name -eq 'NOVA DROP.exe' -and $_.CommandLine -notmatch '(?:^|\\s)--type(?:=|\\s)'
} | Select-Object -ExpandProperty ExecutablePath)
ConvertTo-Json -InputObject $matches -Compress
`],{windowsHide:true,timeout:15000,env:{...process.env,NOVA_TEST_WRAPPER:String(wrapperPid)}});
  const matches=JSON.parse(stdout.trim());
  assert.equal(matches.length,1,'Expected exactly one Electron main owned by the portable wrapper.');
  assert(withinTemporary(matches[0]),'Runtime escaped the test directory.');
  return path.dirname(matches[0]);
}
const hash=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
let browser,page,failure,first;
async function checkWorker(label) {
  await page.locator('#game-path').fill(path.join(temporary,`missing-game-${label}`));
  // Observe a fresh busy -> settled transition, so an earlier error banner
  // cannot make the post-duplicate worker check pass without actually running.
  await page.evaluate(()=>{
    window.portableProbeUnsubscribe?.();window.portableProbeStates=[];
    window.portableProbeUnsubscribe=window.launcher.subscribe(state=>window.portableProbeStates.push({busy:state.busy,message:state.message}));
  });
  await page.locator('#check').click();
  await page.waitForFunction(()=>window.portableProbeStates.some(state=>state.busy) && window.portableProbeStates.at(-1)?.busy===false,{},{timeout:45000});
  await expect(page.locator('#error-banner')).toContainText('missing FortniteGame');
  await expect(page.locator('#activity-list')).toContainText('missing FortniteGame');
  await expect(page.locator('#stop')).toBeHidden();
  await expect(page.locator('#check')).toBeEnabled();
}
try {
  first=launch([`--remote-debugging-port=${port}`]);
  let ready=false;
  for(let i=0;i<120;i++) {
    if(first.error)throw first.error;
    if(first.result)throw new Error(`Portable wrapper exited before startup (${first.result.code}).`);
    try{const response=await fetch(`http://127.0.0.1:${port}/json/version`,{signal:AbortSignal.timeout(500)});if(response.ok){ready=true;break;}}catch{}
    await delay(500);
  }
  if(!ready)throw new Error('Portable launcher did not open its test endpoint.');
  browser=await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
  const context=browser.contexts()[0];
  page=context.pages()[0] || await context.waitForEvent('page');
  await expect(page.locator('#app-version')).toHaveText('0.4.4');
  await expect(page).toHaveTitle('NOVA DROP');
  await expect(page.locator('#startup')).toBeHidden();
  await expect(page.locator('.brand img')).toHaveJSProperty('complete',true);
  expect(await page.locator('.brand img').evaluate(image=>image.naturalWidth)).toBeGreaterThan(256);
  await expect(page.locator('.hero-art')).toHaveJSProperty('complete',true);
  expect(await page.locator('.hero-art').evaluate(image=>image.naturalWidth)).toBeGreaterThan(1000);
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.screenshot({path:path.join(ROOT,'dist/launcher-preview.png')});
  await page.locator('[data-rules="thanos"]').click();
  await expect(page.locator('#mode-note')).toContainText('Thanos is preselected');
  await expect(page.locator('.hero-art')).toHaveAttribute('src','thanos.png');
  await expect(page.locator('.hero-art')).toHaveJSProperty('complete',true);
  expect(await page.locator('.hero-art').evaluate(image=>image.naturalWidth)).toBeGreaterThan(500);
  await page.locator('[data-page="setup"]').click();
  await page.locator('.advanced summary').click();
  await checkWorker('before-duplicate');
  const runtime=await extractedRuntime(first.child.pid);
  const runtimeFiles=['NOVA DROP.exe','icudtl.dat','resources.pak','resources/worker/worker.mjs'].map(name=>path.join(runtime,name));
  const originalHashes=runtimeFiles.map(hash);

  // Same executable, same profile and same isolated TEMP: the second Electron
  // instance must exit without deleting the first instance's runtime files.
  const second=launch([]);
  assert.equal((await waitClosed(second,90000,'Duplicate portable wrapper did not exit.')).code,0);
  assert.equal(first.result,null,'The original portable wrapper exited after the duplicate launch.');
  const problems=[];
  for(let i=0;i<runtimeFiles.length;i++) {
    try {assert.equal(hash(runtimeFiles[i]),originalHashes[i],`Runtime changed: ${path.relative(runtime,runtimeFiles[i])}`);}
    catch(error){problems.push(new Error(`Original runtime damaged after duplicate launch: ${path.relative(runtime,runtimeFiles[i])}`,{cause:error}));}
  }
  // Still exercise the helper if runtime files went missing, to capture the
  // actual worker failure rather than only detecting directory damage.
  try {
    await expect(page).toHaveTitle('NOVA DROP');
    await expect(page.locator('#app-version')).toHaveText('0.4.4');
    await checkWorker('after-duplicate');
  }catch(error){problems.push(error);}
  if(problems.length)throw new AggregateError(problems,'Duplicate portable launch damaged the running launcher or its worker.');
} catch(error) {
  failure=error;
} finally {
  const cleanupErrors=[];
  if(page)await Promise.race([page.evaluate(()=>window.launcher.close()).catch(()=>{}),delay(5000,undefined,{ref:false})]);
  if(browser)await Promise.race([browser.close().catch(()=>{}),delay(5000,undefined,{ref:false})]);
  for(const record of wrappers) {
    if(!record.result)await Promise.race([record.closed,delay(15000,undefined,{ref:false})]);
    if(!record.result && Number.isSafeInteger(record.child.pid)) {
      // Only wrappers spawned by this script, including their child processes.
      try {await promisify(execFile)('taskkill.exe',['/PID',String(record.child.pid),'/T','/F'],{windowsHide:true,timeout:10000});}
      catch(error){if(!record.result)cleanupErrors.push(error);}
      try {await waitClosed(record,10000,'Test-owned portable process did not stop.');}catch(error){cleanupErrors.push(error);}
    }
  }
  try {
    assert.equal(path.dirname(fs.realpathSync(temporary)),tempParent);
    assert(path.basename(temporary).startsWith('launcher-portable-'));
    fs.rmSync(temporary,{recursive:true,force:true,maxRetries:10,retryDelay:200});
  }catch(error){cleanupErrors.push(error);}
  if(cleanupErrors.length)failure=new AggregateError([...(failure?[failure]:[]),...cleanupErrors],'Portable smoke check or its owned cleanup failed.');
}
if(failure)throw failure;
assert.equal(first.result?.code,0,'Portable wrapper did not close cleanly.');
console.log('PASS: portable self-extraction, initial UI, verified payload bootstrap, duplicate-launch isolation, preserved runtime files, a fresh worker after the second launch and clean close.');
