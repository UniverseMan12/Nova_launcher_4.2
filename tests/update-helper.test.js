import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {randomUUID} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileHash} from '../desktop/updates.mjs';

for(const scenario of ['bad checksum','cancelled handoff','changed target']) {
  test(`Windows helper preserves the old launcher on ${scenario}`,{skip:process.platform!=='win32'},async()=>{
    const root=await fs.mkdtemp(path.join(os.tmpdir(),'nova-helper-'));
    try {
      const target=path.join(root,'old launcher.exe'),source=path.join(root,'new launcher.exe');
      await fs.writeFile(target,'old fixture - never execute');await fs.writeFile(source,'new fixture - never execute');
      const requestFile=path.join(root,'request.json'),ready=path.join(root,'ready'),result=path.join(root,'result.json');
      const request={id:randomUUID(),kind:'portable',parentPid:2147483647,parentStarted:new Date().toISOString(),source,target,version:'0.4.2',ready,result,pending:path.join(root,'pending.json'),sha256:await fileHash(source),currentSha256:await fileHash(target)};
      if(scenario==='bad checksum')request.sha256='0'.repeat(64);
      if(scenario==='changed target')request.currentSha256='0'.repeat(64);
      await fs.writeFile(requestFile,JSON.stringify(request));
      await assert.rejects(promisify(execFile)('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.resolve('desktop/install-update.ps1'),'-RequestFile',requestFile],{windowsHide:true,timeout:15000}));
      const receipt=JSON.parse(await fs.readFile(result));assert.equal(receipt.success,false);
      assert.match(receipt.message,scenario==='cancelled handoff'?/cancelled.*handoff/:/verification failed/);
      assert.equal(await fs.readFile(target,'utf8'),'old fixture - never execute');
      assert.equal((await fs.readdir(root)).some(name=>name.includes('.nova-')),false);
    } finally {await fs.rm(root,{recursive:true,force:true});}
  });
}
