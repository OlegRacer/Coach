// "4 підходи • 10 повторень". Повтори можуть бути текстом («45 с») — тоді показуємо як є.
function plural(n, lang, one, few, many) {
  if (lang !== 'uk') return many;
  const a = n % 10, b = n % 100;
  if (a === 1 && b !== 11) return one;
  if (a >= 2 && a <= 4 && (b < 12 || b > 14)) return few;
  return many;
}
export function setsText(x, lang) {
  if (!x) return '';
  const out = [];
  const s = String(x.s || '').trim();
  const r = String(x.r || '').trim();
  const W = {
    uk: { s: ['підхід', 'підходи', 'підходів'], r: ['повторення', 'повторення', 'повторень'] },
    en: { s: ['sets', 'sets', 'sets'], r: ['reps', 'reps', 'reps'] },
    'zh-TW': { s: ['組', '組', '組'], r: ['次', '次', '次'] }
  }[lang] || null;
  const w = W || { s: ['sets', 'sets', 'sets'], r: ['reps', 'reps', 'reps'] };
  if (s) out.push(lang === 'zh-TW' ? `${s} ${w.s[0]}` : `${s} ${plural(Number(s), lang, ...w.s)}`);
  if (r) out.push(/^\d+$/.test(r) ? (lang === 'zh-TW' ? `${r} ${w.r[0]}` : `${r} ${plural(Number(r), lang, ...w.r)}`) : r);
  return out.join(' • ');
}
