import { useEffect } from 'react';
import { useApp } from '../store.jsx';
import { Icon, Button, cx } from './ui.jsx';

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
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-accent-ink"><Icon name="rupee" size={19} stroke={2.4} /></div>
        <div>
          <div className="font-display text-[17px] font-bold leading-tight text-white">InvoiceDesk</div>
          <div className="text-[11px] text-side-ink/80">GST billing</div>
        </div>
        {mobile && (
          <button type="button" onClick={close} aria-label="Close menu" className="ml-auto inline-flex h-9 w-9 items-center justify-center rounded-lg text-side-ink hover:bg-white/10 hover:text-white cursor-pointer">
            <Icon name="close" size={18} />
          </button>
        )}
      </div>
      {NAV.map(([group, items]) => (
        <div key={group} className="flex flex-col gap-0.5">
          <div className="px-3 pb-1 text-[11px] font-semibold text-side-ink/70">{group}</div>
          {items.map(([key, label, icon]) => (
            <button key={key} type="button" onClick={() => a.go(key)} aria-current={current === key ? 'page' : undefined}
              className={cx('flex h-10 items-center gap-3 rounded-xl px-3 text-left text-sm font-medium transition-colors cursor-pointer',
                current === key ? 'bg-white/10 text-white' : 'text-side-ink hover:bg-white/5 hover:text-white')}>
              <Icon name={icon} size={18} />
              <span className="flex-1">{label}</span>
              {key === 'invoices' && overdue > 0 && <span className="rounded-full bg-saffron px-1.5 text-[11px] font-bold leading-5 text-[#2A1A05]" aria-label={`${overdue} overdue`}>{overdue}</span>}
            </button>
          ))}
        </div>
      ))}
      <div className="mt-auto flex flex-col gap-2">
        <div className="rounded-xl bg-white/5 p-3 text-xs leading-relaxed text-side-ink">
          <div className="text-sm font-semibold text-white">{seller.name}</div>
          <div className="tabular-nums">GSTIN {seller.gstin}</div>
          <div>{seller.stateName} ({seller.state})</div>
        </div>
        <button type="button" onClick={a.logout} className="flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium text-side-ink hover:bg-white/5 hover:text-white cursor-pointer">
          <Icon name="logout" size={18} />Log out
        </button>
      </div>
    </nav>
  );

  return (
    <>
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 overflow-y-auto bg-side lg:block">{body(false)}</aside>
      {s.navOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-ink/40" onClick={close} aria-hidden="true" />
          <aside className="relative h-full w-72 max-w-[85%] overflow-y-auto bg-side shadow-2xl" style={{ paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>{body(true)}</aside>
        </div>
      )}
    </>
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
    <header className="sticky z-30 border-b border-line bg-bg/85 backdrop-blur" style={{ top: 'env(safe-area-inset-top, 0px)' }}>
      <div className="gutter flex h-16 items-center gap-3">
        <button type="button" onClick={() => a.set({ navOpen: true })} aria-label="Open menu" className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-ink hover:bg-sunken lg:hidden cursor-pointer">
          <Icon name="menu" size={20} />
        </button>
        <h1 className="min-w-0 flex-1 truncate font-display text-xl font-semibold text-ink">{title}</h1>
        <label htmlFor="global-search" className="relative hidden md:block">
          <span className="sr-only">Search invoices</span>
          <Icon name="search" size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input id="global-search" type="search" placeholder="Search invoices or customers" value={s.invSearch}
            onChange={(e) => a.set({ invSearch: e.target.value, screen: 'invoices', invFilter: 'all' })}
            className="h-10 w-64 rounded-xl border border-line bg-surface pl-9 pr-3 text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25" />
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
  const tone = { ok: 'bg-ink text-bg', info: 'bg-ink text-bg', error: 'bg-danger text-white' }[s.toast.tone] || 'bg-ink text-bg';
  return (
    <div className="pointer-events-none fixed inset-x-0 z-[60] flex justify-center px-4" style={{ bottom: 'calc(20px + env(safe-area-inset-bottom, 0px))' }}>
      <div role="status" key={s.toast.id} className={cx('toast-in pointer-events-auto flex max-w-lg items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium shadow-xl', tone)}>
        <Icon name={s.toast.tone === 'error' ? 'alert' : 'check'} size={17} />
        <span>{s.toast.text}</span>
        <button type="button" onClick={() => a.set({ toast: null })} className="ml-2 rounded-md px-1.5 text-xs font-semibold opacity-80 hover:opacity-100 cursor-pointer">Dismiss</button>
      </div>
    </div>
  );
}
