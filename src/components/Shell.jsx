import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useApp } from '../store.jsx';
import { Icon, Button, IconButton, cx } from './ui.jsx';

const NAV = [
  ['Sales', [
    ['dashboard', 'Dashboard', 'home'],
    ['invoices', 'Invoices', 'invoice'],
    ['quotes', 'Quotations', 'quote'],
    ['credits', 'Credit notes', 'credit'],
  ]],
  ['Records', [
    ['customers', 'Customers', 'users'],
    ['products', 'Products', 'box'],
    ['expenses', 'Expenses', 'wallet'],
  ]],
  ['Insights', [
    ['reports', 'Reports & P&L', 'chart'],
    ['settings', 'Invoice template', 'palette'],
  ]],
];

const ACTIVE = { form: 'invoices', invoice: 'invoices' };

export function Sidebar() {
  const { s, a, d, seller } = useApp();
  const current = s.screen === 'form' && s.form?.kind === 'quote' ? 'quotes' : ACTIVE[s.screen] || s.screen;
  const overdue = d.invs.filter((i) => i.ds === 'overdue').length;

  const close = () => a.set({ navOpen: false });
  // On phones the menu slides in over the page; Escape or tapping outside closes it
  useEffect(() => {
    if (!s.navOpen) return undefined;
    const onKey = (e) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [s.navOpen]);

  const body = (mobile) => (
    <nav aria-label="Main" className="flex min-h-full flex-col gap-6 px-3 py-5">
      <div className="flex items-center gap-2.5 px-2">
        <div className="fx-brand flex h-10 w-10 items-center justify-center rounded-xl"><Icon name="rupee" size={20} stroke={2.4} /></div>
        <div>
          <div className="fx-brand-text text-[19px] font-bold leading-tight text-white">InvoiceDesk</div>
          <div className="text-[11px] text-side-ink/80">GST billing</div>
        </div>
        {mobile && <IconButton icon="close" label="Close menu" onClick={close} className="ml-auto" />}
      </div>
      <NavLinks current={current} overdue={overdue} onGo={a.go} />
      <div className="mt-auto flex flex-col gap-2">
        <div className="rounded-2xl border border-white/10 bg-[linear-gradient(160deg,rgba(61,255,110,.07),transparent_60%)] p-3 text-xs leading-relaxed text-side-ink">
          <div className="text-sm font-semibold text-white">{seller.name}</div>
          <div className="tabular-nums">GSTIN {seller.gstin}</div>
          <div>{seller.stateName} ({seller.state})</div>
        </div>
        <button type="button" onClick={a.logout} className="fx-nav flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium text-side-ink transition-colors hover:text-[#FF3D7F] cursor-pointer">
          <Icon name="logout" size={18} />Log out
        </button>
      </div>
    </nav>
  );

  return (
    <>
      <aside className="sticky top-0 z-10 hidden h-screen w-64 shrink-0 overflow-y-auto border-r border-white/[.07] bg-side/75 backdrop-blur-xl lg:block">{body(false)}</aside>
      {s.navOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="fx-scrim absolute inset-0" onClick={close} aria-hidden="true" />
          <aside className="fx-drawer-left relative h-full w-72 max-w-[85%] overflow-y-auto border-r border-white/10 bg-side shadow-2xl" style={{ paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>{body(true)}</aside>
        </div>
      )}
    </>
  );
}

/** The page links, with a glowing highlight that slides to the current page. */
function NavLinks({ current, overdue, onGo }) {
  const box = useRef(null);
  const [top, setTop] = useState(null);
  useLayoutEffect(() => {
    const el = box.current?.querySelector('[aria-current="page"]');
    setTop(el ? el.offsetTop : null);
  }, [current]);
  return (
    <div ref={box} className="relative flex flex-col gap-5">
      <span className="fx-indicator" style={{ top: top ?? 0, opacity: top == null ? 0 : 1 }} aria-hidden="true" />
      {NAV.map(([group, items]) => (
        <div key={group} className="flex flex-col gap-0.5">
          <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-[.14em] text-side-ink/60">{group}</div>
          {items.map(([key, label, icon]) => (
            <button key={key} type="button" onClick={() => onGo(key)} aria-current={current === key ? 'page' : undefined}
              className={cx('fx-nav relative flex h-10 items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold transition-colors cursor-pointer',
                current === key ? 'text-white' : 'text-side-ink hover:text-white')}>
              <Icon name={icon} size={18} />
              <span className="flex-1">{label}</span>
              {key === 'invoices' && overdue > 0 && <span className="rounded-full border border-[#FF3D7F]/40 bg-[#FF3D7F]/15 px-2 text-[11px] font-bold leading-5 text-[#FF3D7F]" aria-label={`${overdue} overdue`}>{overdue} overdue</span>}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

const TITLES = {
  dashboard: 'Dashboard', invoices: 'Invoices', quotes: 'Quotations', credits: 'Credit notes', customers: 'Customers',
  products: 'Products & services', expenses: 'Expenses', reports: 'Reports & profit and loss', settings: 'Invoice template',
};

export function Topbar() {
  const { s, a } = useApp();
  let title = TITLES[s.screen];
  if (s.screen === 'invoice') title = s.viewNo;
  if (s.screen === 'form') title = s.form.editingNo ? `Edit ${s.form.editingNo}` : s.form.kind === 'quote' ? 'New quotation' : 'New invoice';

  return (
    <header className="sticky z-30 border-b border-white/[.07] bg-bg/70 backdrop-blur-xl" style={{ top: 'env(safe-area-inset-top, 0px)' }}>
      <div className="gutter flex h-16 items-center gap-3">
        <button type="button" onClick={() => a.set({ navOpen: true })} aria-label="Open menu" className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-ink hover:bg-white/5 lg:hidden cursor-pointer">
          <Icon name="menu" size={20} />
        </button>
        <h1 className="min-w-0 flex-1 truncate font-display text-xl font-semibold text-ink">{title}</h1>
        <label htmlFor="global-search" className="relative hidden md:block">
          <span className="sr-only">Search invoices</span>
          <Icon name="search" size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input id="global-search" type="search" placeholder="Search invoices or customers" value={s.invSearch}
            onChange={(e) => a.set({ invSearch: e.target.value, screen: 'invoices', invFilter: 'all' })}
            className="fx-input h-10 w-64 rounded-full border-[1.5px] border-white/15 bg-transparent pl-9 pr-4 text-sm text-ink placeholder:text-muted transition-[width] duration-300 focus:w-80 focus:outline-none" />
        </label>
        <span className="hidden sm:contents"><Button variant={s.chat.open ? 'soft' : 'secondary'} icon="sparkle" onClick={a.chat.toggle}>Assistant</Button></span>
        <Button variant="primary" icon="plus" onClick={a.newInvoice}><span className="hidden sm:inline">New invoice</span><span className="sm:hidden">New</span></Button>
      </div>
    </header>
  );
}

export function Toast() {
  const { s, a } = useApp();
  const id = s.toast?.id;
  useEffect(() => {
    if (!id) return undefined;
    const timer = setTimeout(() => a.set((p) => (p.toast?.id === id ? { toast: null } : {})), 4000);
    return () => clearTimeout(timer);
  }, [id]);
  if (!s.toast) return null;
  const error = s.toast.tone === 'error';
  return (
    <div className="pointer-events-none fixed inset-x-0 z-[60] flex justify-center px-4" style={{ bottom: 'calc(20px + env(safe-area-inset-bottom, 0px))' }}>
      <div role="status" key={s.toast.id} className={cx('fx-toast toast-in pointer-events-auto flex max-w-lg items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold', error && 'fx-toast-error')}>
        <span className="fx-toast-icon shrink-0"><Icon name={error ? 'alert' : 'check'} size={14} stroke={3} /></span>
        <span>{s.toast.text}</span>
        <button type="button" onClick={() => a.set({ toast: null })} className="ml-2 rounded-md px-1.5 text-xs font-semibold opacity-80 hover:opacity-100 cursor-pointer">Dismiss</button>
      </div>
    </div>
  );
}

/** Background behind every page: soft moving glow, three faint neon rings, film grain. */
export function Backdrop() {
  return (
    <div className="fx-bg" aria-hidden="true">
      <div className="fx-aurora" />
      <i className="fx-ring" style={{ '--c': '#FF3D7F', '--t': '40s' }} />
      <i className="fx-ring" style={{ '--c': '#3DFF6E', '--t': '55s', animationDirection: 'reverse' }} />
      <i className="fx-ring" style={{ '--c': '#FFF15C', '--t': '70s' }} />
      <div className="fx-grain" />
    </div>
  );
}
