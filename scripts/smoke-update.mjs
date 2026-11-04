// Runs only on an isolated Windows CI runner: installs and updates the real release EXEs.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {watch} from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import net from 'node:net';
import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {setTimeout as delay} from 'node:timers/promises';
import {chromium,expect} from '@playwright/test';
import {fileHash,LauncherUpdates,REPOSITORY,LATEST_URL} from '../desktop/updates.mjs';
import {launchUpdateHelper} from '../desktop/update-install.mjs';

if(process.env.GITHUB_ACTIONS!=='true'||process.platform!=='win32')throw new Error('Real installer update smoke tests run only on the isolated Windows CI runner.');
const root=process.cwd(),version=JSON.parse(await fs.readFile('package.json')).version;
const originalTemp=await fs.realpath(os.tmpdir());
const temporary=await fs.mkdtemp(path.join(originalTemp,'nova-update-'));
const execute=promisify(execFile);
// CIM paths include the fixture's Ü. Match Node's decoding rather than using
// Windows PowerShell's machine-dependent console code page for JSON output.
const ps=(script,env={},timeout=15000)=>execute('powershell.exe',['-NoProfile','-NonInteractive','-Command',"[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false);"+script],{windowsHide:true,timeout,encoding:'utf8',env:{...process.env,...env}});
const exists=file=>fs.access(file).then(()=>true).catch(()=>false);
async function until(check,message,timeout=90000){const end=Date.now()+timeout;while(Date.now()<end){if(await check())return;await delay(250);}throw new Error(message);}
async function port(){const server=net.createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const value=server.address().port;await new Promise(resolve=>server.close(resolve));return value;}
// Only the CI debugger supplies fake release metadata and an older version.
// The shipped main process, IPC, updater and install helper remain unmodified.
// In particular, the short-lived Electron process must own the helper spawn.
async function preparePackagedUpdater(debugPort,fixture) {
  let target;
  await until(async()=>{try{target=(await fetch(`http://127.0.0.1:${debugPort}/json/list`,{signal:AbortSignal.timeout(500)}).then(r=>r.json()))[0];return Boolean(target?.webSocketDebuggerUrl);}catch{return false;}},'Packaged main debugger did not open.');
  const socket=new WebSocket(target.webSocketDebuggerUrl),pending=new Map(),pauses=[];
  let next=0;
  const closed=()=>{for(const request of pending.values())request.reject(new Error('Packaged main debugger disconnected.'));pending.clear();};
  socket.addEventListener('close',closed);
  socket.addEventListener('message',event=>{
    const message=JSON.parse(event.data);
    if(message.method==='Debugger.paused')pauses.push(message.params);
    const request=pending.get(message.id);
    if(request){pending.delete(message.id);message.error?request.reject(new Error(JSON.stringify(message.error))):request.resolve(message.result);}
  });
  const send=(method,params={})=>new Promise((resolve,reject)=>{
    const id=++next,timer=setTimeout(()=>{pending.delete(id);reject(new Error(`Main debugger timed out: ${method}`));},15000);
    pending.set(id,{resolve:value=>{clearTimeout(timer);resolve(value);},reject:error=>{clearTimeout(timer);reject(error);}});
    socket.send(JSON.stringify({id,method,params}));
  });
  try {
    await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
    await send('Debugger.enable');
    // Pause before version state/updater construction, after imports initialize.
    const lines=(await fs.readFile(path.join(root,'desktop/main.mjs'),'utf8')).split(/\r?\n/);
    const lineNumber=lines.findIndex(line=>line.startsWith('const hiddenTest = '));assert(lineNumber>=0,'Packaged main entry anchor changed.');
    const breakpoint=await send('Debugger.setBreakpointByUrl',{urlRegex:'desktop[\\\\/]main\\.mjs$',lineNumber});
    await send('Runtime.runIfWaitingForDebugger');
    let frame;
    await until(async()=>{
      const pause=pauses.shift();if(!pause)return false;
      if(pause.hitBreakpoints?.includes(breakpoint.breakpointId)){frame=pause.callFrames[0];return true;}
      await send('Debugger.resume');return false;
    },'Packaged updater entry breakpoint was not reached.',30000);
    const result=await send('Debugger.evaluateOnCallFrame',{callFrameId:frame.callFrameId,returnByValue:true,expression:`(() => {
      const fixture=${JSON.stringify(fixture)};
      if(!app.isPackaged || app.getVersion()!==fixture.realVersion)throw new Error('Wrong packaged app under test.');
      const readFile=process.getBuiltinModule('fs').promises.readFile;
      app.getVersion=()=> '0.4.2';
      globalThis.fetch=async (input,options={})=>{
        options.signal?.throwIfAborted();
        const url=typeof input==='string'?input:input.url;
        if(url===fixture.latestURL)return new Response(JSON.stringify(fixture.metadata));
        if(url===fixture.sumURL)return new Response(fixture.sums);
        if(url===fixture.url)return new Response(await readFile(fixture.packageFile));
        throw new Error('Unexpected network request in update fixture: '+url);
      };
      return {pid:process.pid,version:app.getVersion(),packaged:app.isPackaged};
    })()`});
    assert(!result.exceptionDetails,`Could not prepare packaged update fixture: ${JSON.stringify(result.exceptionDetails)}`);
    assert.equal(result.result.value.version,'0.4.2');assert.equal(result.result.value.packaged,true);
    await send('Debugger.removeBreakpoint',{breakpointId:breakpoint.breakpointId});
    await send('Debugger.resume');
    return result.result.value.pid;
  }finally{socket.close();}
}
function observeReceipt(cache) {
  // The real restarted app consumes this receipt during startup. Observe it
  // before launch, without redirecting its normal cache or changing that app.
  let result;
  const read=async()=>{try{result=JSON.parse(await fs.readFile(path.join(cache,'update-result.json'),'utf8'));}catch{}};
  const watcher=watch(cache,()=>{void read();}),timer=setInterval(()=>{void read();},25);
  watcher.on('error',()=>{});
  return {get value(){return result;},close(){watcher.close();clearInterval(timer);}};
}
function inside(directory,file) {const relative=path.relative(directory,path.resolve(file));return relative!==''&&relative!=='..'&&!relative.startsWith('..'+path.sep)&&!path.isAbsolute(relative);}
async function requireOwnedPath(actual,expected,exact=false) {
  let resolvedActual,resolvedExpected;
  try {[resolvedActual,resolvedExpected]=await Promise.all([fs.realpath(actual),fs.realpath(expected)]);}
  catch(error){throw new Error(`Cannot resolve test runtime ownership: actual=${JSON.stringify(actual)}, expected=${JSON.stringify(expected)}`,{cause:error});}
  assert(exact?resolvedActual.toLowerCase()===resolvedExpected.toLowerCase():inside(resolvedExpected,resolvedActual),
    `Test runtime is outside its owned location: actual=${JSON.stringify(actual)}, canonical actual=${JSON.stringify(resolvedActual)}, expected=${JSON.stringify(expected)}, canonical expected=${JSON.stringify(resolvedExpected)}`);
  return resolvedActual;
}
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
  const ownedRoot=await requireOwnedPath(directory,temporary);
  // Canonical paths handle NSIS 8.3 aliases, including orphaned main processes.
  // A PowerShell helper must have both script and request files in this root;
  // a matching substring somewhere in its command line is insufficient.
  const canonical=file=>file?fs.realpath(file).catch(()=>null):Promise.resolve(null);
  const argument=(line,name)=>new RegExp(`(?:^|\\s)-${name}\\s+(?:"([^"]+)"|(\\S+))`,'i').exec(line||'')?.slice(1).find(Boolean);
  await until(async()=>{
    const {stdout}=await ps(`
$items=@(Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath } | ForEach-Object {
  [pscustomobject]@{id=[int]$_.ProcessId;name=$_.Name;exe=$_.ExecutablePath;command=$_.CommandLine;created=$_.CreationDate.ToUniversalTime().ToString('o')}
})
ConvertTo-Json -InputObject $items -Compress
`);
    const matches=await Promise.all(JSON.parse(stdout.trim()).map(async item=>{
      const executable=await canonical(item.exe);
      if(executable&&inside(ownedRoot,executable))return {...item,helper:false};
      if(item.name.toLowerCase()!=='powershell.exe')return null;
      const [script,request]=await Promise.all([canonical(argument(item.command,'File')),canonical(argument(item.command,'RequestFile'))]);
      return script&&request&&inside(ownedRoot,script)&&inside(ownedRoot,request)&&path.dirname(script)===path.dirname(request)?{...item,helper:true}:null;
    }));
    const owned=matches.filter(Boolean).sort((a,b)=>Number(b.helper)-Number(a.helper));
    if(!owned.length)return true;
    await ps(`
# Stop an update helper first so it cannot restart the launcher during cleanup.
foreach($item in ($env:NOVA_TEST_OWNED | ConvertFrom-Json)) {
  $current=Get-CimInstance Win32_Process -Filter ('ProcessId='+[int]$item.id)
  if($current -and $current.CreationDate.ToUniversalTime().ToString('o') -eq $item.created){Stop-Process -Id $item.id -Force -ErrorAction SilentlyContinue}
}
`,{NOVA_TEST_OWNED:JSON.stringify(owned.map(({id,created})=>({id,created})))});
    return false;
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
    assert(prepared,'Updated worker did not prepare its own verified payload.');
    await requireOwnedPath(prepared.root,workspace);
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
let target,browser,oldChild,testRoot,receipt;
try {
  assert.equal(await fileHash(path.join(root,'dist/win-unpacked/resources/update/install-update.ps1')),await fileHash(path.join(root,'desktop/install-update.ps1')));
  for(const {kind,lifecycle} of ['portable','nsis'].flatMap(kind=>[{kind,lifecycle:true},{kind,lifecycle:false}])) {
    const scenario=lifecycle?'packaged-ipc-lifetime':'old-file-compatibility';
    testRoot=path.join(temporary,kind+'-'+scenario+" with Ü spaces & apostrophe's");await fs.mkdir(testRoot);
    const data=path.join(testRoot,'user-data');await fs.mkdir(data);
    const cache=path.join(lifecycle?data:testRoot,lifecycle?'updates':'cache');await fs.mkdir(cache);
    const runtimeTemp=path.join(testRoot,'runtime-temp');await fs.mkdir(runtimeTemp);
    const packageFile=path.join(root,'dist',`NOVA-DROP-${version}-x64-${kind}.exe`);
    const bytes=await fs.readFile(packageFile),sha256=await fileHash(packageFile);
    const name=path.basename(packageFile),url=`https://github.com/${REPOSITORY}/releases/download/v${version}/${name}`;
    const sumURL=`https://github.com/${REPOSITORY}/releases/download/v${version}/SHA256SUMS.txt`,sums=`${sha256}  ${name}\n`;
    const metadata={tag_name:`v${version}`,draft:false,prerelease:false,assets:[{name,size:bytes.length,browser_download_url:url},{name:'SHA256SUMS.txt',size:Buffer.byteLength(sums),browser_download_url:sumURL}]};
    let originalPackage=packageFile;
    if(!lifecycle){
      const oldName=`NOVA-DROP-0.4.2-x64-${kind}.exe`,old=path.join(testRoot,oldName);
      const oldURL=`https://github.com/${REPOSITORY}/releases/download/v0.4.2/${oldName}`;
      const response=await fetch(oldURL,{signal:AbortSignal.timeout(120000)});assert(response.ok,`Previous release download failed: ${response.status}`);
      // This separate check verifies replacing old files, not the old updater's lifetime.
      await fs.writeFile(old,new Uint8Array(await response.arrayBuffer()));assert.equal(await fileHash(old),oldHashes[kind]);originalPackage=old;
    }
    target=kind==='portable'?path.join(testRoot,'My NOVA DROP.exe'):path.join(testRoot,'Installed launcher','NOVA DROP.exe');
    if(kind==='portable')await fs.copyFile(originalPackage,target);
    else await ps("$s=[Diagnostics.ProcessStartInfo]::new();$s.FileName=$env:NOVA_TEST_INSTALLER;$s.Arguments='/S /D='+$env:NOVA_TEST_INSTALL_DIR;$s.UseShellExecute=$false;$s.CreateNoWindow=$true;$p=[Diagnostics.Process]::Start($s);$p.WaitForExit();if($p.ExitCode -ne 0){throw 'Initial installation failed.'}",{NOVA_TEST_INSTALLER:originalPackage,NOVA_TEST_INSTALL_DIR:path.dirname(target)},180000);
    assert(await exists(target));
    if(kind==='nsis')assert(await exists(path.join(path.dirname(target),'Uninstall NOVA DROP.exe')));
    const settings={mode:'host',gameMode:'infinity',gamePath:'C:/Games/My Fortnite 4.2',host:'25.1.2.3',multiplayerName:'Player_abcdef123456'};
    await fs.writeFile(path.join(data,'settings.json'),JSON.stringify(settings));
    await fs.writeFile(path.join(data,'update-preferences.json'),JSON.stringify({checkOnStart:false}));
    const env={...process.env,LAUNCHER_TEST_DATA:data,LAUNCHER_TEST_HIDDEN:'1',TEMP:runtimeTemp,TMP:runtimeTemp};
    const transientKeys=['ELECTRON_RUN_AS_NODE','PORTABLE_EXECUTABLE_FILE','PORTABLE_EXECUTABLE_DIR','PORTABLE_EXECUTABLE_APP_FILENAME','NODE_OPTIONS'];
    for(const key of transientKeys)delete env[key];
    const debugPort=await port();
    const mainPort=lifecycle?await port():null;
    oldChild=spawn(target,[`--remote-debugging-port=${debugPort}`,...(lifecycle?[`--inspect-brk=${mainPort}`]:[])],{env,windowsHide:true,stdio:'ignore'});
    let oldError;oldChild.once('error',error=>{oldError=error;});
    const oldClosed=new Promise(resolve=>oldChild.once('exit',resolve));
    const updaterParent=lifecycle?await preparePackagedUpdater(mainPort,{realVersion:version,latestURL:LATEST_URL,metadata,sumURL,sums,url,packageFile}):null;
    await until(async()=>{if(oldError)throw oldError;try{return (await fetch(`http://127.0.0.1:${debugPort}/json/version`,{signal:AbortSignal.timeout(500)})).ok;}catch{return false;}},'Old launcher did not open.');
    browser=await chromium.connectOverCDP(`http://127.0.0.1:${debugPort}`);
    const page=browser.contexts()[0].pages()[0];await expect(page.locator('#app-version')).toHaveText('0.4.2');
    receipt=observeReceipt(cache);
    let handedOff;
    if(lifecycle){
      const available=await page.evaluate(()=>window.launcher.updateCheck());assert.equal(available.phase,'available');
      const downloaded=await page.evaluate(()=>window.launcher.updateDownload());assert.equal(downloaded.phase,'ready');
      // Do not close this window externally. Its real IPC handler must complete
      // the ready/apply handshake and quit its own Electron process.
      await page.evaluate(()=>{void window.launcher.updateInstall().catch(error=>{window.__updateInstallError=error.message;});});
      await until(async()=>{
        const files=(await fs.readdir(cache)).filter(name=>/^[a-f0-9-]{36}\.json$/.test(name));
        if(!files.length)return false;assert.equal(files.length,1);
        let request;
        try{request=JSON.parse(await fs.readFile(path.join(cache,files[0]),'utf8'));}
        catch(error){if(error instanceof SyntaxError||error.code==='ENOENT')return false;throw error;}
        assert.equal(request.parentPid,updaterParent,'The real packaged main must own the updater handoff.');
        assert.notEqual(request.parentPid,process.pid,'The long-lived smoke runner cannot stand in for the exiting app.');
        await requireOwnedPath(request.target,target,true);assert.equal(request.kind,kind);
        return exists(path.join(cache,files[0]+'.apply'));
      },'The packaged IPC update did not authorize its own handoff.',45000);
    }else{
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
    }
    const oldExit=await Promise.race([oldClosed.then(()=>true),delay(30000,false,{ref:false})]);assert(oldExit,'Previous launcher did not close after update handoff.');
    await browser.close();browser=null;
    if(handedOff)await until(async()=>{try{process.kill(handedOff.pid,0);return false;}catch{return true;}},'Update helper did not finish.',180000);
    await until(()=>receipt.value,'No update receipt after the launcher exited; its helper may have died with it.',180000);
    assert.equal(receipt.value.success,true,receipt.value.message);assert.equal(receipt.value.version,version);
    receipt.close();receipt=null;
    let main;
    await until(async()=>Boolean(main=await runtimeMain(target,kind)),'Updated Electron main did not restart.');
    const reportedExecutable=main.exe,expectedLocation=kind==='portable'?runtimeTemp:target;
    main.exe=await requireOwnedPath(reportedExecutable,expectedLocation,kind!=='portable');
    console.log(`Updated ${kind} runtime: reported=${JSON.stringify(reportedExecutable)}, canonical=${JSON.stringify(main.exe)}, expected=${JSON.stringify(expectedLocation)}`);
    const {stdout:runtimeVersion}=await ps('[Diagnostics.FileVersionInfo]::GetVersionInfo($env:NOVA_TEST_TARGET).ProductVersion',{NOVA_TEST_TARGET:main.exe});
    assert([version,version+'.0'].includes(runtimeVersion.trim()),`Unexpected running Electron version: ${runtimeVersion.trim()}`);
    await verifyWorker(main,testRoot,env);
    const stillRunning=await runtimeMain(target,kind);
    assert(stillRunning&&stillRunning.id===main.id&&stillRunning.created===main.created,'Updated Electron main exited during the worker probe.');
    assert.equal(await exists(path.join(cache,'installing.json')),false);
    if(kind==='portable'){
      assert.equal(await fileHash(target),sha256);
      const backups=(await fs.readdir(testRoot)).filter(name=>name.includes('.nova-backup-'));
      assert.equal(backups.length,1);assert.equal(await fileHash(path.join(testRoot,backups[0])),lifecycle?sha256:oldHashes.portable);
    }else{
      const {stdout}=await ps('[Diagnostics.FileVersionInfo]::GetVersionInfo($env:NOVA_TEST_TARGET).ProductVersion',{NOVA_TEST_TARGET:target});assert([version,version+'.0'].includes(stdout.trim()),`Unexpected Windows product version: ${stdout.trim()}`);
    }
    assert.deepEqual(JSON.parse(await fs.readFile(path.join(data,'settings.json'))),settings);
    assert.deepEqual(JSON.parse(await fs.readFile(path.join(data,'update-preferences.json'))),{checkOnStart:false});
    await stopOwned(testRoot);
    console.log(lifecycle
      ?`PASS: ${version} ${kind} packaged IPC check/download/install; simulated older version; real Electron parent exit, surviving helper, successful current-package reinstall and automatic restart. Worker and preserved settings verified. This is not the historical 0.4.2 updater.`
      :`PASS: 0.4.2 -> ${version} ${kind} old-file replacement compatibility using the current helper owned by the test runner; actual restart, verified worker and preserved settings. Historical updater lifetime is not claimed.`);
    target=null;oldChild=null;testRoot=null;
  }
  await fs.copyFile(path.join(root,'test-results/launcher-updates.png'),path.join(root,'dist/launcher-updates.png'));
  await fs.copyFile(path.join(root,'test-results/launcher-changelog.png'),path.join(root,'dist/launcher-changelog.png'));
}finally{
  receipt?.close();
  if(browser)await Promise.race([browser.close().catch(()=>{}),delay(5000,undefined,{ref:false})]);
  if(testRoot)await stopOwned(testRoot);
  // The unique temporary directory was created by this test and contains no user's data.
  const resolved=path.resolve(temporary);
  assert.equal(path.dirname(await fs.realpath(resolved)),originalTemp);
  assert(path.basename(resolved).startsWith('nova-update-'));
  await fs.rm(resolved,{recursive:true,force:true,maxRetries:10,retryDelay:500});
}
