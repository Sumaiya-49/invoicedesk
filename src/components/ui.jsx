import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { STATUS } from '../lib/derive.js';
import { fdateTime } from '../lib/format.js';

export const cx = (...c) => c.filter(Boolean).join(' ');

// ------------------------------------------------------------------ icons (stroke, 24px grid)
const PATHS = {
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  invoice: 'M6 3h9l4 4v14H6zM14 3v5h5M9 12h7M9 16h5',
  quote: 'M5 4h14v16H5zM9 9h6M9 13h6M9 17h3',
  credit: 'M4 6h16v12H4zM4 10h16M8 15h4',
  users: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21c.7-4 3.6-6 7-6s6.3 2 7 6M16 3.5a4 4 0 0 1 0 7.5M18 14.5c2 .8 3.4 3 4 6',
  box: 'M12 3l8 4.5v9L12 21l-8-4.5v-9zM4 7.5l8 4.5 8-4.5M12 12v9',
  wallet: 'M3 7a2 2 0 0 1 2-2h13v4M3 7v11a2 2 0 0 0 2 2h15V9H5a2 2 0 0 1-2-2zM16 14h.01',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  palette: 'M12 3a9 9 0 1 0 0 18c1.1 0 1.5-.8 1.5-1.5 0-1.2-1-1.5-1-2.5s.9-1.5 2-1.5H17a4 4 0 0 0 4-4c0-4.7-4-8.5-9-8.5zM7.5 11h.01M10 7h.01M15 7h.01',
  plus: 'M12 5v14M5 12h14',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4',
  sparkle: 'M12 3l2 5.5L19.5 10.5 14 12.5 12 18l-2-5.5L4.5 10.5 10 8.5zM19 3v4M17 5h4',
  close: 'M6 6l12 12M18 6 6 18',
  menu: 'M4 7h16M4 12h16M4 17h16',
  eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
  bell: 'M6 9a6 6 0 1 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9zM10 20a2 2 0 0 0 4 0',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  edit: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4',
  download: 'M12 4v11M7 10l5 5 5-5M4 20h16',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  arrowRight: 'M5 12h14M13 6l6 6-6 6',
  arrowLeft: 'M19 12H5M11 6l-6 6 6 6',
  send: 'M4 12 20 4l-6 16-2.5-6.5z',
  rupee: 'M7 5h10M7 9h10M13 5c2.5 0 4 1.7 4 4s-1.5 4-4 4H8l7 7',
  db: 'M12 8c4.4 0 8-1.3 8-3s-3.6-3-8-3-8 1.3-8 3 3.6 3 8 3zM4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3',
  upload: 'M12 16V5M7 10l5-5 5 5M4 20h16',
  logout: 'M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10',
  convert: 'M4 7h12l-3-3M20 17H8l3 3',
  alert: 'M12 3 2 20h20zM12 10v4M12 17h.01',
  lock: 'M6 11h12v9H6zM8 11V8a4 4 0 0 1 8 0v3',
};

export function Icon({ name, size = 18, className = '', stroke = 2 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={cx('shrink-0', className)}>
      {PATHS[name].split('M').filter(Boolean).map((seg, i) => <path key={i} d={'M' + seg} />)}
    </svg>
  );
}

// ------------------------------------------------------------------ buttons
const BTN = {
  primary: 'fx-btn-primary font-bold',
  secondary: 'fx-btn-secondary bg-surface/60 text-ink border-[1.5px] border-white/15',
  ghost: 'text-ink hover:bg-white/5 hover:text-accent',
  danger: 'fx-btn-danger bg-transparent text-danger border-[1.5px] border-danger/40',
  soft: 'fx-btn-soft bg-accent-soft text-accent border border-accent/30',
  confirm: 'fx-btn-soft bg-[#3DFF6E] text-[#06210F] font-bold shadow-[0_0_14px_rgba(61,255,110,.5)]',
};
// Icons that spin a little on hover
const SPIN = new Set(['plus', 'sparkle', 'convert']);
export function Button({ variant = 'secondary', size = 'md', icon, children, className = '', ...rest }) {
  return (
    <button type="button" {...rest}
      className={cx('fx-btn inline-flex items-center justify-center gap-2 rounded-full font-semibold whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer',
        size === 'sm' ? 'h-9 px-3.5 text-[13px]' : 'h-10 px-[18px] text-sm', BTN[variant], className)}>
      {icon && <Icon name={icon} size={size === 'sm' ? 15 : 17} className={SPIN.has(icon) ? 'fx-spin' : ''} />}
      {children}
    </button>
  );
}
export function IconButton({ icon, label, onClick, tone = 'default', className = '' }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label}
      className={cx('fx-icon-btn inline-flex h-8 w-8 items-center justify-center rounded-xl border border-transparent transition-all cursor-pointer',
        tone === 'danger' ? 'text-muted hover:border-danger/50 hover:bg-danger-soft hover:text-danger' : 'text-muted hover:border-accent/50 hover:bg-accent-soft hover:text-accent', className)}>
      <Icon name={icon} size={17} />
    </button>
  );
}

// ------------------------------------------------------------------ badges
export function StatusPill({ status }) {
  const [label, cls] = STATUS[status] || STATUS.draft;
  return <span className={cx('fx-pill inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap', status === 'overdue' && 'fx-pill-blink', cls)}>
    <span className="fx-pill-dot h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />{label}
  </span>;
}
export function TypeBadge({ type, long = false }) {
  const intra = type === 'INTRA';
  return (
    <span className={cx('inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold whitespace-nowrap', intra ? 'border-accent/25 bg-accent-soft text-accent' : 'border-info/25 bg-info-soft text-info')}>
      {intra ? (long ? 'Intra-state · CGST + SGST' : 'CGST + SGST') : (long ? 'Inter-state · IGST' : 'IGST')}
    </span>
  );
}

// ------------------------------------------------------------------ layout bits
export function Card({ className = '', children, ...rest }) {
  return <section {...rest} className={cx('fx-card rounded-[20px] border border-line bg-surface/90', className)}>{children}</section>;
}
export function SectionHead({ title, sub, children }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h2 className="font-display text-lg font-semibold text-ink text-balance">{title}</h2>
        {sub && <p className="mt-0.5 text-sm text-muted">{sub}</p>}
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}
export function Segmented({ options, value, onChange, label, className = '', stretch = false }) {
  // A white pill slides under the selected option (position measured from the button)
  const box = useRef(null);
  const [thumb, setThumb] = useState(null);
  useLayoutEffect(() => {
    const measure = () => {
      const on = box.current?.querySelector('[aria-checked="true"]');
      setThumb(on ? { left: on.offsetLeft, width: on.offsetWidth, top: on.offsetTop, height: on.offsetHeight } : null);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [value, options.length]);
  return (
    <div ref={box} role="radiogroup" aria-label={label} className={cx('fx-scroll-x relative inline-flex max-w-full shrink-0 flex-nowrap gap-1 self-start rounded-full border border-white/15 p-1', className)}>
      {thumb && <span className="fx-thumb" style={{ left: thumb.left, width: thumb.width, top: thumb.top, height: thumb.height }} aria-hidden="true" />}
      {options.map(([v, text, extra]) => (
        <button key={String(v)} type="button" role="radio" aria-checked={value === v} onClick={() => onChange(v)}
          className={cx('relative h-8 shrink-0 whitespace-nowrap rounded-full px-3.5 text-[13px] font-semibold transition-colors duration-300 cursor-pointer', stretch && 'flex-1',
            value === v ? 'text-[#111]' : 'text-muted hover:text-ink')}>
          {text}{extra != null && <span className="ml-1.5 tabular-nums opacity-70">{extra}</span>}
        </button>
      ))}
    </div>
  );
}

export const inputCls = 'fx-input h-10 w-full rounded-xl border-[1.5px] border-white/12 bg-white/[.03] px-3 text-sm text-ink placeholder:text-muted focus:outline-none';
export function Field({ label, id, hint, children, className = '' }) {
  return (
    <div className={cx('flex min-w-0 flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-[13px] font-semibold text-ink">{label}</label>
      {children}
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function Modal({ title, onClose, children, footer, wide = false }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fx-scrim fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={title}
        className={cx('fx-dialog flex max-h-[90%] w-full flex-col overflow-hidden rounded-[22px] border border-white/10 bg-[#121215]', wide ? 'max-w-2xl' : 'max-w-md')}>
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
          <h2 className="font-display text-lg font-semibold">{title}</h2>
          <IconButton icon="close" label="Close" onClick={onClose} />
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-line bg-black/20 px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

export function Empty({ icon = 'invoice', title, body, action }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-accent/30 bg-accent-soft text-accent shadow-[0_0_18px_rgba(61,255,110,.25)]"><Icon name={icon} size={22} /></div>
      <div>
        <p className="font-semibold text-ink">{title}</p>
        {body && <p className="mt-1 max-w-sm text-sm text-muted">{body}</p>}
      </div>
      {action}
    </div>
  );
}

export const Th = ({ children, right, className = '' }) => (
  <th scope="col" className={cx('fx-th whitespace-nowrap border-b border-line bg-white/[.02] px-3 py-3 font-semibold text-muted first:pl-5 last:pr-5', right ? 'text-right' : 'text-left', className)}>{children}</th>
);
export const Td = ({ children, right, className = '', ...rest }) => (
  <td {...rest} className={cx('whitespace-nowrap border-b border-line/70 px-3 py-3.5 text-sm first:pl-5 last:pr-5', right && 'text-right tabular-nums', className)}>{children}</td>
);

// ------------------------------------------------------------------ phone lists (used instead of tables on small screens)
export function MobileList({ children, className = '' }) {
  return <ul className={cx('flex flex-col divide-y divide-line', className)}>{children}</ul>;
}
/** One record as a card row: title + amount on top, details below, then tags and action buttons. */
export function MobileRow({ title, onOpen, sub, value, valueClass = '', valueSub, meta, actions, children }) {
  return (
    <li className="fx-mrow flex flex-col gap-2 px-4 py-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {onOpen
            ? <button type="button" onClick={onOpen} className="text-left font-semibold tabular-nums text-ink hover:text-accent cursor-pointer">{title}</button>
            : <div className="font-semibold">{title}</div>}
          {sub && <div className="mt-0.5 text-xs leading-relaxed text-muted">{sub}</div>}
        </div>
        {(value != null || valueSub) && (
          <div className="shrink-0 text-right">
            {value != null && <div className={cx('font-bold tabular-nums', valueClass)}>{value}</div>}
            {valueSub && <div className="mt-0.5 text-xs text-muted tabular-nums">{valueSub}</div>}
          </div>
        )}
      </div>
      {children}
      {(meta || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">{meta}</div>
          {actions && <div className="-mr-1.5 flex flex-wrap items-center justify-end gap-0.5">{actions}</div>}
        </div>
      )}
    </li>
  );
}

/** Small "Edited 24 Oct 2026, 7:06 pm" line, shown when a record was changed after it was created. */
export function EditedAt({ at, className = '' }) {
  if (!at) return null;
  return <div className={cx('flex items-center gap-1 text-[11px] font-medium text-accent/85', className)}><Icon name="edit" size={10} />Edited {fdateTime(at)}</div>;
}
