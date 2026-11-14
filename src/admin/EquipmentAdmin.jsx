import { useState } from 'react';
import TopBar from '../components/TopBar.jsx';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../auth/index.jsx';
import { useI18n } from '../i18n/index.jsx';
import { useL } from '../lib/content.jsx';
import { useEquipment } from '../lib/equipment.jsx';
import { ConfirmButton, LangField, newId } from './ContentCommon.jsx';

// Довідник інвентарю: тренер додає, перейменовує (3 мови), міняє значок-емодзі й порядок, видаляє.
export default function EquipmentAdmin() {
  const { t } = useI18n();
  const L = useL();
  const { isAdmin } = useAuth();
  const { list, reloadList } = useEquipment();
  const [open, setOpen] = useState('');
  const [f, setF] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  if (!isAdmin) return <main className="page"><TopBar title={t('equip.admin')} to="/" /><p className="muted">{t('students.noAccess')}</p></main>;

  const fail = (e) => setErr(e ? `${e.code || ''} ${e.message || ''}`.trim() : '');
  const edit = (e) => {
    setOpen(e.id);
    setF({ name: e.name || {}, icon: e.icon || '' });
    setErr('');
  };
  const add = async () => {
    setBusy(true);
    const id = newId('eq');
    const { error } = await supabase.from('equipment').insert({ id, name: {}, icon: '🏷️', position: (list[list.length - 1]?.position || 0) + 1 });
    setBusy(false);
    fail(error);
    if (!error) {
      await reloadList();
      setOpen(id);
      setF({ name: {}, icon: '🏷️' });
    }
  };
  const save = async () => {
    setBusy(true);
    const { error } = await supabase.from('equipment').update({ name: f.name, icon: f.icon.trim() }).eq('id', open);
    setBusy(false);
    fail(error);
    if (!error) {
      await reloadList();
      setOpen('');
    }
  };
  const del = async (id) => {
    setBusy(true);
    const { error } = await supabase.from('equipment').delete().eq('id', id);
    setBusy(false);
    fail(error);
    if (!error) {
      setOpen('');
      reloadList();
    }
  };
  const move = async (i, d) => {
    const j = i + d;
    if (j < 0 || j >= list.length) return;
    const ids = list.map((e) => e.id);
    [ids[i], ids[j]] = [ids[j], ids[i]];
    setBusy(true);
    const res = await Promise.all(ids.map((id, p) => supabase.from('equipment').update({ position: p + 1 }).eq('id', id)));
    setBusy(false);
    fail(res.find((r) => r.error)?.error);
    reloadList();
  };

  return (
    <main className="page">
      <TopBar title={t('equip.admin')} to="/" />
      <p className="muted small">{t('equip.adminHint')}</p>
      {err && <p className="small err" role="alert">{err}</p>}
      <div className="list">
        {list.map((e, i) => (
          <div key={e.id} className="card stack">
            <div className="row between">
              <b>{e.icon} {L(e.name) || e.id}</b>
              <span className="row">
                <button type="button" className="icon-btn" disabled={busy || i === 0} onClick={() => move(i, -1)} aria-label="↑">↑</button>
                <button type="button" className="icon-btn" disabled={busy || i === list.length - 1} onClick={() => move(i, 1)} aria-label="↓">↓</button>
                <button type="button" className="link-btn" onClick={() => (open === e.id ? setOpen('') : edit(e))}>{open === e.id ? t('common.back') : t('equip.edit')}</button>
              </span>
            </div>
            {open === e.id && f && (
              <>
                <label className="stack">
                  <span className="muted small">{t('equip.icon')}</span>
                  <input className="field" maxLength={8} value={f.icon} onChange={(ev) => setF({ ...f, icon: ev.target.value })} />
                </label>
                <LangField label={t('equip.name')} value={f.name} onChange={(name) => setF({ ...f, name })} maxLength={40} />
                <button type="button" className="btn-primary" disabled={busy} onClick={save}>{t('content.save')}</button>
                <ConfirmButton label={t('equip.delete')} confirmLabel={t('content.sure')} onConfirm={() => del(e.id)} />
              </>
            )}
          </div>
        ))}
      </div>
      <button type="button" className="btn-ghost" disabled={busy} onClick={add}>{t('equip.add')}</button>
    </main>
  );
}
