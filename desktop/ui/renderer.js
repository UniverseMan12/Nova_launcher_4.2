const $ = id => document.getElementById(id);
let mode = 'solo', busy = false, gameMode = 'classic', latestState, initialized = false;
let displayedInstall;
let launcherUpdate, updateDismissed=false, releaseChanges;
function showChanges() {
  if (!releaseChanges) return;
  $('changelog-version').textContent='VERSION '+releaseChanges.version;
  $('changelog-items').replaceChildren(...releaseChanges.changes.map(change=>{
    const item=document.createElement('section'), title=document.createElement('h3'), description=document.createElement('p');
    title.textContent=change.title;description.textContent=change.text;item.append(title,description);return item;
  }));
  if (!$('changelog').open) $('changelog').showModal();
}
async function closeChanges() {
  try {await window.launcher.acknowledgeChanges();$('changelog').close();}
  catch(error) {$('changelog-error').textContent=error.message;}
}
$('open-changelog').onclick=showChanges;
$('changelog-close').onclick=closeChanges;
$('changelog-done').onclick=closeChanges;
$('changelog').addEventListener('cancel',event=>{event.preventDefault();closeChanges();});
function renderUpdate(value) {
  launcherUpdate=value;
  if(['available','ready','downloading','installing','error'].includes(value.phase)&&!updateDismissed)$('launcher-update').hidden=false;
  $('update-title').textContent=value.version ? `NOVA DROP ${value.version}` : 'Launcher updates';
  $('update-message').textContent=value.phase==='ready'&&busy ? 'Update downloaded. Stop your session before restarting the launcher.' : value.message;
  $('update-auto').checked=value.checkOnStart!==false;
  const running=['checking','downloading','installing'].includes(value.phase);
  $('update-check').disabled=running||value.phase==='unsupported';
  $('update-check').hidden=value.phase==='ready';
  $('update-download').hidden=!['available','error'].includes(value.phase)||!value.version;
  $('update-install').hidden=value.phase!=='ready';$('update-install').disabled=busy;
  $('update-cancel').hidden=value.phase!=='downloading';
  $('update-later').disabled=value.phase==='installing';
  $('update-progress').hidden=value.phase!=='downloading';
  $('update-progress').value=value.total ? Math.round(value.received/value.total*100) : 0;
  $('open-updates').textContent=['available','ready'].includes(value.phase)?'Update available ↻':'Launcher updates ↻';
}
function saveSettings() {
  if (initialized && !busy) return safely(() => window.launcher.saveSettings({autoSprint:$('auto-sprint').checked, mode, gameMode, gamePath:$('game-path').value, host:$('host-address').value}));
}
const titles = { play: 'Back to the island.', setup: 'A little setup. Then play.', activity: 'Your session, step by step.' };
const notes = {
  solo: 'Play on your own. Your mode is preselected in Reboot. Click Start server, then Play in Fortnite.',
  host: 'Use the same LAN or VPN. Copy an invitation once hosting starts. When everyone is on the island, click Start Bus Countdown in Reboot.',
  join: 'Paste your friend’s invitation. You both need Fortnite 4.2 and the same LAN or VPN network.'
};
function showPage(name) {
  document.querySelectorAll('.page').forEach(el => { el.hidden = el.id !== 'page-' + name; });
  document.querySelectorAll('.nav').forEach(el => {
    el.classList.toggle('active', el.dataset.page === name);
    if (el.dataset.page === name) el.setAttribute('aria-current', 'page'); else el.removeAttribute('aria-current');
  });
  $('page-title').textContent = titles[name];
  document.querySelector('main').scrollTop = 0;
}
function selectMode(value) {
  mode = value;
  document.querySelectorAll('.mode').forEach(el => { const selected = el.dataset.mode === mode; el.classList.toggle('selected', selected); el.setAttribute('aria-pressed', selected); });
  $('join-row').hidden = mode !== 'join'; $('mode-note').textContent = notes[mode];
  $('hero-mode').textContent = { solo: 'SOLO SESSION', host: 'HOST A SESSION', join: 'JOIN YOUR SQUAD' }[mode];
  renderRules();
  if (latestState) renderAddresses(latestState);
  saveSettings();
}
function renderRules() {
  const showdown = gameMode === 'infinity', thanos = gameMode === 'thanos', local = mode !== 'join';
  document.querySelectorAll('[data-rules]').forEach(el => {
    const selected = el.dataset.rules === 'thanos' ? (thanos || showdown) : gameMode === 'classic';
    el.classList.toggle('selected',selected); el.setAttribute('aria-pressed',selected);
    el.disabled = busy || mode === 'join';
  });
  $('thanos-options').hidden = !(thanos || showdown);
  $('thanos-variant').disabled = busy || !local;
  if (thanos || showdown) $('thanos-variant').value = gameMode;
  document.querySelector('.hero').classList.toggle('showdown',(showdown || thanos) && local);
  document.querySelector('.hero').classList.toggle('thanos',thanos && local);
  const art = document.querySelector('.hero-art'), useThanos = (showdown || thanos) && local;
  const source = useThanos ? 'thanos.png' : 'art/season4-showdown.jpg';
  if (art.getAttribute('src') !== source) art.src = source;
  art.alt = useThanos ? 'Thanos holding the Infinity Gauntlet' : 'Carbide and Omega face off in Fortnite Season 4';
  $('hero-title').innerHTML = thanos && local ? 'WIELD<br>THE POWER.' : useThanos ? 'INFINITY.<br>YOUR WAY.' : 'BRACE<br>FOR IMPACT.';
  $('hero-description').textContent = thanos && local ? 'The whole island. A falling Infinity Gauntlet. Find it. Become Thanos.' : useThanos ? 'One random Thanos. Ten second chances. Drop into a fixed endgame arena.' : 'The original island. The familiar drop. Your next session starts here.';
  $('rules-description').textContent = mode === 'join' ? 'Your host chooses the game mode. Paste their invitation below.' : thanos ? 'Full map · Gauntlet drop · Normal storm · No Showdown respawns. Experimental.' : showdown ? 'Random Thanos · 10 respawns · Retained loot · Fixed arena. Experimental.' : 'Solo practice or a private match with friends.';
  if (showdown && mode !== 'join') $('mode-note').textContent = 'Choose Start server in Reboot. Once everyone has joined the island, click Start Bus. The server chooses Thanos automatically.';
  else if (thanos && local) $('mode-note').textContent = 'Thanos is preselected in Reboot. Click Start server, then Play in Fortnite. Start Bus Countdown when everyone is ready.';
  else $('mode-note').textContent = notes[mode];
  const missingGame = !$('game-path').value.trim();
  $('launch-label').textContent = missingGame ? 'Download Fortnite 4.2' : mode === 'join' ? 'Join friend' : mode === 'host' ? 'Host & play' : 'Launch Fortnite';
  $('launch-hint').textContent = busy ? latestState?.action === 'download' ? 'Keep the launcher open while installing.' : 'Keep the launcher open while playing.' : missingGame ? '8.3 GiB download · 32 GiB free space' : mode === 'join' ? 'Your host must be running first.' : 'Components are prepared automatically.';
}
function selectRules(value) {
  gameMode = value;
  if (value === 'infinity' && mode === 'solo') selectMode('host');
  renderRules();
  saveSettings();
}
function updateFolder() {
  const value = $('game-path').value.trim();
  $('install-title').textContent = value ? 'Fortnite installation selected' : 'Already have Fortnite 4.2?';
  $('install-subtitle').textContent = value || 'Select your existing game folder.';
  $('install-subtitle').title = value;
  $('edit-folder').textContent = value ? 'Change folder ↗' : 'Choose folder ↗';
  renderRules();
  saveSettings();
}
function showError(error) { $('error-banner').textContent = error.message || String(error); $('error-banner').hidden = false; }
async function safely(action) { try { return await action(); } catch (error) { showError(error); } }
function render(state) {
  latestState = state;
  busy = state.busy;
  if(launcherUpdate)renderUpdate(launcherUpdate);
  if (state.installedPath && state.installedPath !== displayedInstall) {
    displayedInstall = state.installedPath; $('game-path').value = state.installedPath; updateFolder();
  }
  renderRules();
  for (const el of document.querySelectorAll('.mode, #game-path, #host-address, #browse, #check, #prepare, #launch, #edit-folder, #auto-sprint')) el.disabled = busy;
  $('download-progress').hidden = state.action !== 'download' || Boolean(state.installedPath);
  const transfer = state.progress;
  const labels = {downloading:'Downloading',retrying:'Connection interrupted — resuming',verifying:'Checking download',inspecting:'Checking archive',extracting:'Unpacking game',checking:'Verifying Fortnite 4.2'};
  if (transfer && transfer.total > 0) {
    const percent = Math.min(100,Math.max(0,transfer.received / transfer.total * 100));
    $('download-bar').value = percent;
    const amount = transfer.stage === 'extracting' ? '' : ` · ${(transfer.received/1024**3).toFixed(2)} / ${(transfer.total/1024**3).toFixed(2)} GiB`;
    $('download-info').textContent = busy ? `${labels[transfer.stage] || 'Installing'} · ${percent.toFixed(1)}%${amount}` : state.message;
  } else {
    $('download-bar').removeAttribute('value');
    $('download-info').textContent = transfer && busy ? labels[transfer.stage] || 'Installing...' : state.message;
  }
  if (state.phase === 'stopping') $('download-info').textContent = state.message;
  $('launch').hidden = busy; $('stop').hidden = !busy; $('stop').disabled = state.phase === 'stopping';
  $('stop').textContent = state.action === 'download' ? 'Cancel installation' : 'Stop session';
  const gameReady = state.events.some(event => event.message?.startsWith('Fortnite ready.'));
  $('top-status').textContent = state.phase === 'error' ? 'NEEDS ATTENTION' : state.phase === 'stopping' ? 'STOPPING' : busy ? gameReady ? 'IN SESSION' : 'GETTING READY' : 'READY';
  document.querySelector('.status-pill').classList.toggle('error', state.phase === 'error');
  document.querySelector('.status-pill').classList.toggle('working', busy && state.phase !== 'error');
  $('status-heading').textContent = state.phase === 'error' ? 'NEEDS ATTENTION' : 'YOUR NEXT STEP';
  const meaningful = state.events.filter(event => !event.message?.startsWith('Keep this window open.')).at(-1)?.message;
  $('status-message').textContent = busy && state.phase !== 'error' && state.phase !== 'stopping' ? meaningful || state.message : state.message;
  document.querySelector('.session-status').classList.toggle('working', busy);
  $('activity-count').textContent = state.events.length;
  if (state.events.length) {
    $('activity-list').replaceChildren(...state.events.map(event => {
      const row = document.createElement('div'); row.className = 'event ' + (event.state || event.type);
      const time = document.createElement('time'); time.textContent = new Date(event.time).toLocaleTimeString('en-GB');
      const icon = document.createElement('span'); icon.className = 'event-icon'; icon.textContent = event.type === 'failure' || event.state === 'error' ? '✕' : event.state === 'ok' ? '✓' : '•';
      const text = document.createElement('span'); text.textContent = event.message; row.append(time, icon, text); return row;
    }));
    $('activity-list').scrollTop = $('activity-list').scrollHeight;
  }
  if (state.phase === 'error') showError(state.message);
  renderAddresses(state);
}
function renderAddresses(state) {
  $('addresses').hidden = mode !== 'host' || !state.busy || !state.addresses.length;
  const signature = JSON.stringify([state.busy, state.phase === 'stopping', state.addresses]);
  if ($('addresses').dataset.signature === signature) return;
  $('addresses').dataset.signature = signature;
  $('addresses').replaceChildren(...state.addresses.map(address => {
    const item = document.createElement('div'); item.className = 'address';
    const details = document.createElement('div');
    const title = document.createElement('strong'); title.textContent = address.name;
    const ip = document.createElement('span'); ip.textContent = address.address;
    const copy = document.createElement('button'); copy.textContent = 'Copy invite'; copy.disabled = !state.busy || state.phase === 'stopping';
    copy.setAttribute('aria-label', `Copy invitation for ${address.name}`);
    copy.onclick = () => safely(async () => { await window.launcher.copyInvite(address.address); copy.textContent = 'Copied ✓'; });
    details.append(title, ip); item.append(details, copy); return item;
  }));
  if (state.addresses.length) { const hint = document.createElement('p'); hint.className = 'address-help'; hint.textContent = 'Choose your shared VPN or LAN. Send the invitation to your friend; they paste it into Join friend.'; $('addresses').append(hint); }
}
async function start(action) {
  $('error-banner').hidden = true;
  if (action === 'launch' && !$('game-path').value.trim()) {
    showPage('play');
    await window.launcher.downloadGame();
    return;
  }
  if (!$('game-path').value.trim()) { showPage('setup'); $('game-path').focus(); throw new Error('Choose your Fortnite folder first.'); }
  if (action === 'launch' && mode === 'join' && !$('host-address').value.trim()) { showPage('play'); $('host-address').focus(); throw new Error('Enter your host’s VPN or LAN IPv4 address.'); }
  await window.launcher.start(action, { mode, gamePath: $('game-path').value, host: $('host-address').value, gameMode, autoSprint:$('auto-sprint').checked });
  if (action === 'launch') showPage('play'); else showPage('activity');
}
document.querySelectorAll('[data-page]').forEach(el => el.addEventListener('click', () => showPage(el.dataset.page)));
document.querySelectorAll('[data-mode]').forEach(el => el.addEventListener('click', () => selectMode(el.dataset.mode)));
document.querySelectorAll('[data-rules]').forEach(el => el.addEventListener('click', () => selectRules(el.dataset.rules === 'thanos' ? $('thanos-variant').value : 'classic')));
document.querySelectorAll('[data-link]').forEach(el => el.addEventListener('click', () => safely(() => window.launcher.link(el.dataset.link))));
const browseFolder = () => safely(async () => { const selected = await window.launcher.browse(); if (selected) { $('game-path').value = selected; updateFolder(); } });
$('edit-folder').onclick = browseFolder;
$('back-play').onclick = () => showPage('play');
$('game-path').oninput = updateFolder;
$('host-address').oninput = saveSettings;
$('auto-sprint').onchange = saveSettings;
$('thanos-variant').onchange = () => selectRules($('thanos-variant').value);
$('browse').onclick = browseFolder;
for (const [button, action] of [['launch','launch'], ['check','check'], ['prepare','prepare']]) $(button).onclick = () => safely(() => start(action));
$('stop').onclick = () => safely(() => window.launcher.stop());
$('open-logs').onclick = () => safely(() => window.launcher.logs());
$('minimize').onclick = () => safely(() => window.launcher.minimize());
$('close').onclick = () => safely(() => window.launcher.close());
window.launcher.subscribe(render);
window.launcher.subscribeUpdate(renderUpdate);
$('open-updates').onclick=()=>{updateDismissed=false;$('launcher-update').hidden=false;$('launcher-update').scrollIntoView({block:'nearest'});};
$('update-later').onclick=()=>{updateDismissed=true;$('launcher-update').hidden=true;};
$('update-check').onclick=()=>{updateDismissed=false;safely(()=>window.launcher.updateCheck());};
$('update-download').onclick=()=>{updateDismissed=false;safely(()=>window.launcher.updateDownload());};
$('update-cancel').onclick=()=>safely(()=>window.launcher.updateCancel());
$('update-install').onclick=()=>safely(()=>window.launcher.updateInstall());
$('update-auto').onchange=()=>safely(()=>window.launcher.updatePreference($('update-auto').checked));
setTimeout(() => { $('startup').hidden = true; }, 1200);
safely(async () => {
  const initial = await window.launcher.initial();
  renderUpdate(initial.update);
  releaseChanges=initial.whatsNew;
  showPage('play');
  $('app-version').textContent = initial.version;
  $('game-path').value = initial.settings.gamePath || '';
  $('host-address').value = initial.settings.host || '';
  $('auto-sprint').checked = initial.settings.autoSprint === true;
  gameMode = ['classic','thanos','infinity'].includes(initial.settings.gameMode) ? initial.settings.gameMode : 'classic';
  selectMode(['solo','host','join'].includes(initial.settings.mode) ? initial.settings.mode : 'solo');
  updateFolder(); render(initial); initialized = true;
  if (releaseChanges?.show) showChanges();
});
