import { useCallback, useEffect, useRef, useState } from 'react';

// Перетягування рядків списку вгору/вниз. Дотик: потримати ~0.25 с і тягнути; мишка: просто тягнути.
// ids — поточний порядок; onCommit(newIds) викликається після відпускання.
const HOLD = 250;
const SLOP = 8;

export default function useSortable(ids, onCommit, enabled = true, onDrop = null) {
  const key = ids.join('|');
  const [local, setLocal] = useState(null);
  const [drag, setDrag] = useState(null); // { id, dy, to }
  const els = useRef({});
  const st = useRef(null);
  const commit = useRef(onCommit);
  commit.current = onCommit;
  const dropRef = useRef(onDrop);
  dropRef.current = onDrop;
  const idsRef = useRef(ids);
  idsRef.current = local || ids;

  useEffect(() => setLocal(null), [key]);
  const order = local || ids;

  const finish = useCallback((apply) => {
    const s = st.current;
    if (!s) return;
    clearTimeout(s.timer);
    document.removeEventListener('pointermove', s.move);
    document.removeEventListener('pointerup', s.up);
    document.removeEventListener('pointercancel', s.cancel);
    document.removeEventListener('touchmove', s.touchmove);
    st.current = null;
    if (s.active) {
      s.suppress.current = true;
      setTimeout(() => { s.suppress.current = false; }, 350);
      const to = s.to;
      if (apply && s.target && dropRef.current) {
        dropRef.current(s.id, s.target);
      } else if (apply && to !== s.from) {
        const next = [...s.order];
        const [m] = next.splice(s.from, 1);
        next.splice(to, 0, m);
        setLocal(next);
        commit.current(next);
      }
    }
    setDrag(null);
  }, []);

  useEffect(() => () => finish(false), [finish]);

  const suppress = useRef(false);

  const down = (id) => (e) => {
    if (!enabled || (e.button && e.button > 0) || st.current) return;
    if (e.target.closest && e.target.closest('input, textarea, select, [data-nodrag]')) return;
    const order0 = [...idsRef.current];
    const s = {
      id, order: order0, from: order0.indexOf(id), to: order0.indexOf(id), x: e.clientX, y: e.clientY, active: false,
      isTouch: e.pointerType !== 'mouse', suppress, rects: null
    };
    const activate = () => {
      s.rects = s.order.map((i) => (els.current[i] ? els.current[i].getBoundingClientRect() : null));
      if (s.rects.some((r) => !r)) return finish(false);
      s.active = true;
      if (navigator.vibrate) navigator.vibrate(8);
      setDrag({ id, dy: 0, to: s.from });
    };
    s.move = (ev) => {
      if (!s.active) {
        const d = Math.hypot(ev.clientX - s.x, ev.clientY - s.y);
        if (s.isTouch) { if (d > SLOP) finish(false); } else if (d > 4) activate();
        return;
      }
      const dy = ev.clientY - s.y;
      const r = s.rects[s.from];
      const c = r.top + r.height / 2 + dy;
      let to = s.from, best = Infinity;
      s.rects.forEach((q, i) => {
        const dist = Math.abs(q.top + q.height / 2 - c);
        if (dist < best) { best = dist; to = i; }
      });
      // чи палець/курсор над плиткою-призначенням (data-drop): тоді це переміщення, а не пересортування
      let target = null;
      if (dropRef.current) {
        const hit = document.elementsFromPoint(ev.clientX, ev.clientY).find((n) => n.dataset && n.dataset.drop);
        if (hit) target = hit.dataset.drop;
      }
      s.target = target;
      s.to = target ? s.from : to;
      setDrag({ id, dy, to: s.to, target });
    };
    s.up = () => finish(true);
    s.cancel = () => finish(false);
    s.touchmove = (ev) => { if (s.active && ev.cancelable) ev.preventDefault(); };
    document.addEventListener('pointermove', s.move);
    document.addEventListener('pointerup', s.up);
    document.addEventListener('pointercancel', s.cancel);
    document.addEventListener('touchmove', s.touchmove, { passive: false });
    st.current = s;
    if (s.isTouch) s.timer = setTimeout(activate, HOLD);
  };

  const rowProps = (id) => {
    const base = {
      ref: (el) => { if (el) els.current[id] = el; else delete els.current[id]; },
      onPointerDown: down(id),
      onClickCapture: (e) => { if (suppress.current) { e.preventDefault(); e.stopPropagation(); } },
      onContextMenu: (e) => { if (st.current && st.current.active) e.preventDefault(); },
      draggable: false
    };
    if (!enabled) return { ref: base.ref };
    let cls = 'sortable';
    let style;
    if (drag) {
      const s = st.current;
      const from = s ? s.from : order.indexOf(drag.id);
      const idx = order.indexOf(id);
      if (id === drag.id) {
        cls += ' dragging';
        style = { transform: `translateY(${drag.dy}px) scale(1.02)` };
      } else if (s && s.rects) {
        const h = s.rects[from].height + (s.rects[1] ? Math.abs(s.rects[1].top - s.rects[0].bottom) : 10);
        if (from < drag.to && idx > from && idx <= drag.to) style = { transform: `translateY(${-h}px)` };
        else if (from > drag.to && idx < from && idx >= drag.to) style = { transform: `translateY(${h}px)` };
      }
    }
    return { ...base, className: cls, style };
  };

  return { order, rowProps, dragging: !!drag, hot: drag ? drag.target || null : null };
}
