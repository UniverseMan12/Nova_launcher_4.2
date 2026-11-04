import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { patchAbilityActivationInstall, patchAbilityActivationDiagnostics } from '../scripts/patch-gameplay.js';

const fixture = name => fs.readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8').replaceAll('\r\n', '\n');
const install = fixture('ability-install-upstream.cpp');
const activation = fixture('ability-activation-upstream.cpp');
const oldGuard = `    // 4.2 has the native activation implementation. Keep its prediction/input
    // cache cleanup and press/release lifecycle, which the replacement omits.
    if (Addresses::InternalTryActivateAbility && Fortnite_Version != 4.2)
`;
const disabled = install.replace('    if (Addresses::InternalTryActivateAbility)\n', oldGuard);
const marker = '// Launcher ability activation v1';

function assertOriginalLinesRetained(original, patched) {
  // Logging may add lines, but it must not replace the existing activation,
  // prediction-key dispatch, input-bit updates, rejection, or cleanup code.
  const lines = patched.split('\n');
  let cursor = 0;
  for (const line of original.split('\n').filter(line => line.trim())) {
    const next = lines.indexOf(line, cursor);
    assert.ok(next >= cursor, `Original activation line was removed or reordered: ${line}`);
    cursor = next + 1;
  }
}

test('ability registration includes 4.2 and preserves pinned index discovery', () => {
  const patched = patchAbilityActivationInstall(install);
  assert.match(patched, /^    if \(Addresses::InternalTryActivateAbility\)$/m);
  assert.doesNotMatch(patched, /InternalTryActivateAbility\s*&&/);
  assertOriginalLinesRetained(install, patched);
  const swap = patched.indexOf('        VirtualSwap(');
  const report = patched.indexOf('Reboot server ability activation hook configured');
  assert.ok(swap >= 0 && report > swap, 'Configuration is reported only after installing the hook');
  assert.equal(patchAbilityActivationInstall(patched), patched);
});

test('previously disabled 4.2 registration migrates to the same hook as upstream', () => {
  assert.equal(patchAbilityActivationInstall(disabled), patchAbilityActivationInstall(install));
  assert.equal(patchAbilityActivationInstall(disabled.replaceAll('\n', '\r\n')), patchAbilityActivationInstall(install));
});

test('registration fails closed on duplicate, incomplete, or unfamiliar source', () => {
  const patched = patchAbilityActivationInstall(install);
  const cases = [
    install + install,
    install + disabled,
    install.replace('Addresses::InternalTryActivateAbility)', 'Addresses::InternalTryActivateAbility && Fortnite_Version != 5.0)'),
    install.replace('        VirtualSwap(', '        UnknownSwap('),
    install.replace('#include <Windows.h>', ''),
    marker + '\n' + install,
    patched.replace('Addresses::InternalTryActivateAbility)', 'Addresses::InternalTryActivateAbility && Fortnite_Version != 4.2)'),
    patched + '\n' + marker,
  ];
  for (const source of cases) assert.throws(() => patchAbilityActivationInstall(source), /Ability activation patch mismatch/);
});

test('activation diagnostics preserve native dispatch and failure handling without duplicates', () => {
  const patched = patchAbilityActivationDiagnostics(activation);
  assertOriginalLinesRetained(activation, patched);
  const received = patched.indexOf('LauncherAbilityTrace activationTrace(');
  const dispatch = patched.indexOf('if (PredictionKeySize == 0x10)');
  const result = patched.indexOf('activationTrace.Result(res);');
  const rejection = patched.indexOf('\tif (!res)');
  assert.ok(received >= 0 && received < dispatch && result > dispatch && result < rejection,
    'Receive/result tracing brackets the original native activation call');
  assert.ok(patched.indexOf('LauncherAbilityInvalid(') < patched.indexOf('AbilitySystemComponent->ClientActivateAbilityFailed('));
  assert.equal(patchAbilityActivationDiagnostics(patched), patched);
  assert.equal(patchAbilityActivationDiagnostics(activation.replaceAll('\n', '\r\n')), patched);
});

test('diagnostics reject unexpected or partially patched activation code', () => {
  const patched = patchAbilityActivationDiagnostics(activation);
  const cases = [
    activation + activation,
    activation.replace('\tif (!res)\n', '\tif (!res && changedBehavior)\n'),
    activation.replace('AbilityToActivate = Spec->GetAbility()', 'AbilityToActivate = GetOtherAbility()'),
    activation.replace('#include "AbilitySystemComponent.h"', ''),
    marker + '\n' + activation,
    patched.replace('\tactivationTrace.Result(res);', ''),
    patched + '\n' + marker,
  ];
  for (const source of cases) assert.throws(() => patchAbilityActivationDiagnostics(source), /Ability activation patch mismatch/);
});
