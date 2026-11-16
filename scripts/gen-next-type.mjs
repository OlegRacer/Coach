// Генерує src/ui-next/next-type.css зі src/styles.css: розміри шрифтів у rem (Dynamic Type iOS) і м'якші ваги.
// Запуск після змін styles.css: node scripts/gen-next-type.mjs
import fs from 'node:fs';
import postcss from 'postcss';

const BASE = 17; // iOS body за замовчуванням
// px зі старого інтерфейсу → розмір за типографікою iOS
const MAP = { 32: 28, 28: 28, 26: 24, 24: 22, 22: 20, 21: 20, 20: 17, 19: 17, 18: 17 };
const W = { 800: 700, 900: 700, 700: 600 };
const css = fs.readFileSync('src/styles.css', 'utf8');
const root = postcss.parse(css);
const out = [];
root.walkRules((rule) => {
  if (rule.parent && rule.parent.type === 'atrule' && /keyframes/.test(rule.parent.name)) return;
  const decls = [];
  rule.walkDecls((d) => {
    if (d.prop === 'font-size') {
      const m = /^([\d.]+)px$/.exec(d.value.trim());
      if (m) decls.push(`font-size: ${Number(((MAP[Number(m[1])] || Number(m[1])) / BASE).toFixed(4))}rem`);
    } else if (d.prop === 'font-weight' && W[d.value.trim()]) {
      decls.push(`font-weight: ${W[d.value.trim()]}`);
    }
  });
  if (!decls.length) return;
  const sel = rule.selectors.map((s) => `html[data-ui="next"] ${s}`).join(', ');
  const wrap = rule.parent && rule.parent.type === 'atrule' ? rule.parent : null;
  const text = `${sel} { ${decls.join('; ')}; }`;
  out.push(wrap ? `@${wrap.name} ${wrap.params} { ${text} }` : text);
});
fs.writeFileSync('src/ui-next/next-type.css', `/* Створено scripts/gen-next-type.mjs, не редагувати вручну */\n${out.join('\n')}\n`);
console.log('rules:', out.length);
