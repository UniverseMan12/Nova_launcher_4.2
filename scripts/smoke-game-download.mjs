import { _electron as electron, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {ROOT} from '../src/config.js';

// Optional live-network check: download only enough data to verify cancellation
// and resuming in the packaged launcher. The script owns and removes its cache.
const temporary=await fs.mkdtemp(path.join(os.tmpdir(),'fortnite-download-smoke-'));
const destination=path.join(temporary,'games');await fs.mkdir(destination);
const userData=path.join(temporary,'profile');
const env={...process.env,LAUNCHER_TEST_DATA:userData};delete env.ELECTRON_RUN_AS_NODE;
let app;
try {
  app=await electron.launch({executablePath:path.join(ROOT,'dist/win-unpacked/NOVA DROP.exe'),env});
  const page=await app.firstWindow();
  await expect(page.locator('#app-version')).toHaveText('0.4.4');
  await app.evaluate(({dialog},folder)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[folder]});},destination);
  await expect(page.locator('#launch-label')).toHaveText('Download Fortnite 4.2');
  const manifest=JSON.parse(await fs.readFile(path.join(ROOT,'game-download.json'),'utf8'));
  const partial=path.join(destination,'.fortnite-4.2-download',manifest.sha256+'.7z.part');
  let previous=0;
  for(let attempt=0;attempt<2;attempt++) {
    await page.locator('#launch').click();
    await expect.poll(async()=>{
      const error=await page.locator('#error-banner').isVisible();
      if(error)throw new Error(await page.locator('#error-banner').textContent());
      return (await fs.stat(partial).catch(()=>({size:0}))).size;
    },{timeout:60000}).toBeGreaterThan(previous+1024*1024);
    await page.locator('#stop').click();
    await expect(page.locator('#launch')).toBeEnabled({timeout:20000});
    await expect(page.locator('#download-info')).toContainText('resume');
    previous=(await fs.stat(partial)).size;
    await expect(page.locator('#game-path')).toHaveValue('');
  }
  await assertNoFinalFolder();
  console.log('PASS: packaged native folder selection, real Drive transfer, cancellation, retained partial bytes and resume; no incomplete game selected.');
} finally {
  await app?.close();
  await fs.rm(temporary,{recursive:true,force:true,maxRetries:10,retryDelay:200});
}
async function assertNoFinalFolder() {
  try {await fs.stat(path.join(destination,'Fortnite-4.2'));throw new Error('An incomplete game folder was published.');}
  catch(error) {if(error.code!=='ENOENT')throw error;}
}
