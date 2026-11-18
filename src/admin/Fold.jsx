import { useState } from 'react';
import Icon from '../components/Icon.jsx';

// Блок форми, який можна згорнути: заголовок із стрілкою, усередині поля.
export default function Fold({ title, summary, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className={'fold card' + (open ? ' open' : '')}>
      <button type="button" className="fold-head" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="fold-title">{title}</span>
        {!open && summary ? <span className="muted small fold-sum">{summary}</span> : null}
        <span className="fold-chev" aria-hidden="true"><Icon name="chevron" size={20} /></span>
      </button>
      {open && <div className="fold-body stack">{children}</div>}
    </section>
  );
}
