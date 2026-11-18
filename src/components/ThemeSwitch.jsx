import { useI18n } from '../i18n/index.jsx';
import { useUi } from '../lib/ui.jsx';

// Тема: авто / світла / темна. Підпис зліва показує поточний режим, справа — перемикач із трьома положеннями.
const MODES = ['auto', 'light', 'dark'];
const ICONS = {
  auto: <path d="M12 3a9 9 0 1 0 0 18V3Z M12 3a9 9 0 0 1 0 18" />,
  light: <g><circle cx="12" cy="12" r="4" /><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" /></g>,
  dark: <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5Z" />
};

export default function ThemeSwitch() {
  const { t } = useI18n();
  const { theme, setTheme } = useUi();
  const i = MODES.indexOf(theme);
  return (
    <div className="set-row theme-row">
      <span className="set-label">
        {t('theme.title')}: {t(`theme.${theme}`)}
      </span>
      <div className="theme-switch" role="radiogroup" aria-label={t('theme.title')} style={{ '--i': i }}>
        <span className="theme-knob" aria-hidden="true" />
        {MODES.map((m) => (
          <button key={m} type="button" role="radio" aria-checked={theme === m} aria-label={t(`theme.${m}`)} className={'theme-opt' + (theme === m ? ' on' : '')} onClick={() => setTheme(m)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {ICONS[m]}
            </svg>
          </button>
        ))}
      </div>
    </div>
  );
}
