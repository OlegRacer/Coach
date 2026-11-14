import TopBar from '../components/TopBar.jsx';
import { useI18n } from '../i18n/index.jsx';
import { useL } from '../lib/content.jsx';
import { useEquipment } from '../lib/equipment.jsx';

// Мій інвентар: учень відмічає, що в нього є. Вправи з іншим інвентарем отримують позначку «Немає…».
export default function Equipment() {
  const { t } = useI18n();
  const L = useL();
  const { list, mine, setMine } = useEquipment();
  const toggle = (id) => setMine(mine.has(id) ? [...mine].filter((x) => x !== id) : [...mine, id]);
  return (
    <main className="page">
      <TopBar title={t('equip.mine')} to="/" />
      <p className="muted small">{t('equip.hint')}</p>
      {!list.length && <p className="muted">{t('equip.empty')}</p>}
      <div className="chips equip-grid">
        {list.map((e) => (
          <button type="button" key={e.id} className={'chip equip-chip' + (mine.has(e.id) ? ' active' : '')} aria-pressed={mine.has(e.id)} onClick={() => toggle(e.id)}>
            <span aria-hidden="true">{e.icon}</span> {L(e.name)}
          </button>
        ))}
      </div>
      {list.length > 0 && (
        <div className="row between equip-actions">
          <span className="muted small">{t('equip.count', { n: [...mine].filter((id) => list.some((e) => e.id === id)).length, total: list.length })}</span>
          <button type="button" className="link-btn" onClick={() => setMine(mine.size === list.length ? [] : list.map((e) => e.id))}>
            {mine.size >= list.length ? t('equip.clear') : t('equip.all')}
          </button>
        </div>
      )}
    </main>
  );
}
