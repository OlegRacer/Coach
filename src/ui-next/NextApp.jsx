import { useUi } from '../lib/ui.jsx';
import { useI18n } from '../i18n/index.jsx';

// Новий інтерфейс. Тут будуть нові екрани й навігація.
// Усі дані та логіка спільні зі старим інтерфейсом: useAuth, useContent, useSchedule, useStudioData,
// useEquipment тощо, тому достатньо написати лише нові компоненти вигляду.
// Старі сторінки лишаються в src/pages, їх можна використовувати повторно.
export default function NextApp() {
  const { t } = useI18n();
  const { setUi } = useUi();
  return (
    <main className="page">
      <h1 className="title">{t('ui.next.title')}</h1>
      <p className="muted">{t('ui.next.soon')}</p>
      <button type="button" className="btn-primary" onClick={() => setUi('classic')}>
        {t('ui.backToClassic')}
      </button>
    </main>
  );
}
