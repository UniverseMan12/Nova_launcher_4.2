import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { ROOT } from '../src/config.js';
import { setup, lock, verifyDll } from './setup.js';
import { patchBackend } from './patch-backend.js';
import './create-icon.mjs';
import { installBackendManifest } from './backend-dependencies.js';
import { prepareExtractor } from './prepare-extractor.mjs';

if (process.platform !== 'win32') throw new Error('Build the Windows release on Windows.');
await setup();
const extractor = await prepareExtractor();
const build = path.join(ROOT, 'build'), destination = path.join(build, 'payload');
fs.mkdirSync(build, { recursive: true });
// Only remove this build's generated payload; never resolve a user-supplied path.
if (path.resolve(destination) !== path.resolve(ROOT, 'build', 'payload')) throw new Error('Invalid staging directory.');
fs.rmSync(destination, { recursive: true, force: true });
fs.mkdirSync(destination);
for (const name of ['src', 'scripts']) fs.mkdirSync(path.join(destination, name));
for (const name of fs.readdirSync(path.join(ROOT, 'src'))) fs.copyFileSync(path.join(ROOT, 'src', name), path.join(destination, 'src', name));
for (const name of ['setup.js', 'download.js', 'patch-backend.js', 'patch-settings.js', 'backend-dependencies.js', 'launch-game.ps1', 'extract-server.ps1']) fs.copyFileSync(path.join(ROOT, 'scripts', name), path.join(destination, 'scripts', name));
fs.cpSync(path.join(ROOT, 'scripts', 'backend-dependencies'), path.join(destination, 'scripts', 'backend-dependencies'), { recursive: true, filter: source => path.basename(source) !== 'node_modules' });
fs.cpSync(path.join(ROOT, 'scripts', 'backend-extensions'), path.join(destination, 'scripts', 'backend-extensions'), {recursive:true});
for (const name of ['dependencies.lock.json', 'game-download.json', 'THIRD_PARTY.md', 'README.md']) fs.copyFileSync(path.join(ROOT, name), path.join(destination, name));
fs.writeFileSync(path.join(destination, 'package.json'), JSON.stringify({ name: 'fortnite-launcher-runtime', private: true, type: 'module' }));
const backend = path.join(destination, 'vendor', 'LawinServer');
fs.mkdirSync(path.dirname(backend), { recursive: true });
const archive = path.join(build, 'backend-source.zip');
execFileSync('git', ['-C', path.join(ROOT, 'vendor', 'LawinServer'), 'archive', '--format=zip', '--output', archive, lock.backend.commit]);
const extract = path.join(build, 'extract-backend.ps1');
fs.writeFileSync(extract, "param([string]$Archive,[string]$Destination)\n$ErrorActionPreference='Stop'\nExpand-Archive -LiteralPath $Archive -DestinationPath $Destination\n");
execFileSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', extract, '-Archive', archive, '-Destination', backend], { stdio: 'inherit', windowsHide: true });
installBackendManifest(backend);
execFileSync('cmd.exe', ['/d', '/c', 'npm.cmd ci --ignore-scripts --no-audit --no-fund'], { cwd: backend, stdio: 'inherit', windowsHide: true });
patchBackend(backend);
fs.writeFileSync(path.join(backend, 'launcher-bundle.json'), JSON.stringify({ commit: lock.backend.commit }));
fs.mkdirSync(path.join(destination, 'runtime'));
fs.mkdirSync(path.join(destination,'runtime','7zip'));
for (const name of ['7zr.exe','7zip-source.tar.xz','NOTICE.txt']) fs.copyFileSync(path.join(extractor,name),path.join(destination,'runtime','7zip',name));
fs.copyFileSync(verifyDll('reboot.dll'), path.join(destination, 'runtime', 'reboot.dll'));
fs.copyFileSync(path.join(ROOT, 'runtime', 'REBOOT-LICENSE.txt'), path.join(destination, 'runtime', 'REBOOT-LICENSE.txt'));
// Other upstream DLLs are fetched directly from their pinned sources on first use.
// No personal settings, logs, profiles from this machine or game files are staged.
const files = {};
function walk(directory) {
  for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, item.name);
    if (item.isSymbolicLink()) throw new Error('Unexpected symlink in release payload.');
    if (item.isDirectory()) walk(file);
    else files[path.relative(destination, file).split(path.sep).join('/')] = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  }
}
walk(destination);
fs.writeFileSync(path.join(destination, 'payload.json'), JSON.stringify({ version: '0.2.0', files }, null, 2));
console.log(`Staged ${Object.keys(files).length} verified files for release.`);
