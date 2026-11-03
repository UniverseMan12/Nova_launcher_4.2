import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

test('Auto-Sprint compiles and balances held, manual and focus transitions', {skip:process.platform!=='win32'}, () => {
  const output=execFileSync('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',fileURLToPath(new URL('./auto-sprint.ps1',import.meta.url)),'-Source',fileURLToPath(new URL('../src/AutoSprint.cs',import.meta.url))],{windowsHide:true,encoding:'utf8',timeout:30000});
  assert.match(output,/transition checks passed/);
});
