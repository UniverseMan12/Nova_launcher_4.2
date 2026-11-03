// Fortnite 4.2's tagged FortClientSettingsRecord archive. Edit only Sprint's
// secondary binding and toggle; unknown versions fail closed without a write.
const fs = require('node:fs');
const MAGIC = 0xf057217e;
const MAX = 1024 * 1024;
function int(n) { const b = Buffer.alloc(4); b.writeUInt32LE(n); return b; }
function str(s) { return Buffer.concat([int(Buffer.byteLength(s) + 1), Buffer.from(s + '\0')]); }
const none = () => str('None');
function tag(name, type, data, extra = Buffer.alloc(0)) {
  return Buffer.concat([str(name), str(type), int(data.length), int(0), extra, Buffer.from([0]), data]);
}
function boolTag(value) { return tag('bToggleSprint', 'BoolProperty', Buffer.alloc(0), Buffer.from([value ? 1 : 0])); }
function keyTag(name, value) {
  return tag(name, 'StructProperty', Buffer.concat([tag('KeyName', 'NameProperty', str(value)), none()]), Buffer.concat([str('Key'), Buffer.alloc(16)]));
}
function seed() {
  const binding = Buffer.concat([
    tag('ActionName', 'NameProperty', str('Sprint')),
    tag('ActionGroup', 'EnumProperty', str('EFortInputActionGroup::Combat'), str('EFortInputActionGroup')),
    tag('SubGameUsedIn', 'EnumProperty', str('ESubGame::Invalid'), str('ESubGame')),
    keyTag('KeyBind1', 'LeftShift'), keyTag('KeyBind2', 'None'),
    tag('InputScale', 'FloatProperty', Buffer.from([0, 0, 128, 63])), none()
  ]);
  const array = tag('UserActionBindings', 'ArrayProperty', Buffer.concat([int(1),
    tag('UserActionBindings', 'StructProperty', binding, Buffer.concat([str('FortActionKeyMapping'), Buffer.alloc(16)]))]), str('StructProperty'));
  const engineVersion = Buffer.alloc(10); engineVersion.writeUInt16LE(4); engineVersion.writeUInt16LE(20, 2); engineVersion.writeUInt32LE(4072250, 6);
  return Buffer.concat([int(MAGIC), int(516), engineVersion, str('++Fortnite+Release-4.2'), int(15), array, boolTag(true), none(), int(0)]);
}
function parse(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length > MAX || buffer.length < 55 || buffer.readUInt32LE(0) !== MAGIC || buffer.readUInt32LE(4) !== 516 || buffer.readUInt32LE(14) !== 4072250) throw Error('Unsupported Fortnite settings archive.');
  const bounds = (p, n, end = buffer.length) => { if (!Number.isSafeInteger(n) || n < 0 || p < 0 || p + n > end) throw Error('Truncated settings archive.'); };
  function string(p, limit = buffer.length) {
    bounds(p, 4, limit); const n = buffer.readInt32LE(p); p += 4;
    if (n <= 0 || n > 4096) throw Error('Unsupported settings name.');
    bounds(p, n, limit); if (buffer[p + n - 1] !== 0) throw Error('Invalid settings string.');
    return {value: buffer.toString('utf8', p, p + n - 1), end: p + n};
  }
  function property(start, limit) {
    let p = start; const name = string(p, limit); p = name.end;
    if (name.value === 'None') return {name: 'None', start, end: p};
    const type = string(p, limit); p = type.end; bounds(p, 8, limit);
    const sizeOffset = p, size = buffer.readUInt32LE(p); p += 8;
    let boolOffset, inner, struct;
    if (type.value === 'StructProperty') { const s = string(p, limit); struct = s.value; p = s.end; bounds(p, 16, limit); p += 16; }
    else if (['ArrayProperty', 'EnumProperty', 'ByteProperty', 'SetProperty'].includes(type.value)) { const s = string(p, limit); inner = s.value; p = s.end; }
    else if (type.value === 'MapProperty') { p = string(p, limit).end; p = string(p, limit).end; }
    else if (type.value === 'BoolProperty') { bounds(p, 1, limit); boolOffset = p++; }
    bounds(p, 1, limit); const guid = buffer[p++]; if (guid > 1) throw Error('Invalid property GUID flag.');
    if (guid) { bounds(p, 16, limit); p += 16; }
    bounds(p, size, limit);
    return {name: name.value, type: type.value, start, sizeOffset, body: p, end: p + size, boolOffset, inner, struct};
  }
  function list(start, limit) {
    const items = []; let p = start;
    for (let i = 0; i < 2048; i++) { const prop = property(p, limit); items.push(prop); p = prop.end; if (prop.name === 'None') return {items, end: p}; }
    throw Error('Too many settings properties.');
  }
  const branch = string(18);
  if (branch.value !== '++Fortnite+Release-4.2') throw Error('Unsupported settings branch.');
  const top = list(branch.end + 4, buffer.length);
  if (top.end !== buffer.length && !(top.end + 4 === buffer.length && buffer.readUInt32LE(top.end) === 0)) throw Error("Unexpected settings archive trailer.");
  const array = top.items.find(x => x.name === 'UserActionBindings');
  const sprint = [];
  let elements;
  if (array) {
    if (array.type !== 'ArrayProperty' || array.inner !== 'StructProperty') throw Error('Unsupported input bindings.');
    bounds(array.body, 4, array.end); const count = buffer.readUInt32LE(array.body);
    if (count > 512) throw Error('Too many input bindings.');
    if (count) {
      elements = property(array.body + 4, array.end);
      if (elements.struct !== 'FortActionKeyMapping' || elements.end !== array.end) throw Error('Unsupported binding structure.');
      let p = elements.body;
      for (let i = 0; i < count; i++) {
        const row = list(p, elements.end); p = row.end;
        const action = row.items.find(x => x.name === 'ActionName');
        if (action?.type !== 'NameProperty') throw Error('Missing input action.');
        if (string(action.body, action.end).value === 'Sprint') {
          const key = row.items.find(x => x.name === 'KeyBind2');
          if (!key || key.struct !== 'Key') throw Error('Missing secondary sprint key.');
          const keyName = list(key.body, key.end).items.find(x => x.name === 'KeyName');
          if (keyName?.type !== 'NameProperty') throw Error('Missing sprint key name.');
          sprint.push({key, keyName, value: string(keyName.body, keyName.end).value});
        }
      }
      if (p !== elements.end) throw Error('Unexpected binding data.');
    }
  }
  const toggle = top.items.find(x => x.name === 'bToggleSprint');
  if (toggle && (toggle.type !== 'BoolProperty' || buffer[toggle.boolOffset] > 1)) throw Error('Invalid sprint toggle.');
  return {array, elements, sprint, toggle, end: top.items.at(-1).start};
}
function rewrite(buffer, {key, toggle}) {
  const parsed = parse(buffer), changes = [], sizes = new Map();
  const adjust = (prop, delta) => sizes.set(prop.sizeOffset, (sizes.get(prop.sizeOffset) || 0) + delta);
  if (key !== undefined) {
    for (const row of parsed.sprint) {
      const data = str(key), delta = data.length - (row.keyName.end - row.keyName.body);
      changes.push({start: row.keyName.body, end: row.keyName.end, data});
      for (const parent of [row.keyName, row.key, parsed.elements, parsed.array]) adjust(parent, delta);
    }
  }
  if (toggle !== undefined) {
    if (parsed.toggle) changes.push({start: parsed.toggle.boolOffset, end: parsed.toggle.boolOffset + 1, data: Buffer.from([toggle ? 1 : 0])});
    else changes.push({start: parsed.end, end: parsed.end, data: boolTag(toggle)});
  }
  for (const [offset, delta] of sizes) changes.push({start: offset, end: offset + 4, data: int(buffer.readUInt32LE(offset) + delta)});
  changes.sort((a,b) => a.start - b.start);
  let p = 0; const chunks = [];
  for (const change of changes) { if (change.start < p) throw Error('Overlapping settings edits.'); chunks.push(buffer.subarray(p, change.start), change.data); p = change.end; }
  chunks.push(buffer.subarray(p)); const result = Buffer.concat(chunks); parse(result); return result;
}
function autoSprint(buffer) {
  const value = buffer?.length ? buffer : seed();
  const data = parse(value);
  // The native preset supplies Sprint+W when no user override exists.
  return rewrite(value, {key: data.sprint.length ? 'W' : undefined, toggle: false});
}
function restorePreferences(incoming, original) {
  const before = parse(original?.length ? original : seed());
  const after = parse(incoming);
  if (before.sprint.length > 1 || after.sprint.length > 1) throw Error('Ambiguous sprint bindings.');
  const key = after.sprint[0]?.value === 'W' ? (before.sprint[0]?.value ?? 'None') : undefined;
  return rewrite(incoming, {key, toggle: before.toggle ? !!(original?.length ? original : seed())[before.toggle.boolOffset] : true});
}
function read(file, enabled) {
  const original = fs.existsSync(file) ? fs.readFileSync(file) : null;
  return enabled ? autoSprint(original) : original;
}
function write(file, incoming, enabled) {
  const original = fs.existsSync(file) ? fs.readFileSync(file) : null;
  const data = enabled ? restorePreferences(incoming, original) : incoming;
  // Preserve the last good file if decoding or writing fails.
  fs.mkdirSync(require('node:path').dirname(file), {recursive: true});
  fs.writeFileSync(file + '.tmp', data); fs.renameSync(file + '.tmp', file);
}
module.exports = {seed, parse, rewrite, autoSprint, restorePreferences, read, write};
