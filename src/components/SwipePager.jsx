import { useEffect, useLayoutEffect, useRef, useState } from 'react';

// Горизонтальний «пейджер»: панелі йдуть слідом за пальцем, а після відпускання докочуються на місце.
// Вертикальна прокрутка сторінки не зачіпається. onEdge(±1) викликається, коли свайпнули за край списку.
export default function SwipePager({ index, count, onIndex, onEdge, renderPanel }) {
  const box = useRef(null);
  const panels = useRef([]);
  const st = useRef(null);
  const [dx, setDx] = useState(0);
  const [drag, setDrag] = useState(false);
  const [h, setH] = useState(null);

  // висота = висота активної панелі (панелі можуть бути різної висоти)
  useLayoutEffect(() => {
    const el = panels.current[index];
    if (!el) return undefined;
    const measure = () => setH(el.offsetHeight);
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [index, count]);

  useEffect(() => {
    const el = box.current;
    if (!el) return undefined;
    const start = (e) => {
      const p = e.touches[0];
      st.current = { x: p.clientX, y: p.clientY, t: Date.now(), lock: null };
    };
    const move = (e) => {
      const s = st.current;
      if (!s) return;
      const p = e.touches[0];
      const mx = p.clientX - s.x;
      const my = p.clientY - s.y;
      if (!s.lock) {
        // горизонтальний жест не віддаємо зовнішній прокрутці віджета (інакше стрибає на «Мій розклад»)
        if (Math.abs(mx) > Math.abs(my) && e.cancelable) e.preventDefault();
        if (Math.abs(mx) < 8 && Math.abs(my) < 8) return;
        s.lock = Math.abs(mx) > Math.abs(my) * 1.3 ? 'x' : 'y';
        if (s.lock === 'x') setDrag(true);
      }
      if (s.lock !== 'x') return;
      if (e.cancelable) e.preventDefault();
      const atEdge = (index === 0 && mx > 0) || (index === count - 1 && mx < 0);
      // біля краю з onEdge панель не тягнемо (без гумки і ривка) — просто перехід на сусідню плитку
      setDx(atEdge ? (onEdge ? 0 : mx * 0.25) : mx);
    };
    const end = (e) => {
      const s = st.current;
      st.current = null;
      if (!s || s.lock !== 'x') {
        setDrag(false);
        return;
      }
      const mx = e.changedTouches[0].clientX - s.x;
      const w = el.clientWidth || 1;
      const fast = Math.abs(mx) / Math.max(1, Date.now() - s.t) > 0.45 && Math.abs(mx) > 30;
      const far = Math.abs(mx) > w * 0.22;
      setDrag(false);
      setDx(0);
      if (!(far || fast)) return;
      const step = mx < 0 ? 1 : -1;
      const n = index + step;
      if (n < 0 || n >= count) onEdge && onEdge(step);
      else onIndex(n);
    };
    el.addEventListener('touchstart', start, { passive: true });
    el.addEventListener('touchmove', move, { passive: false });
    el.addEventListener('touchend', end, { passive: true });
    el.addEventListener('touchcancel', end, { passive: true });
    return () => {
      el.removeEventListener('touchstart', start);
      el.removeEventListener('touchmove', move);
      el.removeEventListener('touchend', end);
      el.removeEventListener('touchcancel', end);
    };
  }, [index, count, onIndex, onEdge]);

  return (
    <div ref={box} className="swp" style={h != null ? { height: h } : undefined}>
      <div className={'swp-track' + (drag ? ' drag' : '')} style={{ transform: `translateX(calc(${-index * 100}% + ${dx}px))` }}>
        {Array.from({ length: count }, (_, i) => (
          <div key={i} ref={(el) => { panels.current[i] = el; }} className="swp-panel" aria-hidden={i !== index} inert={i !== index ? '' : undefined}>
            {renderPanel(i)}
          </div>
        ))}
      </div>
    </div>
  );
}
