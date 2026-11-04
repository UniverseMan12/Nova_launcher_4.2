import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

test('4.2 migrates only compatible display values and isolates host, client and modern settings', {skip:process.platform!=='win32'}, t=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'nova-game-data-'));
  t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
  const original='[/Script/FortniteGame.FortGameUserSettings]\r\nDLSSQuality=2\r\nFortVersion=999\r\nLastConfirmedFullscreenMode=1\r\nResolutionSizeX=1600\r\nResolutionSizeY=900\r\nFrameRateLimit=180.000000\r\nbUseVSync=False\r\n[ScalabilityGroups]\r\nsg.ResolutionQuality=100.000000\r\nsg.TextureQuality=2\r\nsg.GlobalIlluminationQuality=1\r\n[Other]\r\nFullscreenMode=0\r\n';
  const legacy=path.join(directory,'modern.ini');fs.writeFileSync(legacy,Buffer.from('\ufeff'+original,'utf16le'));
  const before=fs.readFileSync(legacy);
  const script=path.join(directory,'verify.ps1');
  fs.writeFileSync(script,`param([string]$Source,[string]$Root,[string]$Legacy)
$ErrorActionPreference='Stop'
Add-Type -Path $Source
$client=[LegacyGameData]::Prepare($Root,'client',$Legacy)
$server=[LegacyGameData]::Prepare($Root,'server',$Legacy)
if($client -eq $server){throw 'Shared role directory'}
$clientFile=Join-Path $client 'Saved/Config/WindowsClient/GameUserSettings.ini'
$saved=[IO.File]::ReadAllText($clientFile)
if($saved -notmatch 'FullscreenMode=1' -or $saved -notmatch 'FortVersion=2' -or $saved -notmatch 'FrameRateLimit=180.000000'){throw 'Lost compatible preferences'}
if($saved -match 'DLSS|GlobalIllumination|FortVersion=999|\\[Other\\]'){throw 'Migrated unsupported settings'}
if([IO.File]::ReadAllText((Join-Path $server 'Saved/Config/WindowsClient/GameUserSettings.ini')) -match '1600|FrameRateLimit=180'){throw 'Host copied client preferences'}
[IO.File]::WriteAllText($clientFile,'Player changed settings')
$null=[LegacyGameData]::Prepare($Root,'client',$Legacy)
if([IO.File]::ReadAllText($clientFile) -ne 'Player changed settings'){throw 'Overwrote existing settings'}
foreach($role in @('..','unknown')) { $rejected=$false;try{[LegacyGameData]::Prepare($Root,$role,$Legacy)}catch{$rejected=$true};if(-not $rejected){throw 'Invalid role accepted'} }
$rejected=$false;try{[LegacyGameData]::Prepare('relative','client',$Legacy)}catch{$rejected=$true};if(-not $rejected){throw 'Relative root accepted'}
$invalid=@'
[/Script/FortniteGame.FortGameUserSettings]
FullscreenMode=8
ResolutionSizeX=1e3
ResolutionSizeY=-1
FrameRateLimit=NaN
[ScalabilityGroups]
sg.ResolutionQuality=Infinity
sg.ShadowQuality=4
'@
$clean=[LegacyGameData]::InitialSettings($invalid,$true)
if($clean -match 'NaN|Infinity|1e3|ShadowQuality=4|FullscreenMode=8|ResolutionSizeY=-1'){throw 'Invalid numbers migrated'}
if($clean -notmatch 'ResolutionSizeX=1280' -or $clean -notmatch 'ResolutionSizeY=720' -or $clean -notmatch 'FullscreenMode=2'){throw 'Missing safe first-launch defaults'}
'Isolated settings verified'
`);
  const output=execFileSync('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',script,'-Source',fileURLToPath(new URL('../src/LegacyGameData.cs',import.meta.url)),'-Root',directory,'-Legacy',legacy],{encoding:'utf8',windowsHide:true,timeout:30000});
  assert.match(output,/Isolated settings verified/);assert.deepEqual(fs.readFileSync(legacy),before,'Modern Fortnite settings remain byte-exact');
});
