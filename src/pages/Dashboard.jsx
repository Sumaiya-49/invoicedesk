import { useApp } from '../store.jsx';
import { Card, SectionHead, Button, StatusPill, TypeBadge, Th, Td, MobileList, MobileRow, cx } from '../components/ui.jsx';
import { inr, inr0, fdate, monthShort, daysBetween, TODAY, r2 } from '../lib/format.js';
import { useIsPhone } from '../lib/effects.js';

const ZERO = { billed: 0, invoiceCount: 0, profit: 0, netSales: 0, expenses: 0, gstPayable: 0, outGst: 0, inGst: 0 };
const monthKey = (date) => date.slice(0, 7);
const prevKey = (key) => {
  const [y, m] = key.split('-').map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
};
// Greeting by the time on the viewer's device (Indian time for users in India)
const greeting = () => {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'Good morning';    // 5 AM to 12 PM
  if (h >= 12 && h < 17) return 'Good afternoon'; // 12 PM to 5 PM
  if (h >= 17 && h < 21) return 'Good evening';   // 5 PM to 9 PM
  return 'Welcome';                               // night: 9 PM to 5 AM
};

export function Dashboard() {
  const { s, d, a, seller } = useApp();
  const phone = useIsPhone();
  if (!s.customers.length && !d.invs.length) return <Welcome />;

  // Numbers for the current month, compared with last month
  const thisKey = monthKey(TODAY);
  const cur = d.months.find((m) => m.key === thisKey) || { ...ZERO, key: thisKey };
  const prev = d.months.find((m) => m.key === prevKey(thisKey));
  const monthName = new Date(`${thisKey}-01T00:00:00`).toLocaleString('en-IN', { month: 'long' });
  const prevName = prev ? new Date(`${prev.key}-01T00:00:00`).toLocaleString('en-IN', { month: 'short' }) : '';
  const unpaid = d.invs.filter((i) => i.balance > 0);
  const overdue = d.invs.filter((i) => i.ds === 'overdue');
  const outstanding = r2(unpaid.reduce((sum, i) => sum + i.balance, 0));
  const openQuotes = d.quotes.filter((q) => q.ds === 'sent' || q.ds === 'accepted');
  const change = prev && prev.billed ? Math.round(((cur.billed - prev.billed) / prev.billed) * 100) : null;

  const kpis = [
    [`Billed in ${monthName}`, inr0(cur.billed), `${cur.invoiceCount} invoices${change != null ? ` · ${change >= 0 ? '+' : ''}${change}% vs ${prevName}` : ''}`, null],
    ['Outstanding', inr0(outstanding), `${unpaid.length} unpaid · ${overdue.length} overdue`, overdue.length ? 'warn' : null],
    [`Net profit · ${monthName}`, `${cur.profit < 0 ? '−' : ''}${inr0(Math.abs(cur.profit))}`, `Sales ${inr0(cur.netSales)} − expenses ${inr0(cur.expenses)}`, cur.profit < 0 ? 'danger' : 'ok'],
    [`GST payable · ${monthName}`, inr0(cur.gstPayable), `Output ${inr0(cur.outGst)} − input ${inr0(cur.inGst)}`, null],
  ];

  const attention = [
    ...overdue.map((i) => ({ key: i.no, no: i.no, who: i.c.name, note: `${daysBetween(i.due, TODAY)} days overdue`, amt: i.balance, inv: i, tone: 'warn' })),
    ...d.invs.filter((i) => i.ds === 'partially_paid').map((i) => ({ key: i.no, no: i.no, who: i.c.name, note: `part paid · due ${fdate(i.due)}`, amt: i.balance, inv: i, tone: 'violet' })),
    ...d.quotes.filter((q) => q.ds === 'accepted').map((q) => ({ key: q.no, no: q.no, who: q.c.name, note: 'accepted · ready to invoice', amt: q.t.total, quote: q, tone: 'ok' })),
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
          <h2 className="mt-1 font-display text-3xl font-semibold text-balance">{greeting()}, {seller.name}</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button icon="quote" onClick={a.newQuote}>New quotation</Button>
          <Button icon="wallet" onClick={() => a.go('expenses')}>Add expense</Button>
        </div>
      </div>

      <Card className="grid overflow-hidden sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map(([label, value, sub, tone], i) => (
          <div key={label} className={cx('flex flex-col gap-1 p-5', i > 0 && 'border-t border-line sm:border-t-0', i % 2 === 1 && 'sm:border-l', i >= 2 && 'sm:border-t xl:border-t-0', i > 0 && 'xl:border-l', 'border-line')}>
            <div className="text-[13px] font-medium text-muted">{label}</div>
            <div className={cx('font-display text-[28px] font-semibold tabular-nums leading-tight', tone === 'warn' && 'text-warn', tone === 'danger' && 'text-danger', tone === 'ok' && 'text-ok')}>{value}</div>
            <div className="text-xs text-muted tabular-nums">{sub}</div>
          </div>
        ))}
      </Card>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card className="min-w-0 p-5">
          <SectionHead title="Sales vs expenses" sub="Excluding GST, after credit notes">
            <Button size="sm" variant="ghost" onClick={() => a.go('reports')}>Open P&amp;L</Button>
          </SectionHead>
          {d.months.length
            ? <SalesChart months={d.months.slice(-6)} />
            : <p className="mt-4 text-sm text-muted">The chart appears once you have invoices or expenses.</p>}
        </Card>

        <Card className="min-w-0 p-5">
          <SectionHead title="Needs attention" sub={`${attention.length} item${attention.length === 1 ? '' : 's'}`}>
            {overdue.length > 0 && <Button size="sm" icon="bell" onClick={() => a.openReminder(overdue.map((i) => i.no))}>Remind all</Button>}
          </SectionHead>
          <ul className="mt-4 flex flex-col gap-2">
            {attention.length === 0 && <li className="rounded-xl bg-sunken p-4 text-sm text-muted">You’re all caught up.</li>}
            {attention.map((x) => (
              <li key={x.key} className="flex items-center gap-3 rounded-xl border border-line p-3">
                <span className={cx('h-9 w-1 shrink-0 rounded-full', x.tone === 'warn' ? 'bg-warn' : x.tone === 'violet' ? 'bg-violet' : 'bg-ok')} aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <button type="button" onClick={() => (x.inv ? a.viewInvoice(x.no) : a.go('quotes'))} className="font-semibold text-ink hover:text-accent cursor-pointer tabular-nums">{x.no}</button>
                  <div className="truncate text-xs text-muted">{x.who} · {x.note}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold tabular-nums">{inr(x.amt)}</div>
                  {x.inv && <button type="button" onClick={() => a.openReminder([x.no])} className="text-xs font-semibold text-accent hover:underline cursor-pointer">{x.inv.reminded ? `Reminded ${fdate(x.inv.reminded)}` : 'Send reminder'}</button>}
                  {x.quote && <button type="button" onClick={() => a.convertQuoteAndOpen(x.no)} className="text-xs font-semibold text-accent hover:underline cursor-pointer">Convert to invoice</button>}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card className="min-w-0 overflow-hidden">
          <div className="p-5 pb-3"><SectionHead title="Recent invoices"><Button size="sm" variant="ghost" onClick={() => a.go('invoices')}>View all</Button></SectionHead></div>
          {phone ? (
            <MobileList className="border-t border-line">
              {d.invs.slice(0, 6).map((i) => (
                <MobileRow key={i.no} title={i.no} onOpen={() => a.viewInvoice(i.no)} sub={`${i.c.name} · ${fdate(i.date)}`} value={inr(i.t.total)} meta={<><StatusPill status={i.ds} /><TypeBadge type={i.type} /></>} />
              ))}
            </MobileList>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead><tr><Th>Invoice</Th><Th>Customer</Th><Th>GST</Th><Th right>Total</Th><Th>Status</Th></tr></thead>
                <tbody>
                  {d.invs.slice(0, 6).map((i) => (
                    <tr key={i.no} className="hover:bg-sunken/50">
                      <Td><button type="button" onClick={() => a.viewInvoice(i.no)} className="font-semibold tabular-nums text-ink hover:text-accent cursor-pointer">{i.no}</button><div className="text-xs text-muted">{fdate(i.date)}</div></Td>
                      <Td>{i.c.name}</Td>
                      <Td><TypeBadge type={i.type} /></Td>
                      <Td right className="font-semibold">{inr(i.t.total)}</Td>
                      <Td><StatusPill status={i.ds} /></Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        <Card className="min-w-0 p-5">
          <SectionHead title="Open quotations" sub={`${inr0(openQuotes.reduce((sum, q) => sum + q.t.total, 0))} waiting on customers`}>
            <Button size="sm" variant="ghost" onClick={() => a.go('quotes')}>View all</Button>
          </SectionHead>
          <ul className="mt-4 flex flex-col divide-y divide-line">
            {openQuotes.length === 0 && <li className="py-3 text-sm text-muted">No open quotations.</li>}
            {openQuotes.map((q) => (
              <li key={q.no} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0"><div className="font-semibold tabular-nums">{q.no}</div><div className="truncate text-xs text-muted">{q.c.name} · valid till {fdate(q.valid)}</div></div>
                <div className="flex flex-col items-end gap-1"><span className="text-sm font-semibold tabular-nums">{inr0(q.t.total)}</span><StatusPill status={q.ds} /></div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}

/** Bars for net sales and expenses per month, with the profit or loss under each month. */
function SalesChart({ months }) {
  const W = 560, H = 230, pad = { l: 56, r: 12, t: 16, b: 34 };
  const max = Math.max(1, ...months.flatMap((m) => [m.netSales, m.expenses]));
  const step = Math.pow(10, Math.floor(Math.log10(max)));
  const top = Math.ceil(max / step) * step;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * top);
  const y = (v) => pad.t + (H - pad.t - pad.b) * (1 - v / top);
  const band = (W - pad.l - pad.r) / months.length;
  const bw = Math.min(34, band / 3.2);

  return (
    <div className="mt-4">
      <div className="mb-3 flex flex-wrap gap-4 text-xs text-muted">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-accent" />Net sales</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-saffron" />Expenses</span>
        <span>Profit or loss shown under each month</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full max-w-full" role="img" aria-label="Monthly net sales versus expenses">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeDasharray={t ? '3 4' : undefined} />
            <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--muted)">{t >= 1e5 ? `${(t / 1e5).toFixed(t % 1e5 ? 1 : 0)}L` : `${Math.round(t / 1000)}k`}</text>
          </g>
        ))}
        {months.map((m, i) => {
          const cx0 = pad.l + band * i + band / 2;
          return (
            <g key={m.key}>
              <rect x={cx0 - bw - 2} y={y(m.netSales)} width={bw} height={Math.max(0, y(0) - y(m.netSales))} rx="5" fill="var(--accent)"><title>Net sales {inr0(m.netSales)}</title></rect>
              <rect x={cx0 + 2} y={y(m.expenses)} width={bw} height={Math.max(0, y(0) - y(m.expenses))} rx="5" fill="var(--saffron)"><title>Expenses {inr0(m.expenses)}</title></rect>
              <text x={cx0} y={H - 14} textAnchor="middle" fontSize="12" fontWeight="600" fill="var(--ink)">{monthShort(m.key)}</text>
              <text x={cx0} y={H - 1} textAnchor="middle" fontSize="11" fill={m.profit < 0 ? 'var(--danger)' : 'var(--ok)'}>{m.profit < 0 ? '−' : '+'}{inr0(Math.abs(m.profit)).slice(1)}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/** Shown to a new account with no data yet. */
function Welcome() {
  const { a, s, seller } = useApp();
  return (
    <Card className="mx-auto mt-6 flex max-w-2xl flex-col gap-6 p-8">
      <div>
        <h2 className="font-display text-3xl font-semibold text-balance">Welcome, {seller.name}</h2>
        <p className="mt-2 text-muted">Your account is ready. Add your customers and products, then create your first GST invoice. Or load a sample business to explore every feature first.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <button type="button" onClick={() => a.set({ screen: 'customers', modal: { type: 'customer', data: { name: '', city: '', state: seller.state, gstin: '', email: '', phone: '' } } })}
          className="flex flex-col gap-1 rounded-xl border border-line p-4 text-left hover:border-accent cursor-pointer">
          <span className="font-semibold">Add your first customer</span>
          <span className="text-sm text-muted">Their state decides CGST + SGST or IGST.</span>
        </button>
        <button type="button" onClick={() => a.set({ screen: 'products', modal: { type: 'product', data: { name: '', hsn: '', unit: 'Nos', rate: '', gst: 18 } } })}
          className="flex flex-col gap-1 rounded-xl border border-line p-4 text-left hover:border-accent cursor-pointer">
          <span className="font-semibold">Add a product or service</span>
          <span className="text-sm text-muted">Price, HSN/SAC code and GST rate.</span>
        </button>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-sunken p-4">
        <span className="text-sm text-muted">Want to try it with data? This adds 5 customers, 6 products and 3 months of invoices.</span>
        <Button variant="primary" onClick={a.loadSample} disabled={s.busy}>{s.busy ? 'Loading…' : 'Load sample data'}</Button>
      </div>
    </Card>
  );
}
