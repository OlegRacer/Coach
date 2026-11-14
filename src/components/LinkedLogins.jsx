import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../auth/index.jsx';
import { useI18n } from '../i18n/index.jsx';

// «Способи входу»: Google і LINE в одному акаунті. Кнопка «Привʼязати» додає другий спосіб до поточного акаунта.
export default function LinkedLogins() {
  const { t } = useI18n();
  const { user, linkGoogle, signInLine, linkMsg } = useAuth();
  const [google, setGoogle] = useState(null);
  const [line, setLine] = useState(null);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const { data } = await supabase.auth.getUserIdentities();
      setGoogle(((data && data.identities) || []).some((i) => i.provider === 'google'));
    } catch {
      setGoogle(null);
    }
    const r = await supabase.from('line_links').select('line_sub').eq('user_id', user.id).limit(1);
    // Акаунт, створений через LINE ще до привʼязок, має службову пошту line_…@line.local
    setLine(r.error ? null : (r.data || []).length > 0 || /@line\.local$/.test(user.email || ''));
  }, [user]);

  useEffect(() => {
    load();
    window.addEventListener('logins-changed', load);
    return () => window.removeEventListener('logins-changed', load);
  }, [load]);

  if (!user || (google === null && line === null)) return null;
  const row = (name, on, action) => (
    <div className="set-row">
      <span className="set-label">{name}</span>
      {on ? (
        <span className="muted small">{t('logins.linked')}</span>
      ) : (
        <button type="button" className="btn-ghost" style={{ width: 'auto', padding: '0 16px' }} onClick={action}>
          {t('logins.link')}
        </button>
      )}
    </div>
  );
  return (
    <div className="stack">
      <span className="muted small">{t('logins.title')}</span>
      {google !== null && row('Google', google, linkGoogle)}
      {line !== null && row('LINE', line, () => signInLine('link'))}
      {linkMsg === 'line' && line && <p className="small" role="status">{t('logins.lineDone')}</p>}
      <p className="muted small">{t('logins.hint')}</p>
    </div>
  );
}
