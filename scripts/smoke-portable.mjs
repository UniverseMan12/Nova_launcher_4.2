import { chromium, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { ROOT } from '../src/config.js';
const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'launcher-portable-'));
const probe=net.createServer();await new Promise(resolve=>probe.listen(0,'127.0.0.1',resolve));
const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));
const env={...process.env,LAUNCHER_TEST_DATA:temporary};delete env.ELECTRON_RUN_AS_NODE;
const child=spawn(path.join(ROOT,'dist/NOVA-DROP-0.4.1-x64-portable.exe'),[`--remote-debugging-port=${port}`],{env,windowsHide:true,stdio:'ignore'});
const closed=new Promise(resolve=>child.once('close',resolve));
let browser,page;
try {
  let ready=false;
  for(let i=0;i<120;i++) {try{const response=await fetch(`http://127.0.0.1:${port}/json/version`,{signal:AbortSignal.timeout(500)});if(response.ok){ready=true;break;}}catch{}await delay(500);}
  if(!ready)throw new Error('Portable launcher did not open its test endpoint.');
  browser=await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
  const context=browser.contexts()[0];
  page=context.pages()[0] || await context.waitForEvent('page');
  await expect(page.locator('#app-version')).toHaveText('0.4.1');
  await expect(page).toHaveTitle('NOVA DROP');
  await expect(page.locator('.brand img')).toHaveJSProperty('complete',true);
  expect(await page.locator('.brand img').evaluate(image=>image.naturalWidth)).toBeGreaterThan(256);
  await expect(page.locator('.hero-art')).toHaveJSProperty('complete',true);
  expect(await page.locator('.hero-art').evaluate(image=>image.naturalWidth)).toBeGreaterThan(1000);
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.screenshot({path:path.join(ROOT,'dist/launcher-preview.png')});
  await page.locator('[data-rules="thanos"]').click();
  await expect(page.locator('#mode-note')).toContainText('Thanos is preselected');
  await expect(page.locator('.hero-art')).toHaveAttribute('src','art/thanos-gauntlet.jpg');
  await expect(page.locator('.hero-art')).toHaveJSProperty('complete',true);
  expect(await page.locator('.hero-art').evaluate(image=>image.naturalWidth)).toBeGreaterThan(500);
  await page.locator('[data-page="setup"]').click();
  await page.locator('#game-path').fill(path.join(temporary,'missing-game'));
  await page.locator('.advanced summary').click();
  await page.locator('#check').click();
  await expect(page.locator('#error-banner')).toContainText('missing FortniteGame',{timeout:45000});
  await expect(page.locator('#stop')).toBeHidden();
  console.log('PASS: portable self-extraction, initial UI, verified payload bootstrap, validation failure and clean close.');
} finally {
  if(page)await page.evaluate(()=>window.launcher.close()).catch(()=>{});
  await browser?.close();
  await Promise.race([closed,delay(15000)]);
  if(child.exitCode===null)child.kill();
  fs.rmSync(temporary,{recursive:true,force:true,maxRetries:10,retryDelay:200});
}
