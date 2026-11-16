import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import uk from '../locales/uk.json';
import en from '../locales/en.json';
import zhTW from '../locales/zh-TW.json';

// Щоб додати нову мову: файл у src/locales/, рядок тут у LANGS і DICTS.
export const LANGS = [
  { code: 'uk', label: 'UA', name: 'Українська', locale: 'uk-UA' },
  { code: 'en', label: 'EN', name: 'English', locale: 'en-GB' },
  { code: 'zh-TW', label: '繁中', name: '繁體中文', locale: 'zh-TW' }
];
const DICTS = { uk, en, 'zh-TW': zhTW };
const STORAGE_KEY = 'lang';

// Мова системи → мова додатка: українська й російська → uk, китайська → zh-TW (традиційна),
// англійська й будь-яка інша, якої немає в списку → en. Ручний вибір у профілі має пріоритет.
function fromSystem() {
  const n = String((navigator.languages && navigator.languages[0]) || navigator.language || '').toLowerCase();
  if (n.startsWith('uk') || n.startsWith('ru')) return 'uk';
  if (n.startsWith('zh')) return 'zh-TW';
  return 'en';
}
const saved = () => {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v && DICTS[v] ? v : null;
  } catch {
    return null; /* localStorage недоступний, не критично */
  }
};
const detect = () => saved() || fromSystem();

const I18nContext = createContext(null);

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(detect);

  // Поки мову не вибрано вручну, додаток іде за мовою системи (і за її зміною)
  useEffect(() => {
    const on = () => {
      if (!saved()) setLangState(fromSystem());
    };
    window.addEventListener('languagechange', on);
    return () => window.removeEventListener('languagechange', on);
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang === 'zh-TW' ? 'zh-Hant-TW' : lang;
  }, [lang]);

  const setLang = useCallback((code) => {
    setLangState(code);
    try {
      localStorage.setItem(STORAGE_KEY, code);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo(() => {
    const dict = DICTS[lang] || uk;
    const locale = (LANGS.find((l) => l.code === lang) || LANGS[0]).locale;

    // t(ключ, {змінні}, запасний текст)
    // Порядок: поточна мова → українська → запасний текст → сам ключ.
    // Порожній переклад "" вважається відсутнім, тож недописане в en/zh-TW
    // автоматично показується українською.
    const t = (key, vars, fallback) => {
      let s = dict[key] || uk[key] || fallback || key;
      if (vars) s = s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ''));
      return s;
    };
    // Текст вправи: ex.<id>.<поле>, а якщо його нема, поле з exercises.json.
    const tEx = (ex, field) => t(`ex.${ex.id}.${field}`, null, ex[field] ?? '');
    return { lang, setLang, locale, t, tEx };
  }, [lang, setLang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}
