import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import TopBar from '../components/TopBar.jsx';
import Icon from '../components/Icon.jsx';
import EditFab from '../components/EditFab.jsx';
import Locked from '../components/Locked.jsx';
import { useAuth } from '../auth/index.jsx';
import { useI18n } from '../i18n/index.jsx';
import { setsText } from '../lib/setsText.js';
import { cropStyle, startOf } from '../lib/crop.js';
import { useContent, useL, mediaUrl } from '../lib/content.jsx';
import { useEquipment } from '../lib/equipment.jsx';
import SectionTile from '../components/SectionIcon.jsx';
import useSortable from '../lib/useSortable.js';
import useAddContent from '../admin/useAddContent.js';
import { supabase } from '../lib/supabase.js';

// Розділ містить підрозділи і/або вправи (на будь-яку глибину). Закрите учень бачить із замком,
// а відкрите окремо (пакет, «безкоштовно») лишається доступним.
// Мініатюра-превʼю вправи: квадрат із центру відео (або картинки).
// Відео стоїть на першому кадрі; тап по квадрату запускає його (не відкриваючи вправу), одночасно грає лише одне.
let playing = null;
function Thumb({ src, crop }) {
  const ref = useRef(null);
  const [on, setOn] = useState(false);
  const t0 = startOf(crop);
  const isVideo = /\.(mp4|webm|mov)(\?.*)?$/i.test(src);
  useEffect(() => () => { if (playing === ref.current) playing = null; }, []);
  if (!isVideo) return <img src={src} alt="" loading="lazy" style={cropStyle(crop)} />;
  const toggle = (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    const v = ref.current;
    if (!v) return;
    if (!v.paused) { v.pause(); return; }
    if (playing && playing !== v) playing.pause();
    playing = v;
    const p = v.play();
    if (p && p.catch) p.catch(() => {});
  };
  return (
    <span className="thumb-play" onClick={toggle}>
      <video ref={ref} src={src + '#t=' + (t0 || 0.001)} muted playsInline preload="metadata" aria-hidden="true" style={cropStyle(crop)}
        onPlay={() => setOn(true)} onPause={() => setOn(false)}
        onEnded={(e) => { const v = e.currentTarget; v.currentTime = t0 || 0; const p = v.play(); if (p && p.catch) p.catch(() => {}); }} />
      {!on && <span className="thumb-btn"><Icon name="play" size={18} /></span>}
    </span>
  );
}

export default function Section() {
  const { category } = useParams();
  const { t, lang } = useI18n();
  const { ready, isAdmin } = useAuth();
  const { section, exercisesOf, childrenOf, chainOf, sectionOpen, exerciseOpen, openCount, isFreeSection, programExercisesOf } = useContent();
  const L = useL();
  const { byId, needed, missing, only, setOnly } = useEquipment();
  const sec = section(category);
  const progText = (id) => setsText(sec && sec.program_sets && sec.program_sets[id], lang);
  const full = sectionOpen(category);
  const subs = childrenOf(category);
  const all = [...exercisesOf(category), ...programExercisesOf(category)]; // закриті (locked) показуємо із замком
  const hasEquip = !isAdmin && all.some((e) => needed(e).length > 0);
  const itemsRaw = hasEquip && only ? all.filter((e) => missing(e).length === 0) : all;
  const total = openCount(category);
  const { reload } = useContent();
  const add = useAddContent(category);
  const [menu, setMenu] = useState(false);
  const [sortErr, setSortErr] = useState('');
  const persist = (table) => async (ids) => {
    const res = await Promise.all(ids.map((id, p) => supabase.from(table).update({ position: p }).eq('id', id)));
    const bad = res.find((r) => r.error);
    setSortErr(bad ? `${bad.error.code || ''} ${bad.error.message}` : '');
    reload();
  };
  const sortSubs = useSortable(subs.map((x) => x.id), persist('content_sections'), isAdmin);
  const own = exercisesOf(category);
  const sortEx = useSortable(own.map((x) => x.id), persist('content_exercises'), isAdmin);

  const ownById = Object.fromEntries(own.map((x) => [x.id, x]));
  const items = isAdmin ? [...sortEx.order.map((id) => ownById[id]).filter(Boolean), ...programExercisesOf(category)] : itemsRaw;
  const subsById = Object.fromEntries(subs.map((x) => [x.id, x]));
  const subsOrdered = isAdmin ? sortSubs.order.map((id) => subsById[id]).filter(Boolean) : subs;
  const title = sec ? L(sec.title) : t('section.exercises');
  if (!ready) return <main className="page" />;
  if (!sec) return (
    <main className="page wide">
      <TopBar title={title} />
      <p className="muted">{t('section.empty')}</p>
    </main>
  );
  if (!full && !total) return <Locked section={category} title={title} />;
  const parent = chainOf(category).slice(-2, -1)[0];
  return (
    <main className="page wide">
      <TopBar title={title} to={parent ? `/section/${parent.id}` : '/'} action={isAdmin ? (
        <div className="add-menu-wrap">
          <button type="button" className="edit-inline" aria-label={t('content.add')} aria-expanded={menu} onClick={() => setMenu(!menu)}>
            <Icon name="plus" size={22} />
          </button>
          {menu && (
            <div className="add-menu" role="menu" onClick={() => setMenu(false)}>
              <button type="button" role="menuitem" disabled={add.busy} onClick={add.addEx}>{t('content.addExercise')}</button>
              <button type="button" role="menuitem" disabled={add.busy} onClick={add.addSub}>{t('content.addSubsectionShort')}</button>
            </div>
          )}
        </div>
      ) : null} />
      {!full && (
        <div className="card partial-note">
          <span className="muted small">{t('access.partialNote', { n: total })}</span>
          <Link to="/plans" className="link-btn">{t('pay.howToOpen')}</Link>
        </div>
      )}
      {hasEquip && (
        <label className="access-row field-toggle equip-filter">
          <input type="checkbox" checked={only} onChange={(e) => setOnly(e.target.checked)} />
          <span>{t('equip.only')}</span>
        </label>
      )}
      {(add.err || sortErr) && <p className="err" role="alert">{add.err || sortErr}</p>}
      <div className="list">
        {subsOrdered.map((s) => {
          const open = sectionOpen(s.id);
          const n = open ? 0 : openCount(s.id);
          const locked = !open && !n;
          return (
            <div key={s.id} {...(sortSubs.rowProps(s.id))} className={'edit-wrap ' + (sortSubs.rowProps(s.id).className || '')}>
            <Link to={`/section/${s.id}`} draggable={false} onClick={(e) => { if (s.draft && !isAdmin) e.preventDefault(); }} className={'list-item' + (locked ? ' locked-tile' : '')}>
              <SectionTile section={s} size={22} className="small-icon" />
              <span className="list-main">
                <span className="list-title">
                  {L(s.title)}
                  {!s.published && isAdmin && <span className="badge-draft">{t('content.draft')}</span>}
                  {isFreeSection(s.id) && !isAdmin && <span className="badge-free">{t('content.free')}</span>}
                </span>
                <span className={'muted small' + (s.draft ? ' draft' : '')}>{s.draft ? t('content.draft') : n > 0 ? t('access.partial', { n }) : L(s.hint)}</span>
              </span>
              <span className="muted">
                <Icon name={locked ? 'lock' : 'chevron'} size={20} />
              </span>
            </Link>
            <EditFab to={`/admin/content/${s.id}`} />
            </div>
          );
        })}
        {items.map((e) => (
          <div key={e.id} {...(ownById[e.id] ? sortEx.rowProps(e.id) : {})} className={'edit-wrap ' + (ownById[e.id] ? sortEx.rowProps(e.id).className || '' : '')}>
          <Link to={`/exercise/${e.id}`} draggable={false} onClick={(ev) => { if (e.draft && !isAdmin) ev.preventDefault(); }} className={'list-item' + (exerciseOpen(e) ? '' : ' locked-tile')}>
            <span className="ex-thumb">
              {e.preview && <Thumb src={mediaUrl(e.preview)} crop={e.preview_crop} />}
            </span>
            <span className="list-main">
              <span className="list-title">
                {L(e.title)}
                {!e.published && isAdmin && <span className="badge-draft">{t('content.draft')}</span>}
                {e.free && !isAdmin && <span className="badge-free">{t('content.free')}</span>}
              </span>
              <span className={'muted small' + (e.draft ? ' draft' : '')}>{e.draft ? t('content.draft') : exerciseOpen(e) ? progText(e.id) : t('access.closed')}</span>
              {!isAdmin && exerciseOpen(e) && missing(e).length > 0 && (
                <span className="small equip-warn">{t('equip.missing', { list: missing(e).map((id) => L(byId[id].name)).join(', ') })}</span>
              )}
            </span>
            <span className="muted">
              <Icon name={exerciseOpen(e) ? 'chevron' : 'lock'} size={20} />
            </span>
          </Link>
          <EditFab to={`/admin/content/${e.section_id}/${e.id}`} />
          </div>
        ))}
      </div>
      {!items.length && !subs.length && <p className="muted">{only && all.length ? t('equip.noneAvail') : t('section.empty')}</p>}
    </main>
  );
}
