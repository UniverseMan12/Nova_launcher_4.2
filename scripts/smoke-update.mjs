// Runs only on an isolated Windows CI runner: installs and updates the real release EXEs.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import net from 'node:net';
import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {setTimeout as delay} from 'node:timers/promises';
import {chromium,expect} from '@playwright/test';
import {fileHash,LauncherUpdates,REPOSITORY} from '../desktop/updates.mjs';
import {launchUpdateHelper} from '../desktop/update-install.mjs';

if(process.env.GITHUB_ACTIONS!=='true'||process.platform!=='win32')throw new Error('Real installer update smoke tests run only on the isolated Windows CI runner.');
const root=process.cwd(),version=JSON.parse(await fs.readFile('package.json')).version;
const originalTemp=await fs.realpath(os.tmpdir());
const temporary=await fs.mkdtemp(path.join(originalTemp,'nova-update-'));
const execute=promisify(execFile);
const ps=(script,env={},timeout=15000)=>execute('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],{windowsHide:true,timeout,env:{...process.env,...env}});
const exists=file=>fs.access(file).then(()=>true).catch(()=>false);
async function until(check,message,timeout=90000){const end=Date.now()+timeout;while(Date.now()<end){if(await check())return;await delay(250);}throw new Error(message);}
async function port(){const server=net.createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const value=server.address().port;await new Promise(resolve=>server.close(resolve));return value;}
function inside(directory,file) {const relative=path.relative(directory,path.resolve(file));return relative!==''&&relative!=='..'&&!relative.startsWith('..'+path.sep)&&!path.isAbsolute(relative);}
async function runtimeMain(target,kind) {
  const {stdout}=await ps(`
$all=@(Get-CimInstance Win32_Process)
$targets=@($all | Where-Object { $_.ExecutablePath -eq $env:NOVA_TEST_TARGET })
$mains=if($env:NOVA_TEST_KIND -eq 'portable') {
  $all | Where-Object { $_.ParentProcessId -in $targets.ProcessId -and $_.Name -eq 'NOVA DROP.exe' }
} else { $targets }
$result=@($mains | Where-Object { $_.CommandLine -notmatch '(?:^|\\s)--type(?:=|\\s)' } | ForEach-Object {
  [pscustomobject]@{id=[int]$_.ProcessId;exe=$_.ExecutablePath;created=$_.CreationDate.ToUniversalTime().ToString('o')}
})
ConvertTo-Json -InputObject $result -Compress
`,{NOVA_TEST_TARGET:target,NOVA_TEST_KIND:kind});
  const matches=JSON.parse(stdout.trim());assert(matches.length<=1,'More than one updated Electron main is running.');
  return matches[0];
}
async function stopOwned(directory) {
  assert(inside(temporary,directory),'Cleanup escaped the update test root.');
  // Catch the portable main even if its wrapper already exited. Installer
  // helpers are identified by their request path in this unique test root.
  await until(async()=>{
    const {stdout}=await ps(`
$prefix=[IO.Path]::GetFullPath($env:NOVA_TEST_ROOT).TrimEnd('\\')+'\\'
$owned=@(Get-CimInstance Win32_Process | Where-Object {
  ($_.ExecutablePath -and $_.ExecutablePath.StartsWith($prefix,[StringComparison]::OrdinalIgnoreCase)) -or
  ($_.Name -eq 'powershell.exe' -and $_.CommandLine -and $_.CommandLine.IndexOf($prefix,[StringComparison]::OrdinalIgnoreCase) -ge 0)
})
# Stop an update helper first so it cannot restart the launcher during cleanup.
foreach($item in ($owned | Sort-Object @{Expression={if($_.Name -eq 'powershell.exe'){0}else{1}}})) {
  $current=Get-CimInstance Win32_Process -Filter ('ProcessId='+$item.ProcessId)
  if($current -and $current.CreationDate -eq $item.CreationDate){Stop-Process -Id $item.ProcessId -Force -ErrorAction SilentlyContinue}
}
$owned.Count
`,{NOVA_TEST_ROOT:directory});return Number(stdout.trim())===0;
  },'Test-owned update processes did not stop.',15000);
}
async function verifyWorker(main,testRoot,env) {
  const runtime=path.dirname(main.exe),resources=path.join(runtime,'resources');
  const workerFile=path.join(resources,'worker','worker.mjs');
  const files=[main.exe,path.join(runtime,'icudtl.dat'),path.join(runtime,'resources.pak'),workerFile,path.join(resources,'payload','payload.json')];
  for(const file of files)assert((await fs.stat(file)).isFile(),`Updated runtime file is missing: ${file}`);
  assert.equal(await fileHash(workerFile),await fileHash(path.join(root,'dist/win-unpacked/resources/worker/worker.mjs')),'Updated runtime has the wrong worker.');
  const probe=path.join(testRoot,'worker-probe'),workspace=path.join(probe,'workspaces'),missingGame=path.join(probe,'missing-game');
  await fs.mkdir(probe);assert.equal(await exists(missingGame),false);
  const child=spawn(main.exe,[workerFile],{cwd:probe,windowsHide:true,stdio:['ignore','pipe','pipe','ipc'],env:{...env,LAUNCHER_TEST_DATA:probe,ELECTRON_RUN_AS_NODE:'1'}});
  const messages=[];let stderr='',spawnError,sendError,closedResult;
  child.stdout.resume();child.stderr.on('data',chunk=>{stderr=(stderr+chunk).slice(-32768);});
  child.on('message',message=>messages.push(message));child.once('error',error=>{spawnError=error;});
  const closed=new Promise(resolve=>child.once('close',(code,signal)=>{closedResult={code,signal};resolve(closedResult);}));
  try {
    child.send({type:'start',action:'check',options:{mode:'solo',gameMode:'classic',autoSprint:false,gamePath:missingGame,host:''},
      root:path.join(resources,'app.asar'),payload:path.join(resources,'payload'),workspace,playerName:'Player_abcdef123456'},error=>{sendError=error;});
    const result=await Promise.race([closed,delay(90000,null,{ref:false})]);
    assert(result,'Updated runtime worker did not finish its check.');
    if(spawnError)throw spawnError;if(sendError)throw sendError;
    assert.equal(result.code,0,`Updated runtime worker exited ${result.code}: ${stderr}`);
    const prepared=messages.find(message=>message.type==='workspace');
    assert(prepared&&inside(workspace,prepared.root),'Updated worker did not prepare its own verified payload.');
    const failures=messages.filter(message=>message.type==='failure');
    assert.equal(failures.length,1,`Expected one missing-game validation failure; received ${JSON.stringify(messages)}. ${stderr}`);
    assert.match(failures[0].message,/missing FortniteGame/);
    assert.equal(messages.some(message=>message.type==='done'||message.type==='config'),false,'Missing game unexpectedly passed validation.');
    for(const file of files)assert((await fs.stat(file)).isFile(),`Runtime disappeared after its worker check: ${file}`);
  } finally {
    if(!closedResult){if(child.connected)child.disconnect();child.kill();await Promise.race([closed,delay(5000,undefined,{ref:false})]);}
    assert(closedResult,'Test worker could not be stopped.');
  }
}
const oldHashes={nsis:'134c55d37fb13a452f822080f07e57934200618a29d5caf069e8c6df1cef9f59',portable:'be85233b41827a794f34e6602633dffca2d4ce3f54396f09c350a9129559d741'};
let target,browser,oldChild,testRoot;
try {
  assert.equal(await fileHash(path.join(root,'dist/win-unpacked/resources/update/install-update.ps1')),await fileHash(path.join(root,'desktop/install-update.ps1')));
  for(const kind of ['portable','nsis']) {
    testRoot=path.join(temporary,kind+" with Ü spaces & apostrophe's");await fs.mkdir(testRoot);
    const cache=path.join(testRoot,'cache');await fs.mkdir(cache);
    const runtimeTemp=path.join(testRoot,'runtime-temp');await fs.mkdir(runtimeTemp);
    const oldName=`NOVA-DROP-0.4.2-x64-${kind}.exe`,old=path.join(testRoot,oldName);
    const oldURL=`https://github.com/${REPOSITORY}/releases/download/v0.4.2/${oldName}`;
    const response=await fetch(oldURL,{signal:AbortSignal.timeout(120000)});assert(response.ok,`Previous release download failed: ${response.status}`);
    // Fixed previous-release checksum makes the upgrade test independent of mutable metadata.
    await fs.writeFile(old,new Uint8Array(await response.arrayBuffer()));assert.equal(await fileHash(old),oldHashes[kind]);
    target=kind==='portable'?path.join(testRoot,'My NOVA DROP.exe'):path.join(testRoot,'Installed launcher','NOVA DROP.exe');
    if(kind==='portable')await fs.copyFile(old,target);
    else await ps("$s=[Diagnostics.ProcessStartInfo]::new();$s.FileName=$env:NOVA_TEST_INSTALLER;$s.Arguments='/S /D='+$env:NOVA_TEST_INSTALL_DIR;$s.UseShellExecute=$false;$s.CreateNoWindow=$true;$p=[Diagnostics.Process]::Start($s);$p.WaitForExit();if($p.ExitCode -ne 0){throw 'Initial installation failed.'}",{NOVA_TEST_INSTALLER:old,NOVA_TEST_INSTALL_DIR:path.dirname(target)},180000);
    assert(await exists(target));
    if(kind==='nsis')assert(await exists(path.join(path.dirname(target),'Uninstall NOVA DROP.exe')));
    const data=path.join(testRoot,'user-data');await fs.mkdir(data);
    const settings={mode:'host',gameMode:'infinity',gamePath:'C:/Games/My Fortnite 4.2',host:'25.1.2.3',multiplayerName:'Player_abcdef123456'};
    await fs.writeFile(path.join(data,'settings.json'),JSON.stringify(settings));
    await fs.writeFile(path.join(data,'update-preferences.json'),JSON.stringify({checkOnStart:false}));
    const env={...process.env,LAUNCHER_TEST_DATA:data,LAUNCHER_TEST_HIDDEN:'1',TEMP:runtimeTemp,TMP:runtimeTemp};
    const transientKeys=['ELECTRON_RUN_AS_NODE','PORTABLE_EXECUTABLE_FILE','PORTABLE_EXECUTABLE_DIR','PORTABLE_EXECUTABLE_APP_FILENAME'];
    for(const key of transientKeys)delete env[key];
    const debugPort=await port();
    oldChild=spawn(target,[`--remote-debugging-port=${debugPort}`],{env,windowsHide:true,stdio:'ignore'});
    let oldError;oldChild.once('error',error=>{oldError=error;});
    const oldClosed=new Promise(resolve=>oldChild.once('exit',resolve));
    await until(async()=>{if(oldError)throw oldError;try{return (await fetch(`http://127.0.0.1:${debugPort}/json/version`,{signal:AbortSignal.timeout(500)})).ok;}catch{return false;}},'Old launcher did not open.');
    browser=await chromium.connectOverCDP(`http://127.0.0.1:${debugPort}`);
    const page=browser.contexts()[0].pages()[0];await expect(page.locator('#app-version')).toHaveText('0.4.2');
    const packageFile=path.join(root,'dist',`NOVA-DROP-${version}-x64-${kind}.exe`);
    const bytes=await fs.readFile(packageFile),sha256=await fileHash(packageFile);
    const name=path.basename(packageFile),url=`https://github.com/${REPOSITORY}/releases/download/v${version}/${name}`;
    const sumURL=`https://github.com/${REPOSITORY}/releases/download/v${version}/SHA256SUMS.txt`,sums=`${sha256}  ${name}\n`;
    const metadata={tag_name:`v${version}`,draft:false,prerelease:false,assets:[{name,size:bytes.length,browser_download_url:url},{name:'SHA256SUMS.txt',size:Buffer.byteLength(sums),browser_download_url:sumURL}]};
    let handedOff;
    const updater=new LauncherUpdates({currentVersion:'0.4.2',kind,cache,fetchImpl:async requested=>new Response(requested===url?bytes:requested===sumURL?sums:JSON.stringify(metadata)),install:details=>launchUpdateHelper({...details,target,cache,helperSource:path.join(root,'desktop/install-update.ps1'),parentPid:oldChild.pid,quit:()=>{void page.evaluate(()=>window.launcher.close()).catch(()=>{});}}).then(result=>handedOff=result)});
    await updater.check();assert.equal(updater.state.phase,'available');
    await updater.download();assert.equal(updater.state.phase,'ready');
    // launchUpdateHelper inherits process.env. Scope the test environment only
    // around that call, then restore every key even when the handoff fails.
    const inheritedKeys=['LAUNCHER_TEST_DATA','LAUNCHER_TEST_HIDDEN','TEMP','TMP',...transientKeys];
    const previousEnv=new Map(inheritedKeys.map(key=>[key,process.env[key]]));
    try {
      for(const key of inheritedKeys){if(env[key]===undefined)delete process.env[key];else process.env[key]=env[key];}
      await updater.install();
    } finally {
      for(const [key,value] of previousEnv){if(value===undefined)delete process.env[key];else process.env[key]=value;}
    }
    const oldExit=await Promise.race([oldClosed.then(()=>true),delay(30000,false,{ref:false})]);assert(oldExit,'Previous launcher did not close after update handoff.');
    await browser.close();browser=null;
    await until(async()=>{try{process.kill(handedOff.pid,0);return false;}catch{return true;}},'Update helper did not finish.',180000);
    const resultFile=path.join(cache,'update-result.json');
    // The restarted app reads its own user-data cache, so inspect this test cache's receipt.
    const result=JSON.parse(await fs.readFile(resultFile));assert.equal(result.success,true,result.message);
    let main;
    await until(async()=>Boolean(main=await runtimeMain(target,kind)),'Updated Electron main did not restart.');
    assert(kind==='portable'?inside(runtimeTemp,main.exe):path.resolve(main.exe).toLowerCase()===path.resolve(target).toLowerCase(),'Updated main is outside its expected test runtime.');
    const {stdout:runtimeVersion}=await ps('[Diagnostics.FileVersionInfo]::GetVersionInfo($env:NOVA_TEST_TARGET).ProductVersion',{NOVA_TEST_TARGET:main.exe});
    assert([version,version+'.0'].includes(runtimeVersion.trim()),`Unexpected running Electron version: ${runtimeVersion.trim()}`);
    await verifyWorker(main,testRoot,env);
    const stillRunning=await runtimeMain(target,kind);
    assert(stillRunning&&stillRunning.id===main.id&&stillRunning.created===main.created,'Updated Electron main exited during the worker probe.');
    assert.equal(await exists(path.join(cache,'installing.json')),false);
    if(kind==='portable'){
      assert.equal(await fileHash(target),sha256);
      const backups=(await fs.readdir(testRoot)).filter(name=>name.includes('.nova-backup-'));
      assert.equal(backups.length,1);assert.equal(await fileHash(path.join(testRoot,backups[0])),oldHashes.portable);
    }else{
      const {stdout}=await ps('[Diagnostics.FileVersionInfo]::GetVersionInfo($env:NOVA_TEST_TARGET).ProductVersion',{NOVA_TEST_TARGET:target});assert([version,version+'.0'].includes(stdout.trim()),`Unexpected Windows product version: ${stdout.trim()}`);
    }
    assert.deepEqual(JSON.parse(await fs.readFile(path.join(data,'settings.json'))),settings);
    assert.deepEqual(JSON.parse(await fs.readFile(path.join(data,'update-preferences.json'))),{checkOnStart:false});
    await stopOwned(testRoot);
    console.log(`PASS: real 0.4.2 -> ${version} ${kind} update, actual Electron restart, verified runtime worker check, preserved settings and paths with spaces/special characters. Renderer interaction after restart is not tested.`);
    target=null;oldChild=null;testRoot=null;
  }
  await fs.copyFile(path.join(root,'test-results/launcher-updates.png'),path.join(root,'dist/launcher-updates.png'));
  await fs.copyFile(path.join(root,'test-results/launcher-changelog.png'),path.join(root,'dist/launcher-changelog.png'));
}finally{
  if(browser)await Promise.race([browser.close().catch(()=>{}),delay(5000,undefined,{ref:false})]);
  if(testRoot)await stopOwned(testRoot);
  // The unique temporary directory was created by this test and contains no user's data.
  const resolved=path.resolve(temporary);
  assert.equal(path.dirname(await fs.realpath(resolved)),originalTemp);
  assert(path.basename(resolved).startsWith('nova-update-'));
  await fs.rm(resolved,{recursive:true,force:true,maxRetries:10,retryDelay:500});
}
