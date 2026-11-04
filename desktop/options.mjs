// Bump when the experimental behavior or its known risks materially change.
export const AUTO_SPRINT_BETA_ACKNOWLEDGEMENT = 1;

export function validateOptions(value) {
  if (!value || typeof value !== 'object' || !['solo', 'host', 'join'].includes(value.mode)) throw new Error('Choose Solo, Host or Join.');
  if (typeof value.gamePath !== 'string' || !value.gamePath.trim() || value.gamePath.length > 2048) throw new Error('Choose the folder containing FortniteGame and Engine.');
  const host = String(value.host ?? '').trim();
  if (host.length > 64) throw new Error('The host address is too long.');
  const gameMode = value.gameMode ?? 'classic';
  if (!['classic', 'thanos', 'infinity'].includes(gameMode)) throw new Error('Choose Classic, Thanos or Infinity Showdown.');
  if (value.autoSprint !== undefined && typeof value.autoSprint !== 'boolean') throw new Error('Invalid Auto-Sprint setting.');
  if (value.autoSprint === true && value.autoSprintBetaAcknowledged !== AUTO_SPRINT_BETA_ACKNOWLEDGEMENT) throw new Error('Auto-Sprint is an experimental beta. Enable it in Settings after reading the warning.');
  return { autoSprint: value.autoSprint === true, ...(value.autoSprint === true ? {autoSprintBetaAcknowledged:AUTO_SPRINT_BETA_ACKNOWLEDGEMENT} : {}), mode: value.mode, gamePath: value.gamePath.trim(), host, gameMode };
}

export function normalizeSettings(value) {
  const saved = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const autoSprint = saved.autoSprint === true && saved.autoSprintBetaAcknowledged === AUTO_SPRINT_BETA_ACKNOWLEDGEMENT;
  return {
    autoSprint,
    ...(autoSprint ? {autoSprintBetaAcknowledged:AUTO_SPRINT_BETA_ACKNOWLEDGEMENT} : {}),
    mode: ['solo','host','join'].includes(saved.mode) ? saved.mode : 'solo',
    gameMode: ['classic','thanos','infinity'].includes(saved.gameMode) ? saved.gameMode : 'classic',
    gamePath: typeof saved.gamePath === 'string' && saved.gamePath.length <= 2048 ? saved.gamePath : '',
    host: typeof saved.host === 'string' && saved.host.length <= 64 ? saved.host : '',
    ...(typeof saved.multiplayerName === 'string' && /^Player_[a-f0-9]{12}$/.test(saved.multiplayerName) ? {multiplayerName:saved.multiplayerName} : {})
  };
}

export const links = Object.freeze({
  github: 'https://github.com/UniverseMan12/Nova_launcher_4.2',
  releases: 'https://github.com/UniverseMan12/Nova_launcher_4.2/releases',
  hamachi: 'https://vpn.net/',
  runtime: 'https://aka.ms/vc14/vc_redist.x64.exe',
  game: 'https://drive.google.com/file/d/1m8VEUcKnxA0UYHt5-txPbRhfbn0OVhEm/view?usp=sharing'
});
