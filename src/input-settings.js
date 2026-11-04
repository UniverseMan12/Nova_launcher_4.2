const start = '; NOVA DROP Auto-Sprint begin', end = '; NOVA DROP Auto-Sprint end';
export function inputHotfix(text, enabled) {
  const clean = text.replace(/; NOVA DROP Auto-Sprint begin[\s\S]*?; NOVA DROP Auto-Sprint end\r?\n?/g, '').trimEnd() + '\n';
  if (!enabled) return clean;
  return clean + `${start}\n[ConfigKBM FortPlayerInputSettings]\n+ActionMappings=(ActionName="Sprint",Key=F12)\n[ConfigKBMResetToDefault FortPlayerInputSettings]\n+ActionMappings=(ActionName="Sprint",Key=F12)\n${end}\n`;
}
