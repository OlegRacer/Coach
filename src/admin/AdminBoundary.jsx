import { Component, Suspense } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n/index.jsx';

// Захист: якщо адмінська сторінка впаде (помилка в коді чи не завантажився шматок коду),
// показуємо повідомлення тут, а решта застосунку (учні) працює як працювала.
class Catcher extends Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(err) {
    console.error('[admin]', err);
  }
  render() {
    if (this.state.failed) return <Fallback />;
    return this.props.children;
  }
}

function Fallback() {
  const { t } = useI18n();
  return (
    <main className="page">
      <p className="err" role="alert">{t('admin.error')}</p>
      <Link to="/" className="btn-ghost" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {t('admin.back')}
      </Link>
    </main>
  );
}

function Loading() {
  const { t } = useI18n();
  return (
    <main className="page">
      <p className="muted">{t('admin.loading')}</p>
    </main>
  );
}

export default function AdminBoundary({ children }) {
  return (
    <Catcher>
      <Suspense fallback={<Loading />}>{children}</Suspense>
    </Catcher>
  );
}
