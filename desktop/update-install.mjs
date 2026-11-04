import fs from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {spawn,execFile} from 'node:child_process';
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
  // Windows children survive their parent's exit without DETACHED_PROCESS.
  // That flag makes Windows PowerShell exit before running its script on some hosts.
  const child=spawn('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',helper,'-RequestFile',requestFile],{cwd:cache,windowsHide:true,stdio:'ignore'});
  let failure;
  child.on('error',error=>{failure=error;});
  child.on('exit',()=>{failure=new Error('The update helper stopped before the installation was ready.');});
  try {
    let prepared=false;
    for(let i=0;i<300;i++) {
      if(failure)throw failure;
      if(await fs.access(ready).then(()=>true).catch(()=>false)){prepared=true;break;}
      await delay(100);
    }
    if(!prepared)throw new Error('The update helper did not become ready. The launcher was kept open.');
    const helperStarted=await processStartTime(child.pid);
    await fs.writeFile(pending,JSON.stringify({id,pid:child.pid,target,helperStarted,startedAt:Date.now()}));
    await fs.writeFile(requestFile+'.apply','apply',{flag:'wx'});
    child.unref();quit();return {pid:child.pid,requestFile};
  }catch(error){
    // No handoff means the helper must not replace anything, even if the app later exits.
    await fs.rm(requestFile+'.apply',{force:true});
    await fs.rm(pending,{force:true});
    child.unref();throw error;
  }
}
