const fs = require('node:fs');
const path = require('node:path');
const slots = ['character','backpack','pickaxe','glider','skydivecontrail','musicpack','loadingscreen','dance','itemwraps'];
function extract(profile) {
  const attributes = profile?.stats?.attributes || {}, selected = {};
  for (const name of slots) {
    const value = attributes['favorite_' + name];
    if (typeof value === 'string' && value.length < 256) selected['favorite_' + name] = value;
    if (Array.isArray(value) && value.length <= 7 && value.every(x => typeof x === 'string' && x.length < 256)) selected['favorite_' + name] = value;
  }
  for (const key of ['banner_icon','banner_color']) if (typeof attributes[key] === 'string' && attributes[key].length < 256) selected[key] = attributes[key];
  const variants = {};
  for (const id of Object.values(selected).flat()) {
    const value = profile?.items?.[id]?.attributes?.variants;
    if (Array.isArray(value) && JSON.stringify(value).length < 16384) variants[id] = value;
  }
  return {version: 1, selected, variants};
}
function restore(profile, saved) {
  if (saved?.version !== 1 || !saved.selected || typeof saved.selected !== 'object') throw Error('Invalid saved locker.');
  profile.stats ||= {}; profile.stats.attributes ||= {};
  const clean = extract({stats:{attributes:saved.selected}}).selected;
  for (const [key, value] of Object.entries(clean)) {
    const valid = id => id === '' || Object.hasOwn(profile.items || {}, id);
    if (key.startsWith('banner_') || (Array.isArray(value) ? value.every(valid) : valid(value))) profile.stats.attributes[key] = value;
  }
  for (const [id, variants] of Object.entries(saved.variants || {})) {
    if (Object.hasOwn(profile.items || {}, id) && Array.isArray(variants) && JSON.stringify(variants).length < 16384) {
      profile.items[id].attributes ||= {}; profile.items[id].attributes.variants = variants;
    }
  }
}
function save(file, profile) {
  fs.mkdirSync(path.dirname(file), {recursive:true});
  fs.writeFileSync(file + '.tmp', JSON.stringify(extract(profile)));
  fs.renameSync(file + '.tmp', file);
}
function attach(router, profile) {
  const directory = process.env.LAUNCHER_PROFILE_DIR;
  if (!directory) return;
  const file = path.join(directory, 'locker.json');
  if (fs.existsSync(file)) restore(profile, JSON.parse(fs.readFileSync(file, 'utf8')));
  router.use((req, res, next) => {
    // Save only a successful locker mutation, not unrelated profile queries.
    if (/\/(EquipBattleRoyaleCustomization|SetCosmeticLockerSlot|SetCosmeticLockerBanner|SetBattleRoyaleBanner)$/.test(req.path)) {
      const json = res.json;
      res.json = function(body) {
        if (res.statusCode < 400) save(file, profile);
        return json.call(this, body);
      };
    }
    next();
  });
}
module.exports = {extract, restore, save, attach};
