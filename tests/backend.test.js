import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { ROOT } from '../src/config.js';
import { startBackend, assertFreePort } from '../src/backend.js';
import { patchBackend } from '../scripts/patch-backend.js';
import { createRequire } from 'node:module';
import crypto from 'node:crypto';
import inputSettings from '../scripts/backend-extensions/launcher-input.cjs';

const vendor = path.join(ROOT, 'vendor', 'LawinServer');
test('cancelled backend startup does not acquire a port or leave a process', async () => {
  const controller = new AbortController(); controller.abort();
  await assert.rejects(startBackend({ signal: controller.signal }), /abort/i);
});
test('failed backend spawn rejects promptly instead of waiting forever for a past close event', {timeout:5000}, async () => {
  await assert.rejects(startBackend({directory:path.join(os.tmpdir(),`missing-backend-${Date.now()}`),port:await unusedPort(),xmppPort:await unusedPort()}), /ENOENT|spawn/);
});
async function unusedPort() {
  const server = net.createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}
test('local backend: login, profile, F8 hotfix, matchmaking and XMPP readiness', { timeout: 30000 }, async t => {
  assert.ok(fs.existsSync(path.join(vendor, 'node_modules')), 'Run npm run setup first.');
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'fortnite-backend-test-'));
  let backend;
  t.after(async () => {
    await backend?.stop();
    fs.rmSync(temporary, { recursive: true, force: true });
  });
  fs.cpSync(vendor, temporary, { recursive: true, filter: source => !['.git', 'node_modules'].includes(path.basename(source)) });
  fs.symlinkSync(path.join(vendor, 'node_modules'), path.join(temporary, 'node_modules'), 'junction');
  patchBackend(temporary);
  const once = fs.readFileSync(path.join(temporary, 'index.js'), 'utf8');
  patchBackend(temporary);
  assert.equal(fs.readFileSync(path.join(temporary, 'index.js'), 'utf8'), once, 'patches are idempotent');
  const unicodeHotfix='; Grösse und Steuerung\n[/Script/Test]\nLabel=é\n';
  fs.writeFileSync(path.join(temporary,'CloudStorage','UnicodeFixture.ini'),unicodeHotfix,'utf8');
  const port = await unusedPort(), xmppPort = await unusedPort();
  backend = await startBackend({ directory: temporary, port, xmppPort, profileDirectory:path.join(temporary,'profile'), settingsRoot:temporary });
  await assert.rejects(assertFreePort(port), /already in use/);
  const headers = { 'user-agent': 'Fortnite/++Fortnite+Release-4.2-CL-4072250 Windows/10', 'content-type': 'application/json' };
  const request = (route, options = {}) => fetch(`${backend.url}${route}`, { headers, ...options });
  const health = await (await request('/local/health')).json();
  assert.equal(health.ready, true);
  const auth = await (await request('/account/api/oauth/token', { method: 'POST', body: JSON.stringify({ username: 'TestPlayer@local.invalid', grant_type: 'password', password: 'LocalOnly' }) })).json();
  assert.equal(auth.account_id, 'TestPlayer'); assert.ok(auth.access_token);
  const status = await (await request('/lightswitch/api/service/bulk/status')).json();
  assert.equal(status[0].status, 'UP');
  const input = await (await request('/fortnite/api/cloudstorage/system/DefaultInput.ini')).text();
  assert.match(input, /ConsoleKeys=F8/);
  const cloudFiles=await (await request('/fortnite/api/cloudstorage/system')).json();
  const cloudMeta=cloudFiles.find(file=>file.filename==='UnicodeFixture.ini');
  const cloudBytes=Buffer.from(await (await request('/fortnite/api/cloudstorage/system/UnicodeFixture.ini')).arrayBuffer());
  assert.equal(cloudMeta.length,cloudBytes.length,'System hotfix metadata must match UTF-8 download bytes');
  assert.equal(cloudMeta.hash256,crypto.createHash('sha256').update(cloudBytes).digest('hex'));
  assert.equal(cloudBytes.toString('utf8'),unicodeHotfix);
  const profileResponse = await request('/fortnite/api/game/v2/profile/TestPlayer/client/QueryProfile?profileId=athena&rvn=-1', { method: 'POST', body: '{}' });
  assert.equal(profileResponse.status, 200);
  const profile = await profileResponse.json();
  assert.equal(profile.profileChanges[0].profile.profileId, 'athena');
  for (const query of ['profileId=..%2fpackage', 'profileId=unknown', 'profileId=athena&profileId=common_core', 'profileId[x]=athena']) {
    const rejected = await request(`/fortnite/api/game/v2/profile/TestPlayer/client/QueryProfile?${query}`, {method:'POST',body:'{}'});
    assert.equal(rejected.status, 404, `Reject invalid profile selection: ${query}`);
  }
  const session = await (await request('/fortnite/api/matchmaking/session/local')).json();
  assert.equal(session.serverAddress, '127.0.0.1'); assert.equal(session.serverPort, 7777);
  const unknown = await request('/this-route-does-not-exist'); assert.equal(unknown.status, 404);
  const badCommand = await request('/fortnite/api/game/v2/profile/TestPlayer/client/SetAffiliateName?profileId=common_core', {method:'POST',body:'{}'});
  assert.equal(badCommand.status, 500, 'async route errors must become responses, not process exits');
  const traversal = await request('/fortnite/api/cloudstorage/system/..%2fConfig%2fconfig.ini');
  assert.equal(traversal.status,404);
  const tooLarge = await request('/fortnite/api/cloudstorage/user/TestPlayer/ClientSettings.Sav', {method:'PUT',headers:{...headers,'content-type':'application/octet-stream'},body:Buffer.alloc(1024*1024+1)});
  assert.equal(tooLarge.status,413);
  const require = createRequire(path.join(vendor, 'package.json'));
  const WebSocket = require('ws');
  await new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${xmppPort}`, 'xmpp');
    const timeout = setTimeout(() => { ws.terminate(); reject(new Error('XMPP timeout')); }, 3000);
    ws.once('error', reject);
    ws.once('open', () => ws.send('<open xmlns="urn:ietf:params:xml:ns:xmpp-framing" to="prod.ol.epicgames.com" version="1.0"/>'));
    ws.once('message', data => { clearTimeout(timeout); assert.match(data.toString(), /<open/); ws.close(); resolve(); });
  });
  await new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${xmppPort}`, 'xmpp');
    const timeout = setTimeout(()=>{ws.terminate();reject(new Error('Malformed XMPP test timeout'));},3000);
    ws.once('error', error=>{clearTimeout(timeout);reject(error);});
    ws.once('open',()=>ws.send(`<auth>${Buffer.from('\0XmppTester\0LocalOnly').toString('base64')}</auth>`));
    ws.on('message',data=>{
      const xml=data.toString();
      if (xml.includes('<success')) ws.send('<iq id="_xmpp_bind1"><bind><resource>test</resource></bind></iq>');
      else if (xml.includes('<iq')) ws.send('<message><body>null</body></message>');
    });
    ws.once('close',code=>{clearTimeout(timeout);try{assert.equal(code,1008);resolve();}catch(error){reject(error);}});
  });
  assert.equal((await (await request('/local/health')).json()).ready,true);
  assert.equal((await (await request('/fortnite/api/matchmaking/session/local')).json()).serverAddress,'127.0.0.1');
});

test('guest Play targets the VPN host while host Play stays local; player identities are distinct', { timeout: 30000 }, async t => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'fortnite-multiplayer-test-'));
  const backends = [];
  t.after(async () => {
    await Promise.all(backends.map(backend => backend.stop()));
    fs.rmSync(temporary, { recursive: true, force: true });
  });
  const instances = [];
  for (const [name, gameHost] of [['HostPlayer', '127.0.0.1'], ['GuestPlayer', '25.42.43.44']]) {
    const directory = path.join(temporary, name);
    fs.cpSync(vendor, directory, { recursive: true, filter: source => !['.git', 'node_modules'].includes(path.basename(source)) });
    fs.symlinkSync(path.join(vendor, 'node_modules'), path.join(directory, 'node_modules'), 'junction');
    patchBackend(directory);
    const matchmaking = path.join(directory, 'structure', 'matchmaking.js');
    const once = fs.readFileSync(matchmaking, 'utf8');
    patchBackend(directory);
    assert.equal(fs.readFileSync(matchmaking, 'utf8'), once);
    const xmppPort = await unusedPort();
    const backend = await startBackend({ directory, port: await unusedPort(), xmppPort, gameHost, profileDirectory:path.join(directory,'profile'), settingsRoot:directory });
    backends.push(backend);
    instances.push({ backend, name, gameHost, xmppPort });
  }
  const accountIds = [];
  for (const { backend, name, gameHost, xmppPort } of instances) {
    const headers = { 'content-type': 'application/json', 'user-agent': 'Fortnite/++Fortnite+Release-4.2-CL-4072250 Windows/10' };
    const auth = await (await fetch(`${backend.url}/account/api/oauth/token`, {
      method: 'POST', headers, body: JSON.stringify({ username: `${name}@local.invalid`, password: 'LocalOnly', grant_type: 'password' })
    })).json();
    accountIds.push(auth.account_id);
    const ticket = await (await fetch(`${backend.url}/fortnite/api/game/v2/matchmakingservice/ticket/player/${auth.account_id}?bucketId=123:EU:solo`, { headers })).json();
    assert.equal(ticket.serviceUrl, `ws://127.0.0.1:${xmppPort}`);
    const match = await (await fetch(`${backend.url}/fortnite/api/matchmaking/session/local`, { headers })).json();
    assert.equal(match.serverAddress, gameHost);
    assert.equal(match.serverPort, 7777);
    const profile = await (await fetch(`${backend.url}/fortnite/api/game/v2/profile/${auth.account_id}/client/QueryProfile?profileId=athena&rvn=-1`, { method: 'POST', headers, body: '{}' })).json();
    assert.equal(profile.profileChanges[0].profile.profileId, 'athena');
  }
  assert.deepEqual(accountIds, ['HostPlayer', 'GuestPlayer']);
  // A later solo launch must not inherit the guest route from any saved INI file.
  await backends[1].stop();
  const restarted = await startBackend({ directory: path.join(temporary, 'GuestPlayer'), port: await unusedPort(), xmppPort: await unusedPort(), profileDirectory:path.join(temporary,'guest-profile'),settingsRoot:temporary });
  backends.push(restarted);
  const match = await (await fetch(`${restarted.url}/fortnite/api/matchmaking/session/local`)).json();
  assert.equal(match.serverAddress, '127.0.0.1');
});

test('settings hashes match downloads, Auto-Sprint is reversible, and locker survives a fresh release payload', {timeout:30000}, async t => {
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'launcher-settings-test-'));
  let backend;
  t.after(async()=>{await backend?.stop();fs.rmSync(temporary,{recursive:true,force:true});});
  const profileDirectory=path.join(temporary,'persistent');
  const makeBackend = async (name, autoSprint) => {
    const directory=path.join(temporary,name);
    fs.cpSync(vendor,directory,{recursive:true,filter:source=>!['.git','node_modules'].includes(path.basename(source))});
    fs.symlinkSync(path.join(vendor,'node_modules'),path.join(directory,'node_modules'),'junction');
    patchBackend(directory);
    return startBackend({directory,profileDirectory,autoSprint,settingsRoot:temporary,port:await unusedPort(),xmppPort:await unusedPort()});
  };
  const userAgent='Fortnite/++Fortnite+Release-4.2-CL-4072250 Windows/10';
  const request=(route,options={})=>fetch(backend.url+route,{headers:{'user-agent':userAgent,'content-type':'application/json'},...options});
  const user='/fortnite/api/cloudstorage/user/TestPlayer';
  const download=async()=>Buffer.from(await (await request(user+'/ClientSettings.Sav')).arrayBuffer());
  const upload=bytes=>request(user+'/ClientSettings.Sav',{method:'PUT',headers:{'user-agent':userAgent,'content-type':'application/octet-stream'},body:bytes});
  backend=await makeBackend('release-one',true);
  let bytes=await download();let parsed=inputSettings.parse(bytes);
  assert.equal(parsed.sprint[0].value,'F12');assert.equal(bytes[parsed.toggle.boolOffset],0);
  let [meta]=await (await request(user)).json();
  assert.equal(meta.length,bytes.length);assert.equal(meta.hash256,crypto.createHash('sha256').update(bytes).digest('hex'));
  assert.equal((await upload(bytes)).status,204);
  const disk=fs.readFileSync(path.join(temporary,'LawinServer/ClientSettings/ClientSettings-4072250.Sav'));
  assert.equal(inputSettings.parse(disk).sprint[0].value,'None');
  const profileUrl='/fortnite/api/game/v2/profile/TestPlayer/client/';
  const profile=(await (await request(profileUrl+'QueryProfile?profileId=athena&rvn=-1',{method:'POST',body:'{}'})).json()).profileChanges[0].profile;
  const outfit='AthenaCharacter:CID_035_Athena_Commando_M_Medieval';
  const glider=Object.keys(profile.items).find(id=>id.startsWith('AthenaGlider:'));
  const emote=Object.keys(profile.items).find(id=>id.startsWith('AthenaDance:'));
  assert.ok(outfit && glider && emote);
  for(const [slotName,itemToSlot] of [['Character',outfit],['Glider',glider],['Dance',emote]]) {
    const response=await request(profileUrl+'EquipBattleRoyaleCustomization?profileId=athena&rvn=-1',{method:'POST',body:JSON.stringify({slotName,itemToSlot,indexWithinSlot:0,variantUpdates:[]})});
    assert.equal(response.status,200);
  }
  await backend.stop(); backend=await makeBackend('release-two',false);
  bytes=await download();assert.deepEqual(bytes,disk,'Off returns the original sprint preference');
  [meta]=await (await request(user)).json();assert.equal(meta.hash,crypto.createHash('sha1').update(bytes).digest('hex'));assert.equal(meta.length,bytes.length);
  const after=(await (await request(profileUrl+'QueryProfile?profileId=athena&rvn=-1',{method:'POST',body:'{}'})).json()).profileChanges[0].profile;
  assert.equal(after.stats.attributes.favorite_character,outfit);assert.equal(after.stats.attributes.favorite_glider,glider);assert.equal(after.stats.attributes.favorite_dance[0],emote);
  const arbitrary=Buffer.from([0,0x80,0xff,0xc3,0x28]);assert.equal((await upload(arbitrary)).status,204);
  [meta]=await (await request(user)).json();assert.equal(meta.length,arbitrary.length);assert.equal(meta.hash256,crypto.createHash('sha256').update(arbitrary).digest('hex'));assert.deepEqual(await download(),arbitrary);
});
