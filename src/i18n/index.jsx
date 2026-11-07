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

function detect() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && DICTS[saved]) return saved;
  } catch {
    /* localStorage недоступний, не критично */
  }
  const n = (navigator.language || '').toLowerCase();
  if (n.startsWith('zh')) return 'zh-TW';
  if (n.startsWith('en')) return 'en';
  return 'uk';
}

const I18nContext = createContext(null);

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(detect);

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
