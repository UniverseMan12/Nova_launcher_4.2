import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT } from '../src/config.js';

test('legacy display repair preserves other settings, backs up exact bytes and is idempotent', {skip:process.platform!=='win32'}, () => {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'fortnite-display-test-'));
  try {
    const fixture='[/Script/FortniteGame.FortGameUserSettings]\r\nFullscreenMode=1\r\nResolutionSizeX=1600\r\nResolutionSizeY=900\r\nLastUserConfirmedResolutionSizeX=1600\r\nLastUserConfirmedResolutionSizeY=900\r\nFrameRateLimit=180.000000\r\nPlayerName=KeepMe\r\n\r\n[Other]\r\nResolutionSizeX=42\r\n';
    fs.writeFileSync(path.join(root,'GameUserSettings.ini'),fixture);
    fs.writeFileSync(path.join(root,'windowed.ini'),fixture.replace('FullscreenMode=1','FullscreenMode=2'));
    fs.writeFileSync(path.join(root,'implicit.ini'),fixture.replace('FullscreenMode=1','LastConfirmedFullscreenMode=1'));
    fs.writeFileSync(path.join(root,'unicode.ini'),Buffer.from('\uFEFF'+fixture,'utf16le'));
    fs.writeFileSync(path.join(root,'readonly.ini'),fixture);
    const script=path.join(root,'check.ps1');
    fs.writeFileSync(script,`param([string]$Source,[string]$Root)
$ErrorActionPreference='Stop'
Add-Type -Path $Source
$file=Join-Path $Root 'GameUserSettings.ini'
$backup=[LegacyDisplay]::Repair($file,1920,1080,$true)
if (-not $backup) { throw 'No backup returned' }
if ([LegacyDisplay]::Repair($file,1920,1080,$true)) { throw 'Repeated repair changed the file' }
if ([LegacyDisplay]::Repair((Join-Path $Root 'windowed.ini'),1920,1080,$true)) { throw 'Windowed settings changed' }
$null=[LegacyDisplay]::Repair((Join-Path $Root 'implicit.ini'),1920,1080,$true)
if ([LegacyDisplay]::Repair((Join-Path $Root 'missing.ini'),1920,1080,$true)) { throw 'Missing settings created' }
$rejected=$false
try { [LegacyDisplay]::Repair($file,0,0) } catch { $rejected=$true }
if (-not $rejected) { throw 'Invalid dimensions accepted' }
$null=[LegacyDisplay]::Repair((Join-Path $Root 'unicode.ini'),1920,1080,$true)
$readonly=Join-Path $Root 'readonly.ini'
[IO.File]::SetAttributes($readonly,[IO.FileAttributes]::ReadOnly)
try {
  $rejected=$false
  try { [LegacyDisplay]::Repair($readonly,1920,1080,$true) } catch { $rejected=$true }
  if (-not $rejected) { throw 'Read-only settings replaced' }
} finally { [IO.File]::SetAttributes($readonly,[IO.FileAttributes]::Normal) }
Write-Output $backup
`);
    const output=execFileSync('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',script,'-Source',path.join(ROOT,'src/LegacyDisplay.cs'),'-Root',root],{encoding:'utf8',windowsHide:true,timeout:30000}).trim();
    assert.equal(fs.readFileSync(output,'utf8'),fixture);
    const repaired=fs.readFileSync(path.join(root,'GameUserSettings.ini'),'utf8');
    assert.equal(repaired,fixture.replaceAll('=1600','=1920').replaceAll('=900','=1080'));
    assert.equal(fs.readFileSync(path.join(root,'windowed.ini'),'utf8'),fixture.replace('FullscreenMode=1','FullscreenMode=2'));
    assert.equal(fs.readFileSync(path.join(root,'implicit.ini'),'utf8'),repaired.replace('FullscreenMode=1','LastConfirmedFullscreenMode=1'));
    assert.equal(fs.readFileSync(path.join(root,'readonly.ini'),'utf8'),fixture);
    assert.equal(fs.readFileSync(path.join(root,'unicode.ini'),'utf16le'),'\uFEFF'+repaired);
    assert.equal(fs.existsSync(path.join(root,'missing.ini')),false);
    assert.equal(fs.readdirSync(root).filter(n=>n.startsWith('GameUserSettings.before-launcher-')).length,3);
  } finally { fs.rmSync(root,{recursive:true,force:true}); }
});
