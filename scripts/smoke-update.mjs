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
const temporary=await fs.mkdtemp(path.join(os.tmpdir(),'nova-update-'));
const execute=promisify(execFile);
const ps=(script,env={})=>execute('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],{windowsHide:true,env:{...process.env,...env}});
const exists=file=>fs.access(file).then(()=>true).catch(()=>false);
async function until(check,message,timeout=90000){const end=Date.now()+timeout;while(Date.now()<end){if(await check())return;await delay(250);}throw new Error(message);}
async function port(){const server=net.createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const value=server.address().port;await new Promise(resolve=>server.close(resolve));return value;}
async function processes(target){const {stdout}=await ps('foreach($p in [Diagnostics.Process]::GetProcesses()){try{if($p.MainModule.FileName -eq $env:NOVA_TEST_TARGET){$p.Id}}catch{}finally{$p.Dispose()}}',{NOVA_TEST_TARGET:target});return stdout.trim().split(/\s+/).filter(Boolean).map(Number);}
const oldHashes={nsis:'a7e0d1c4c9e4723b0733f5bfd8155feb0a3ba76f4c85c8ed73a18811361fa540',portable:'8ae100d149bebeacf18301b93c571e997730983d555df73659d671da0d42070a'};
let target,browser,oldChild;
try {
  assert.equal(await fileHash(path.join(root,'dist/win-unpacked/resources/update/install-update.ps1')),await fileHash(path.join(root,'desktop/install-update.ps1')));
  for(const kind of ['portable','nsis']) {
    const testRoot=path.join(temporary,kind+" with Ü spaces & apostrophe's");await fs.mkdir(testRoot);
    const cache=path.join(testRoot,'cache');await fs.mkdir(cache);
    const oldName=`NOVA-DROP-0.4.1-x64-${kind}.exe`,old=path.join(testRoot,oldName);
    const oldURL=`https://github.com/${REPOSITORY}/releases/download/v0.4.1/${oldName}`;
    const response=await fetch(oldURL);assert(response.ok,`Previous release download failed: ${response.status}`);
    // Fixed previous-release checksum makes the upgrade test independent of mutable metadata.
    await fs.writeFile(old,new Uint8Array(await response.arrayBuffer()));assert.equal(await fileHash(old),oldHashes[kind]);
    target=kind==='portable'?path.join(testRoot,'My NOVA DROP.exe'):path.join(testRoot,'Installed launcher','NOVA DROP.exe');
    if(kind==='portable')await fs.copyFile(old,target);
    else await ps("$s=[Diagnostics.ProcessStartInfo]::new();$s.FileName=$env:NOVA_TEST_INSTALLER;$s.Arguments='/S /D='+$env:NOVA_TEST_INSTALL_DIR;$s.UseShellExecute=$false;$s.CreateNoWindow=$true;$p=[Diagnostics.Process]::Start($s);$p.WaitForExit();if($p.ExitCode -ne 0){throw 'Initial installation failed.'}",{NOVA_TEST_INSTALLER:old,NOVA_TEST_INSTALL_DIR:path.dirname(target)});
    assert(await exists(target));
    if(kind==='nsis')assert(await exists(path.join(path.dirname(target),'Uninstall NOVA DROP.exe')));
    const data=path.join(testRoot,'user-data');await fs.mkdir(data);
    const settings={mode:'host',gameMode:'infinity',gamePath:'C:/Games/My Fortnite 4.2',host:'25.1.2.3',multiplayerName:'Player_abcdef123456'};
    await fs.writeFile(path.join(data,'settings.json'),JSON.stringify(settings));
    await fs.writeFile(path.join(data,'update-preferences.json'),JSON.stringify({checkOnStart:false}));
    process.env.LAUNCHER_TEST_DATA=data;delete process.env.ELECTRON_RUN_AS_NODE;
    const debugPort=await port();
    oldChild=spawn(target,[`--remote-debugging-port=${debugPort}`],{env:process.env,windowsHide:true,stdio:'ignore'});
    const oldClosed=new Promise(resolve=>oldChild.once('exit',resolve));
    await until(async()=>{try{return (await fetch(`http://127.0.0.1:${debugPort}/json/version`,{signal:AbortSignal.timeout(500)})).ok;}catch{return false;}},'Old launcher did not open.');
    browser=await chromium.connectOverCDP(`http://127.0.0.1:${debugPort}`);
    const page=browser.contexts()[0].pages()[0];await expect(page.locator('#app-version')).toHaveText('0.4.1');
    const packageFile=path.join(root,'dist',`NOVA-DROP-${version}-x64-${kind}.exe`);
    const bytes=await fs.readFile(packageFile),sha256=await fileHash(packageFile);
    const name=path.basename(packageFile),url=`https://github.com/${REPOSITORY}/releases/download/v${version}/${name}`;
    const sumURL=`https://github.com/${REPOSITORY}/releases/download/v${version}/SHA256SUMS.txt`,sums=`${sha256}  ${name}\n`;
    const metadata={tag_name:`v${version}`,draft:false,prerelease:false,assets:[{name,size:bytes.length,browser_download_url:url},{name:'SHA256SUMS.txt',size:Buffer.byteLength(sums),browser_download_url:sumURL}]};
    let handedOff;
    const updater=new LauncherUpdates({currentVersion:'0.4.1',kind,cache,fetchImpl:async requested=>new Response(requested===url?bytes:requested===sumURL?sums:JSON.stringify(metadata)),install:details=>launchUpdateHelper({...details,target,cache,helperSource:path.join(root,'desktop/install-update.ps1'),parentPid:oldChild.pid,quit:()=>{void page.evaluate(()=>window.launcher.close()).catch(()=>{});}}).then(result=>handedOff=result)});
    await updater.check();assert.equal(updater.state.phase,'available');
    await updater.download();assert.equal(updater.state.phase,'ready');
    await updater.install();await oldClosed;await browser.close();browser=null;
    await until(async()=>{try{process.kill(handedOff.pid,0);return false;}catch{return true;}},'Update helper did not finish.',180000);
    const resultFile=path.join(cache,'update-result.json');
    // The restarted app reads its own user-data cache, so inspect this test cache's receipt.
    const result=JSON.parse(await fs.readFile(resultFile));assert.equal(result.success,true,result.message);
    await until(async()=>(await processes(target)).length>0,'Updated launcher did not restart.');
    assert.equal(await exists(path.join(cache,'installing.json')),false);
    if(kind==='portable'){
      assert.equal(await fileHash(target),sha256);
      const backups=(await fs.readdir(testRoot)).filter(name=>name.includes('.nova-backup-'));
      assert.equal(backups.length,1);assert.equal(await fileHash(path.join(testRoot,backups[0])),oldHashes.portable);
    }else{
      const {stdout}=await ps('[Diagnostics.FileVersionInfo]::GetVersionInfo($env:NOVA_TEST_TARGET).ProductVersion',{NOVA_TEST_TARGET:target});assert.equal(stdout.trim(),version);
    }
    assert.deepEqual(JSON.parse(await fs.readFile(path.join(data,'settings.json'))),settings);
    assert.deepEqual(JSON.parse(await fs.readFile(path.join(data,'update-preferences.json'))),{checkOnStart:false});
    for(const pid of await processes(target))await execute('taskkill.exe',['/PID',String(pid),'/T','/F'],{windowsHide:true}).catch(()=>{});
    console.log(`PASS: real 0.4.1 -> ${version} ${kind} update, restart, preserved settings and paths with spaces/special characters.`);
    target=null;oldChild=null;
  }
  await fs.copyFile(path.join(root,'test-results/launcher-updates.png'),path.join(root,'dist/launcher-updates.png'));
}finally{
  await browser?.close().catch(()=>{});
  if(target)for(const pid of await processes(target))await execute('taskkill.exe',['/PID',String(pid),'/T','/F'],{windowsHide:true}).catch(()=>{});
  // The unique temporary directory was created by this test and contains no user's data.
  const resolved=path.resolve(temporary);
  assert(resolved.startsWith(path.resolve(os.tmpdir())+path.sep)&&path.basename(resolved).startsWith('nova-update-'));
  await fs.rm(resolved,{recursive:true,force:true,maxRetries:10,retryDelay:500});
}
