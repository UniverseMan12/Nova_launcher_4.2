import { test, expect, _electron as electron } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

let app, page, userData;
const sendUpdate=(value)=>app.evaluate(({BrowserWindow},value)=>BrowserWindow.getAllWindows()[0].webContents.send('launcher:update',value),value);
test.beforeEach(async () => {
  userData = fs.mkdtempSync(path.join(os.tmpdir(), 'launcher-ui-'));
  const env = { ...process.env, LAUNCHER_TEST_DATA: userData }; delete env.ELECTRON_RUN_AS_NODE;
  app = await electron.launch({ args: ['.'], env });
  page = await app.firstWindow();
  await expect(page.locator('#app-version')).toHaveText('0.4.3');
  await expect(page).toHaveTitle('NOVA DROP');
  await expect(page.locator('.brand img')).toHaveJSProperty('complete',true);
  expect(await page.locator('.brand img').evaluate(image=>image.naturalWidth)).toBeGreaterThan(256);
});
test.afterEach(async () => { await app?.close(); fs.rmSync(userData, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }); });

test('Auto-Sprint persists and cannot be changed during a session', async () => {
  await page.locator('[data-page="setup"]').click();
  await page.locator('#auto-sprint').check();
  await expect.poll(()=>JSON.parse(fs.readFileSync(path.join(userData,'settings.json'),'utf8')).autoSprint).toBe(true);
  await page.reload();await page.locator('[data-page="setup"]').click();
  await expect(page.locator('#auto-sprint')).toBeChecked();
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].webContents.send('launcher:state',{busy:true,phase:'launch',events:[],addresses:[]}));
  await expect(page.locator('#auto-sprint')).toBeDisabled();
});

test('upgrade changelog is modal, readable, dismisses once and can be reopened', async () => {
  await expect(page.locator('#changelog')).not.toBeVisible();
  await app.close();
  fs.writeFileSync(path.join(userData,'release-history.json'),JSON.stringify({seenVersion:'0.4.2'}));
  const env={...process.env,LAUNCHER_TEST_DATA:userData};delete env.ELECTRON_RUN_AS_NODE;
  app=await electron.launch({args:['.'],env});page=await app.firstWindow();
  await expect(page.locator('#changelog')).toBeVisible();
  await expect(page.locator('#changelog-version')).toHaveText('VERSION 0.4.3');
  await expect(page.locator('#changelog-items')).toContainText('Auto-Sprint');
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.screenshot({path:'test-results/launcher-changelog.png'});
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(940,700));
  expect(await page.locator('#changelog').evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
  await page.locator('#changelog-done').click();
  await expect(page.locator('#changelog')).not.toBeVisible();
  expect(JSON.parse(fs.readFileSync(path.join(userData,'release-history.json'),'utf8')).seenVersion).toBe('0.4.3');
  await page.reload();await expect(page.locator('#changelog')).not.toBeVisible();
  await page.locator('#open-changelog').click();await expect(page.locator('#changelog')).toBeVisible();
  await page.keyboard.press('Escape');await expect(page.locator('#changelog')).not.toBeVisible();
  await expect(page.locator('#open-changelog')).toBeFocused();
});

test('launcher update preference persists and development builds cannot install', async () => {
  await page.locator('#open-updates').click();
  await expect(page.locator('#launcher-update')).toBeVisible();
  await expect(page.locator('#update-check')).toBeDisabled();
  await page.locator('#update-auto').uncheck();
  await expect.poll(()=>JSON.parse(fs.readFileSync(path.join(userData,'update-preferences.json'),'utf8')).checkOnStart).toBe(false);
  await page.reload();
  await page.locator('#open-updates').click();
  await expect(page.locator('#update-auto')).not.toBeChecked();
  expect(await page.evaluate(()=>window.launcher.updateInstall().catch(e=>e.message))).toContain('Download and verify');
});

test('update notification, later, progress and session installation guard are visible', async () => {
  await page.emulateMedia({reducedMotion:'reduce'});
  await sendUpdate({phase:'available',version:'0.4.4',message:'NOVA DROP 0.4.4 is available.',checkOnStart:true});
  await expect(page.locator('#launcher-update')).toBeVisible();
  await expect(page.locator('#update-download')).toBeVisible();
  await expect(page.locator('#update-install')).toBeHidden();
  await page.locator('#update-later').click();
  await expect(page.locator('#launcher-update')).toBeHidden();
  await page.locator('#open-updates').click();
  await sendUpdate({phase:'downloading',version:'0.4.4',received:25,total:100,message:'Downloading the launcher update...'});
  await expect(page.locator('#update-progress')).toHaveJSProperty('value',25);
  await expect(page.locator('#update-cancel')).toBeVisible();
  await sendUpdate({phase:'ready',version:'0.4.4',message:'Update downloaded. Install and restart when you are ready.'});
  await expect(page.locator('#update-install')).toBeEnabled();
  const busyState={busy:true,phase:'launch',message:'Session running',events:[],addresses:[]};
  await app.evaluate(({BrowserWindow},state)=>BrowserWindow.getAllWindows()[0].webContents.send('launcher:state',state),busyState);
  await expect(page.locator('#update-install')).toBeDisabled();
  await expect(page.locator('#update-message')).toContainText('Stop your session');
  await app.evaluate(({BrowserWindow},state)=>BrowserWindow.getAllWindows()[0].webContents.send('launcher:state',{...state,busy:false}),busyState);
  await expect(page.locator('#update-install')).toBeEnabled();
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(940,700));
  await expect(page.locator('#update-install')).toBeInViewport();
  expect(await page.locator('main').evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
  await page.screenshot({path:'test-results/launcher-updates.png'});
});

test('navigation, mode selection and empty setup recovery', async () => {
  await expect(page.getByRole('heading', { name: 'Back to the island.' })).toBeVisible();
  await expect(page.locator('#launch-label')).toHaveText('Download Fortnite 4.2');
  await app.evaluate(({dialog})=>{dialog.showOpenDialog=async()=>({canceled:true,filePaths:[]});});
  await page.locator('#launch').click();
  await expect(page.locator('#error-banner')).toBeHidden();
  await expect(page.locator('#page-play')).toBeVisible();
  await page.locator('[data-mode="join"]').click();
  await expect(page.locator('#join-row')).toBeVisible();
  await page.locator('[data-mode="host"]').click();
  await expect(page.locator('#join-row')).toBeHidden();
  await expect(page.locator('#mode-note')).toContainText('Start Bus Countdown');
  await page.screenshot({ path: 'test-results/launcher-home.png' });
});

test('invalid installation fails visibly and allows another attempt', async () => {
  await page.locator('[data-page="setup"]').click();
  await page.locator('#game-path').fill(path.join(userData, 'missing-game'));
  await page.locator('.advanced summary').click();
  await page.locator('#check').click();
  await expect(page.locator('#error-banner')).toContainText('missing FortniteGame');
  await expect(page.locator('#launch')).toBeEnabled();
  await expect(page.locator('#activity-list')).toContainText('missing FortniteGame');
  const result = await page.evaluate(() => window.launcher.link('file:///C:/Windows').catch(e => e.message));
  expect(result).toBe('Unknown link.');
});

test('Infinity Showdown selects hosting and joining leaves rules to the host', async () => {
  await page.locator('[data-rules="thanos"]').click();
  await page.locator('#thanos-variant').selectOption('infinity');
  await expect(page.locator('[data-mode="host"]')).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('#rules-description')).toContainText('10 respawns');
  await expect(page.locator('#mode-note')).toContainText('click Start Bus');
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.locator('main').evaluate(el=>el.scrollTop=0);
  await page.screenshot({path:'test-results/infinity-showdown.png'});
  await page.locator('[data-mode="join"]').click();
  await expect(page.locator('#thanos-variant')).toBeDisabled();
  await expect(page.locator('#rules-description')).toContainText('Your host chooses');
  await page.locator('[data-mode="host"]').click();
  await page.locator('[data-rules="classic"]').click();
  await expect(page.locator('#mode-note')).toContainText('Start Bus Countdown');
});

test('renderer has no Node access and blocks injected script markup in errors', async () => {
  expect(await page.evaluate(() => typeof window.require)).toBe('undefined');
  expect(await page.evaluate(() => typeof window.process)).toBe('undefined');
  await page.locator('[data-page="setup"]').click();
  await page.locator('#game-path').fill('<img src=x onerror=window.pwned=1>');
  await page.locator('.advanced summary').click();
  await page.locator('#check').click();
  await expect(page.locator('#error-banner')).toBeVisible();
  expect(await page.evaluate(() => window.pwned)).toBeUndefined();
  expect(await page.locator('#error-banner img').count()).toBe(0);
});

test('one Thanos card selects either ruleset, persists and leaves join rules to the host', async () => {
  await page.locator('[data-rules="thanos"]').click();
  await expect(page.locator('#rules-description')).toContainText('Full map');
  await expect(page.locator('#rules-description')).toContainText('No Showdown respawns');
  await expect(page.locator('#mode-note')).toContainText('Thanos is preselected');
  await expect(page.locator('.hero-art')).toHaveAttribute('src','thanos.png');
  await expect(page.locator('.hero-art')).toHaveJSProperty('complete',true);
  expect(await page.locator('.hero-art').evaluate(image=>image.naturalWidth)).toBeGreaterThan(500);
  await expect.poll(()=>JSON.parse(fs.readFileSync(path.join(userData,'settings.json'),'utf8')).gameMode).toBe('thanos');
  await page.reload();
  await expect(page.locator('[data-rules="thanos"]')).toHaveAttribute('aria-pressed','true');
  await page.emulateMedia({reducedMotion:'reduce'});
  for (const [width,height] of [[940,700],[1200,820]]) {
    await app.evaluate(({BrowserWindow},size)=>BrowserWindow.getAllWindows()[0].setSize(...size),[width,height]);
    await expect(page.locator('#launch')).toBeInViewport();
    expect(await page.locator('.rules-picker').evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
    await page.screenshot({path:`test-results/thanos-${width}.png`});
  }
  await page.locator('[data-rules="thanos"]').click();
  await page.locator('#thanos-variant').selectOption('infinity');
  await expect(page.locator('.hero-art')).toHaveAttribute('src','thanos.png');
  await page.locator('[data-mode="join"]').click();
  await expect(page.locator('[data-rules="thanos"]')).toBeDisabled();
  await expect(page.locator('#rules-description')).toContainText('Your host chooses');
});

test('setup and invitations persist before launching and recover after a restart', async () => {
  await page.locator('[data-page="setup"]').click();
  await page.locator('#game-path').fill('C:/My Fortnite 4.2');
  await page.locator('#back-play').click();
  await page.locator('[data-mode="join"]').click();
  await page.locator('#host-address').fill('FN42:25.1.2.3');
  await expect.poll(()=>JSON.parse(fs.readFileSync(path.join(userData,'settings.json'),'utf8')).host).toBe('FN42:25.1.2.3');
  await app.close();
  const env={...process.env,LAUNCHER_TEST_DATA:userData}; delete env.ELECTRON_RUN_AS_NODE;
  app=await electron.launch({args:['.'],env}); page=await app.firstWindow();
  await expect(page.locator('#host-address')).toHaveValue('FN42:25.1.2.3');
  await expect(page.locator('#game-path')).toHaveValue('C:/My Fortnite 4.2');
  await expect(page.locator('#launch-label')).toHaveText('Join friend');
  expect(await page.evaluate(()=>window.launcher.copyInvite('25.1.2.3').catch(e=>e.message))).toContain('Start hosting');
});

test('startup finishes without blocking controls and reduced motion skips it', async () => {
  await expect(page.locator('#startup')).toBeHidden({timeout:3000});
  await expect(page.locator('#launch')).toBeInViewport();
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.reload();
  await expect(page.locator('#startup')).toBeHidden();
  await expect(page.locator('.brand img')).toHaveJSProperty('complete',true);
});

test('main Play button downloads without Settings and existing folders are preserved', async () => {
  await app.evaluate(({dialog})=>{dialog.showOpenDialog=async()=>({canceled:true,filePaths:[]});});
  await page.locator('#launch').click();
  await expect(page.locator('#launch')).toBeEnabled();
  await expect(page.locator('#page-play')).toBeVisible();
  await expect(page.locator('#game-path')).toHaveValue('');
  const folder=path.join(userData,'download-target');fs.mkdirSync(path.join(folder,'Fortnite-4.2'),{recursive:true});
  fs.writeFileSync(path.join(folder,'Fortnite-4.2','keep.txt'),'keep');
  await app.evaluate(({dialog},folder)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[folder]});},folder);
  await page.locator('#launch').click();
  await expect(page.locator('#error-banner')).toContainText('already exists',{timeout:30000});
  await expect(page.locator('#launch')).toBeEnabled();
  expect(fs.readFileSync(path.join(folder,'Fortnite-4.2','keep.txt'),'utf8')).toBe('keep');
  expect(JSON.parse(fs.readFileSync(path.join(userData,'settings.json'),'utf8')).gamePath || '').toBe('');
  await app.evaluate(({dialog})=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:['C:/Existing Fortnite']});});
  await page.locator('#edit-folder').click();
  await expect(page.locator('#game-path')).toHaveValue('C:/Existing Fortnite');
  await expect(page.locator('#launch-label')).toHaveText('Launch Fortnite');
  await expect(page.locator('#page-play')).toBeVisible();
  const bypass=await page.evaluate(()=>window.launcher.start('download',{mode:'solo',gamePath:'C:/arbitrary'}).catch(e=>e.message));
  expect(bypass).toContain('Unknown action');
});

test('game download progress, cancellation and installed-folder feedback stay usable', async () => {
  await page.emulateMedia({reducedMotion:'reduce'});
  const state={busy:true,action:'download',phase:'download',message:'Downloading Fortnite 4.2',events:[],addresses:[],progress:{stage:'downloading',received:1024**3,total:8*1024**3}};
  await app.evaluate(({BrowserWindow},state)=>BrowserWindow.getAllWindows()[0].webContents.send('launcher:state',state),state);
  await expect(page.locator('#download-bar')).toHaveJSProperty('value',12.5);
  await expect(page.locator('#download-info')).toContainText('1.00 / 8.00 GiB');
  await expect(page.locator('#stop')).toHaveText('Cancel installation');
  await expect(page.locator('#stop')).toBeVisible();
  await expect(page.locator('#launch')).toBeHidden();
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(940,700));
  await expect(page.locator('#stop')).toBeInViewport();
  await expect(page.locator('#download-info')).toBeInViewport();
  await page.screenshot({path:'test-results/game-download-progress.png'});
  const done={...state,busy:false,phase:'complete',message:'Fortnite 4.2 installed. Return to Play and launch.',installedPath:'C:/Games/Fortnite-4.2',progress:{stage:'checking',received:0,total:0}};
  await app.evaluate(({BrowserWindow},state)=>BrowserWindow.getAllWindows()[0].webContents.send('launcher:state',state),done);
  await expect(page.locator('#game-path')).toHaveValue('C:/Games/Fortnite-4.2');
  await expect(page.locator('#stop')).toBeHidden();
  await expect(page.locator('#launch-label')).toHaveText('Launch Fortnite');
  await expect(page.locator('#page-play')).toBeVisible();
  await expect(page.locator('#download-info')).toContainText('installed');
});

test('startup guidance retains the useful next action and clears expired invites', async () => {
  await page.locator('[data-mode="host"]').click();
  const state={busy:true,phase:'launch',message:'Keep this window open. Use Stop session to close the game.',events:[{type:'status',state:'ok',message:'Fortnite ready. Press Play in the lobby.',time:new Date().toISOString()},{type:'status',state:'info',message:'Keep this window open. Use Stop session to close the game.',time:new Date().toISOString()}],addresses:[{name:'Hamachi',address:'25.1.2.3'}]};
  await app.evaluate(({BrowserWindow},state)=>BrowserWindow.getAllWindows()[0].webContents.send('launcher:state',state),state);
  await expect(page.locator('#status-message')).toContainText('Press Play');
  await expect(page.getByRole('button',{name:'Copy invitation for Hamachi'})).toBeVisible();
  await app.evaluate(({BrowserWindow},state)=>BrowserWindow.getAllWindows()[0].webContents.send('launcher:state',{...state,busy:false,phase:'complete',addresses:[]}),state);
  await expect(page.locator('#addresses')).toBeHidden();
});

test('main process rejects overlapping starts and handles immediate cancellation', async () => {
  const replies = await page.evaluate(async () => {
    const options = { mode: 'solo', gamePath: 'C:/missing-launcher-test-folder', host: '' };
    const first = window.launcher.start('launch', options);
    const second = window.launcher.start('launch', options).catch(error => error.message);
    await window.launcher.stop();
    return Promise.all([first, second]);
  });
  expect(replies[0]).toBe(true);
  expect(replies[1]).toContain('already running');
  await expect(page.locator('#launch')).toBeVisible();
  await expect(page.locator('#stop')).toBeHidden();
});

test('layout fits the minimum window size and keeps primary controls accessible', async () => {
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(940, 700));
  await page.locator('[data-mode="join"]').click();
  await expect(page.locator('#host-address')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator('#launch').scrollIntoViewIfNeeded();
  await expect(page.locator('#launch')).toBeInViewport();
});

test('cinematic artwork, all pages and session controls fit supported window sizes', async () => {
  await expect(page.locator('.hero-art')).toHaveJSProperty('complete', true);
  expect(await page.locator('.hero-art').evaluate(image => image.naturalWidth)).toBeGreaterThan(1000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await page.locator('.rift-particles').evaluate(el => getComputedStyle(el).display)).toBe('none');
  for (const [width, height] of [[940,700],[1200,820],[1440,960]]) {
    await app.evaluate(({ BrowserWindow }, size) => BrowserWindow.getAllWindows()[0].setSize(...size), [width,height]);
    for (const name of ['play','setup','activity']) {
      await page.locator(`[data-page="${name}"]`).click();
      await expect(page.locator(`[data-page="${name}"]`)).toHaveAttribute('aria-current','page');
      expect(await page.locator('main').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
      await page.screenshot({ path: `test-results/redesign-${name}-${width}.png` });
    }
    await page.locator('[data-page="play"]').click();
    await expect(page.locator('#launch')).toBeInViewport();
    const description = await page.locator('.hero-content p').boundingBox();
    const launch = await page.locator('#launch').boundingBox();
    expect(description.y + description.height).toBeLessThan(launch.y);
    await page.locator('[data-mode="join"]').click();
    await expect(page.locator('#join-row')).toBeVisible();
    await expect(page.locator('[data-mode="join"]')).toHaveAttribute('aria-pressed','true');
    await expect(page.locator('#hero-mode')).toHaveText('JOIN YOUR SQUAD');
    expect(await page.locator('main').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    await page.locator('[data-mode="solo"]').click();
  }
});
