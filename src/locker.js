import fs from 'node:fs';
import path from 'node:path';
import locker from '../scripts/backend-extensions/launcher-locker.cjs';

// One-time migration from the most recently used older bundled workspace. New
// payloads still supply their own item catalog; only locker choices are retained.
export function prepareLocker(directory, {workspaces, current, backend} = {}) {
  const target = path.join(directory, 'locker.json');
  if (fs.existsSync(target)) return;
  const candidates = [];
  if (workspaces && fs.existsSync(workspaces)) {
    for (const entry of fs.readdirSync(workspaces, {withFileTypes:true})) {
      if (!entry.isDirectory() || !/^[a-f0-9]{16}$/.test(entry.name)) continue;
      const root = path.join(workspaces, entry.name);
      if (path.resolve(root) === path.resolve(current)) continue;
      const complete = path.join(root, '.complete'), profile = path.join(root, 'vendor/LawinServer/profiles/athena.json');
      // A prepared-but-never-played payload contains freshly copied defaults.
      // Only a profile written after preparation is evidence of a used locker.
      if (fs.existsSync(complete) && fs.existsSync(profile) && fs.statSync(profile).mtimeMs > fs.statSync(complete).mtimeMs) candidates.push(profile);
    }
  }
  if (backend) candidates.push(path.join(backend, 'profiles/athena.json'));
  const existing = candidates.filter(file => fs.existsSync(file));
  existing.sort((a,b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  // Bundled defaults were just copied, so prefer an older workspace over the
  // current backend even if its default file now has the newest timestamp.
  const previous = existing.filter(file => !backend || !file.startsWith(path.resolve(backend) + path.sep));
  for (const file of previous.length ? previous : existing) {
    try { locker.save(target, JSON.parse(fs.readFileSync(file, 'utf8'))); return; }
    catch (error) { if (error.code && error.code !== 'ENOENT') throw error; }
  }
}
