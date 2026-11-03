import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from '../src/config.js';
// Keep the owner-supplied NOVA DROP emblem unchanged, including its alpha channel.
// electron-builder converts this PNG to the Windows ICO at packaging time.
const source=path.join(ROOT,'desktop','ui','nova-drop.png');
const png=fs.readFileSync(source);
if (!png.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) throw new Error('NOVA DROP icon must be a PNG.');
if (png.readUInt32BE(16) < 256 || png.readUInt32BE(20) < 256) throw new Error('NOVA DROP icon must be at least 256 pixels.');
fs.mkdirSync(path.join(ROOT,'build'),{recursive:true});
fs.copyFileSync(source,path.join(ROOT,'build','icon.png'));
