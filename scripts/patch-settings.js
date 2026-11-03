import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export function patchSettings(directory) {
  for (const file of ['launcher-input.cjs','launcher-locker.cjs']) fs.copyFileSync(
    fileURLToPath(new URL(`./backend-extensions/${file}`, import.meta.url)), path.join(directory, 'structure', file));
  const cloud = path.join(directory, 'structure/cloudstorage.js');
  let source = fs.readFileSync(cloud, 'utf8');
  if (!source.includes('// Launcher settings v1')) {
    source = '// Launcher settings v1\nconst launcherInput = require("./launcher-input.cjs");\nconst launcherSprint = process.env.LAUNCHER_AUTO_SPRINT === "1";\n' + source;
    source = source.replace("const ParsedFile = fs.readFileSync(file, 'latin1');", 'const ParsedFile = launcherInput.read(file, launcherSprint);');
    source = source.replace('const ParsedFile = fs.readFileSync(file);', 'const ParsedFile = launcherInput.read(file, launcherSprint);');
    // Both listing and download must expose the same transformed bytes, including
    // first launch when there is not yet a saved settings archive on disk.
    const userStart = source.indexOf('express.get("/fortnite/api/cloudstorage/user/');
    const before = source.slice(0, userStart);
    let users = source.slice(userStart).replaceAll('if (fs.existsSync(file)) {', 'if (fs.existsSync(file) || launcherSprint) {')
      .replace('const ParsedStats = fs.statSync(file);', 'const ParsedStats = fs.existsSync(file) ? fs.statSync(file) : {mtime: new Date(0)};')
      .replace("fs.writeFileSync(file, req.rawBody, 'latin1');", "launcherInput.write(file, Buffer.from(req.rawBody, 'latin1'), launcherSprint);");
    source = before + users;
    fs.writeFileSync(cloud, source);
  }
  const mcp = path.join(directory, 'structure/mcp.js');
  source = fs.readFileSync(mcp, 'utf8');
  if (!source.includes('// Launcher persistent locker')) {
    source = source.replace('const catalog = functions.getItemShop();', 'const catalog = functions.getItemShop();\n// Launcher persistent locker\nrequire("./launcher-locker.cjs").attach(express, require("../profiles/athena.json"));');
    fs.writeFileSync(mcp, source);
  }
}
