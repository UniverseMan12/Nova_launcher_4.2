import { _electron as electron, expect } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ROOT } from '../src/config.js';

const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'fortnite-release-smoke-'));
const userData = path.join(temporary, 'profile'), fakeGame = path.join(temporary, 'game');
for (const folder of ['Engine','FortniteGame/Binaries/Win64','FortniteGame/Content/Paks']) fs.mkdirSync(path.join(fakeGame,folder),{recursive:true});
const exe = Buffer.alloc(512); exe.write('MZ');exe.writeUInt32LE(128,60);exe.write('PE\0\0',128);exe.writeUInt16LE(0x8664,132);exe.write('++Fortnite+Release-4.2-CL-4072250 ',200);
fs.writeFileSync(path.join(fakeGame,'FortniteGame/Binaries/Win64/FortniteClient-Win64-Shipping.exe'),exe);
fs.writeFileSync(path.join(fakeGame,'FortniteGame/Content/Paks/test.pak'),'fixture');
const env = {...process.env,LAUNCHER_TEST_DATA:userData};delete env.ELECTRON_RUN_AS_NODE;
let app;
try {
  app = await electron.launch({ executablePath:process.env.LAUNCHER_PACKAGED_EXE || path.join(ROOT,'dist/win-unpacked/NOVA DROP.exe'),env });
  const page = await app.firstWindow();
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await expect(page.locator('#app-version')).toHaveText('0.4.3');
  if (['thanos','infinity'].includes(process.env.LAUNCHER_SMOKE_RULES)) await page.locator(`[data-rules="${process.env.LAUNCHER_SMOKE_RULES}"]`).click();
  await page.locator('[data-page="setup"]').click();
  await page.locator('#game-path').fill(process.env.LAUNCHER_SMOKE_GAME || fakeGame);
  await page.locator('.advanced summary').click();
  await page.locator('#check').click();
  await expect(page.locator('#activity-list')).toContainText('Fortnite 4.2 verified',{timeout:45000});
  await expect(page.locator('#stop')).toBeHidden();
  await page.locator('[data-page="setup"]').click();
  await page.locator('#prepare').click();
  await expect(page.locator('#activity-list')).toContainText('Components ready',{timeout:180000});
  await expect(page.locator('#stop')).toBeHidden();
  await expect(page.locator('#error-banner')).toBeHidden();
  if (process.env.LAUNCHER_SMOKE_GAME) {
    await page.locator('[data-page="play"]').click();
    await page.locator('[data-mode="host"]').click();
    await page.locator('#launch').click();
    await expect(page.locator('#activity-list')).toContainText('Choose a playlist in Reboot',{timeout:180000});
    await page.locator('#stop').click();
    await expect(page.locator('#stop')).toBeHidden({timeout:30000});
    await expect(page.locator('#status-message')).toContainText('Session stopped.');
    console.log('PASS: packaged host starts the real game helper and cancels cleanly.');
  }
  await page.locator('[data-page="play"]').click();
  await page.locator('[data-mode="join"]').click();
  await page.locator('#host-address').fill('8.8.8.8');
  await page.locator('#launch').click();
  await expect(page.locator('#error-banner')).toContainText('host Hamachi');
  await expect(page.locator('#stop')).toBeHidden();
  expect(errors).toEqual([]);
  await page.locator('[data-mode="solo"]').click();
  await page.evaluate(()=>document.getElementById('error-banner').hidden=true);
  await page.screenshot({path:path.join(ROOT,'dist','launcher-preview.png')});
  console.log('PASS: fresh packaged profile, verified payload, build detection, first-use preparation, rejected public host, no renderer errors.');
} finally {
  await app?.close();
  // This directory is created by this script with a fixed prefix, never by user input.
  fs.rmSync(temporary,{recursive:true,force:true,maxRetries:10,retryDelay:200});
}
