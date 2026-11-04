import fs from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {execFile,spawn} from 'node:child_process';
import {promisify} from 'node:util';
import {setTimeout as delay} from 'node:timers/promises';
import {fileHash} from './updates.mjs';

export function updateKind({packaged,platform=process.platform,portableFile=process.env.PORTABLE_EXECUTABLE_FILE,installed=false}) {
  if(!packaged || platform!=='win32')return null;
  return portableFile ? 'portable' : installed ? 'nsis' : null;
}
async function processStartTime(pid) {
  if(!Number.isSafeInteger(pid)||pid<1)throw new Error('Invalid launcher process.');
  const {stdout}=await promisify(execFile)('powershell.exe',['-NoProfile','-NonInteractive','-Command',`$p=[Diagnostics.Process]::GetProcessById(${pid});try{$p.StartTime.ToUniversalTime().ToString('o')}finally{$p.Dispose()}`],{windowsHide:true,timeout:5000});
  return stdout.trim();
}
async function startIndependentHelper({helper,requestFile,cache}) {
  // libuv kills ordinary spawned children when Electron exits. DETACHED_PROCESS
  // makes Windows PowerShell exit before its script on supported Windows hosts.
  // A short-lived, hidden bootstrap uses .NET to start the real helper outside
  // libuv's kill-on-close job, retaining normal PowerShell initialization.
  const identity=requestFile+'.helper.json';
  const bootstrap=`
$ErrorActionPreference='Stop'
[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false)
$start=[Diagnostics.ProcessStartInfo]::new()
$start.FileName=Join-Path $PSHOME 'powershell.exe'
$start.Arguments='-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "'+$env:NOVA_UPDATE_HELPER+'" -RequestFile "'+$env:NOVA_UPDATE_REQUEST+'"'
$start.WorkingDirectory=$env:NOVA_UPDATE_CACHE
$start.UseShellExecute=$false
$start.CreateNoWindow=$true
$process=[Diagnostics.Process]::Start($start)
if(-not $process){throw 'The update helper could not be started.'}
try {
  [IO.File]::WriteAllText($env:NOVA_UPDATE_IDENTITY,(@{pid=$process.Id;started=$process.StartTime.ToUniversalTime().ToString('o')}|ConvertTo-Json -Compress),[Text.UTF8Encoding]::new($false))
} finally {$process.Dispose()}
`;
  // Use a small identity file, not inherited pipes which can keep execFile's
  // close callback waiting for the long-running grandchild to finish.
  await new Promise((resolve,reject)=>{
    const child=spawn('powershell.exe',[
      '-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(bootstrap,'utf16le').toString('base64')
    ],{cwd:cache,windowsHide:true,stdio:'ignore',
      env:{...process.env,NOVA_UPDATE_HELPER:helper,NOVA_UPDATE_REQUEST:requestFile,NOVA_UPDATE_CACHE:cache,NOVA_UPDATE_IDENTITY:identity}});
    const timeout=setTimeout(()=>{child.kill();reject(new Error('The update bootstrap timed out. The launcher was kept open.'));},15000);
    child.once('error',error=>{clearTimeout(timeout);reject(error);});
    child.once('exit',code=>{clearTimeout(timeout);if(code===0)resolve();else reject(new Error(`The update bootstrap exited with code ${code}.`));});
  });
  const processInfo=JSON.parse(await fs.readFile(identity,'utf8'));
  if(!Number.isSafeInteger(processInfo.pid)||processInfo.pid<1||typeof processInfo.started!=='string'||!Number.isFinite(Date.parse(processInfo.started)))
    throw new Error('The update helper did not report a valid process identity.');
  return processInfo;
}
export async function pendingUpdateIsRunning(pending,target,{now=Date.now(),processStarted=processStartTime}={}) {
  if(!pending || pending.target!==target || !Number.isSafeInteger(pending.pid) || pending.pid<1 ||
    !Number.isSafeInteger(pending.startedAt) || pending.startedAt>now || now-pending.startedAt>=15*60*1000 ||
    typeof pending.helperStarted!=='string' || !Number.isFinite(Date.parse(pending.helperStarted)))return false;
  // A PID may have been reused after an installer crash. Only that exact helper
  // may suppress a concurrent launch, never an unrelated process with its PID.
  try{return await processStarted(pending.pid)===pending.helperStarted;}catch{return false;}
}
export async function launchUpdateHelper({file,sha256,version,kind,target,cache,helperSource,quit,parentPid=process.pid}) {
  if(!Number.isSafeInteger(parentPid)||parentPid<1)throw new Error('Invalid launcher process.');
  if(!['portable','nsis'].includes(kind)||!path.isAbsolute(target)||path.extname(target).toLowerCase()!=='.exe')throw new Error('This launcher cannot be updated in place.');
  if(path.resolve(path.dirname(file))!==path.resolve(cache))throw new Error('Invalid cached update path.');
  const id=randomUUID(),requestFile=path.join(cache,`${id}.json`),helper=path.join(cache,`${id}.ps1`);
  const ready=path.join(cache,`${id}.ready`),result=path.join(cache,'update-result.json'),pending=path.join(cache,'installing.json');
  // Query only our own process's creation time to guard against PID reuse.
  const parentStarted=await processStartTime(parentPid);
  await fs.copyFile(helperSource,helper);
  await fs.writeFile(requestFile,JSON.stringify({id,parentPid,parentStarted,source:file,target,kind,sha256,currentSha256:await fileHash(target),version,ready,result,pending}),{flag:'wx'});
  try {
    const helperProcess=await startIndependentHelper({helper,requestFile,cache});
    let prepared=false;
    for(let i=0;i<300;i++) {
      try {process.kill(helperProcess.pid,0);} catch {throw new Error('The update helper stopped before the installation was ready.');}
      if(await fs.access(ready).then(()=>true).catch(()=>false)){prepared=true;break;}
      await delay(100);
    }
    if(!prepared)throw new Error('The update helper did not become ready. The launcher was kept open.');
    const helperStarted=await processStartTime(helperProcess.pid);
    if(helperStarted!==helperProcess.started)throw new Error('The update helper process changed before handoff.');
    await fs.writeFile(pending,JSON.stringify({id,pid:helperProcess.pid,target,helperStarted,startedAt:Date.now()}));
    await fs.writeFile(requestFile+'.apply','apply',{flag:'wx'});
    quit();return {pid:helperProcess.pid,requestFile};
  }catch(error){
    // No handoff means the helper must not replace anything, even if the app later exits.
    await fs.rm(requestFile+'.apply',{force:true});
    await fs.rm(pending,{force:true});
    throw error;
  }
}
