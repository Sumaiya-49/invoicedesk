import { useState } from 'react';
import { useApp } from '../store.jsx';
import { Card, SectionHead, Button, StatusPill, TypeBadge, Icon, Segmented, Th, Td, MobileList, MobileRow, cx } from '../components/ui.jsx';
import { inr, inr0, fdate, monthShort, monthLabel, daysBetween, TODAY, r2 } from '../lib/format.js';
import { useCountUp, useIsPhone } from '../lib/effects.js';

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
const pct = (now, before) => (before ? Math.round(((now - before) / Math.abs(before)) * 100) : null);

// Colours used for each kind of number (same as the login page rings)
const GREEN = '#3DFF6E', PINK = '#FF3D7F', YELLOW = '#FFF15C', VIOLET = '#B48CFF';

export function Dashboard() {
    const { s, d, a, seller } = useApp();
    const phone = useIsPhone();
    if (!s.customers.length && !d.invs.length) return <Welcome />;

    // Numbers for the current month, compared with last month
    const thisKey = monthKey(TODAY);
    const cur = d.months.find((m) => m.key === thisKey) || { ...ZERO, key: thisKey };
    const prev = d.months.find((m) => m.key === prevKey(thisKey));
    const monthName = new Date(`${thisKey}-01T00:00:00`).toLocaleString('en-IN', { month: 'long' });
    const unpaid = d.invs.filter((i) => i.balance > 0);
    const overdue = d.invs.filter((i) => i.ds === 'overdue');
    const outstanding = r2(unpaid.reduce((sum, i) => sum + i.balance, 0));
    const openQuotes = d.quotes.filter((q) => q.ds === 'sent' || q.ds === 'accepted');

    // Small trend line under each number: one point per month (last 6 months)
    const unpaidByMonth = d.months.map((m) => unpaid.filter((i) => i.date.startsWith(m.key)).reduce((sum, i) => sum + i.balance, 0));
    const kpis = [
        { label: `Billed in ${monthName}`, value: cur.billed, colour: GREEN, icon: 'invoice', plain: true,
            change: pct(cur.billed, prev?.billed), sub: `${cur.invoiceCount} invoices vs last month`, trend: d.months.map((m) => m.billed) },
        { label: 'Outstanding', value: outstanding, colour: PINK, icon: 'bell',
            sub: `${unpaid.length} unpaid · ${overdue.length} overdue`, trend: unpaidByMonth },
        { label: `Net profit · ${monthName}`, value: cur.profit, colour: cur.profit < 0 ? PINK : GREEN, icon: 'chart',
            change: pct(cur.profit, prev?.profit), sub: 'vs last month', trend: d.months.map((m) => m.profit) },
        { label: `GST payable · ${monthName}`, value: cur.gstPayable, colour: YELLOW, icon: 'rupee',
            sub: `Output ${inr0(cur.outGst)} − input ${inr0(cur.inGst)}`, trend: d.months.map((m) => m.gstPayable) },
    ];

    const attention = [
        ...overdue.map((i) => ({ key: i.no, no: i.no, who: i.c.name, note: `${daysBetween(i.due, TODAY)} days overdue`, amt: i.balance, inv: i, colour: PINK })),
        ...d.invs.filter((i) => i.ds === 'partially_paid').map((i) => ({ key: i.no, no: i.no, who: i.c.name, note: `part paid · due ${fdate(i.due)}`, amt: i.balance, inv: i, colour: VIOLET })),
        ...d.quotes.filter((q) => q.ds === 'accepted').map((q) => ({ key: q.no, no: q.no, who: q.c.name, note: 'accepted · ready to invoice', amt: q.t.total, quote: q, colour: GREEN })),
    ];

    // How much of the last 3 months' billing has been collected
    const recentKeys = d.months.slice(-3).map((m) => m.key);
    const recent = d.invs.filter((i) => i.live && recentKeys.some((k) => i.date.startsWith(k)));
    const billed = r2(recent.reduce((sum, i) => sum + i.t.total, 0));
    const collected = r2(recent.reduce((sum, i) => sum + (i.t.total - i.balance), 0));

    return (
        <div className="fx-page flex flex-col gap-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <p className="flex items-center gap-2 text-sm text-muted"><span className="fx-live" aria-hidden="true" />{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
                    <h2 className="mt-1 font-display text-[30px] font-semibold leading-tight text-balance sm:text-[34px]">{greeting()}, <span className="fx-shimmer">{seller.name}</span></h2>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button icon="quote" onClick={a.newQuote}>New quotation</Button>
                    <Button icon="wallet" onClick={() => a.go('expenses')}>Add expense</Button>
                </div>
            </div>

            <div className="fx-stagger grid grid-cols-2 gap-3 [perspective:900px] sm:gap-4 xl:grid-cols-4">
                {kpis.map((k) => <Kpi key={k.label} {...k} />)}
            </div>

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
                <Card className="min-w-0 p-5 sm:p-6">
                    {d.months.length ? <SalesChart months={d.months} onOpen={() => a.go('reports')} />
                        : <><SectionHead title="Sales vs expenses" /><p className="mt-4 text-sm text-muted">The chart appears once you have invoices or expenses.</p></>}
                </Card>

                <Card className="flex min-w-0 flex-col p-5 sm:p-6">
                    <SectionHead title="Needs attention" sub={`${attention.length} item${attention.length === 1 ? '' : 's'}`}>
                        {overdue.length > 0 && <Button size="sm" icon="bell" onClick={() => a.openReminder(overdue.map((i) => i.no))}>Remind all</Button>}
                    </SectionHead>
                    <ul className="mt-4 flex flex-col gap-2.5">
                        {attention.length === 0 && <li className="rounded-2xl border border-accent/25 bg-accent-soft p-4 text-sm font-semibold text-accent">You’re all caught up.</li>}
                        {attention.map((x) => (
                            <li key={x.key} className="fx-item flex items-center gap-3 rounded-2xl border border-line bg-sunken/70 p-3.5" style={{ '--c': x.colour }}>
                                <span className="fx-bar-dot h-10 w-1 shrink-0 rounded-full" aria-hidden="true" />
                                <div className="relative z-[1] min-w-0 flex-1">
                                    <button type="button" onClick={() => (x.inv ? a.viewInvoice(x.no) : a.go('quotes'))} className="font-semibold text-ink hover:text-accent cursor-pointer tabular-nums">{x.no}</button>
                                    <div className="truncate text-xs text-muted">{x.who} · {x.note}</div>
                                </div>
                                <div className="relative z-[1] text-right">
                                    <div className="text-sm font-bold tabular-nums">{inr(x.amt)}</div>
                                    {x.inv && <button type="button" onClick={() => a.openReminder([x.no])} className="text-xs font-semibold text-accent hover:underline cursor-pointer">{x.inv.reminded ? `Reminded ${fdate(x.inv.reminded)}` : 'Send reminder'}</button>}
                                    {x.quote && <button type="button" onClick={() => a.convertQuoteAndOpen(x.no)} className="text-xs font-semibold text-accent hover:underline cursor-pointer">Convert to invoice</button>}
                                </div>
                            </li>
                        ))}
                    </ul>
                    {billed > 0 && <Collected billed={billed} collected={collected} months={recentKeys.length} />}
                </Card>
            </div>

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
                <Card className="min-w-0 overflow-hidden">
                    <div className="p-5 pb-3 sm:px-6"><SectionHead title="Recent invoices"><Button size="sm" variant="ghost" onClick={() => a.go('invoices')}>View all →</Button></SectionHead></div>
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
                                    <tr key={i.no} className="fx-row">
                                        <Td><button type="button" onClick={() => a.viewInvoice(i.no)} className="font-semibold tabular-nums text-ink hover:text-accent cursor-pointer">{i.no}</button><div className="text-xs text-muted">{fdate(i.date)}</div></Td>
                                        <Td><span className="inline-flex items-center gap-2.5"><Avatar name={i.c.name} />{i.c.name}</span></Td>
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
                <Card className="min-w-0 p-5 sm:p-6">
                    <SectionHead title="Open quotations" sub={`${inr0(openQuotes.reduce((sum, q) => sum + q.t.total, 0))} waiting on customers`}>
                        <Button size="sm" variant="ghost" onClick={() => a.go('quotes')}>View all →</Button>
                    </SectionHead>
                    <ul className="mt-4 flex flex-col gap-2">
                        {openQuotes.length === 0 && <li className="text-sm text-muted">No open quotations.</li>}
                        {openQuotes.map((q) => (
                            <li key={q.no} className="fx-item flex items-center justify-between gap-3 rounded-2xl border border-line bg-sunken/50 p-3" style={{ '--c': q.ds === 'accepted' ? GREEN : YELLOW }}>
                                <div className="relative z-[1] min-w-0"><div className="font-semibold tabular-nums">{q.no}</div><div className="truncate text-xs text-muted">{q.c.name} · valid till {fdate(q.valid)}</div></div>
                                <div className="relative z-[1] flex flex-col items-end gap-1"><span className="text-sm font-bold tabular-nums">{inr0(q.t.total)}</span><StatusPill status={q.ds} /></div>
                            </li>
                        ))}
                    </ul>
                </Card>
            </div>
        </div>
    );
}

/** One number card: counts up, has a trend line, tilts and glows on hover. */
function Kpi({ label, value, colour, icon, change, sub, trend, plain }) {
    const shown = useCountUp(value);
    return (
        <section className="fx-card fx-tilt fx-kpi relative min-w-0 rounded-[20px] border border-line bg-surface/90 p-4 sm:p-5" style={{ '--c': colour }}>
            <span className="fx-kpi-edge" aria-hidden="true" /><span className="fx-kpi-line" aria-hidden="true" /><span className="fx-kpi-orb" aria-hidden="true" />
            <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium leading-snug text-muted sm:text-[13px]">{label}</span>
                <span className="hidden h-8 w-8 shrink-0 items-center sm:flex justify-center rounded-[10px] border" style={{ color: colour, background: `${colour}1F`, borderColor: `${colour}59` }}><Icon name={icon} size={15} stroke={2.3} /></span>
            </div>
            <div className={cx('mt-2 text-[20px] font-extrabold leading-tight tabular-nums tracking-tight min-[400px]:text-[22px] sm:text-[28px]', !plain && 'fx-glow')} style={plain ? undefined : { color: colour }}>
                {value < 0 ? '−' : ''}{inr0(Math.abs(shown))}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] leading-snug text-muted sm:text-xs">
                {change != null && (
                    <span className="rounded-full px-1.5 font-bold" style={{ color: change >= 0 ? GREEN : PINK, background: change >= 0 ? `${GREEN}1A` : `${PINK}1A` }}>
            {change >= 0 ? '↑' : '↓'} {Math.abs(change)}%
          </span>
                )}
                {sub}
            </div>
            <Sparkline values={trend} />
        </section>
    );
}

function Sparkline({ values }) {
    if (values.length < 2) return <div className="mt-3 h-9" />;
    const W = 200, H = 36, min = Math.min(...values), max = Math.max(...values), span = max - min || 1;
    const pts = values.map((v, i) => [(i / (values.length - 1)) * W, 4 + (1 - (v - min) / span) * (H - 8)]);
    const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
    const [lx, ly] = pts[pts.length - 1];
    return (
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="mt-3 block h-9 w-full overflow-visible" aria-hidden="true">
            <path d={`${line} L${W} ${H} L0 ${H}Z`} className="fx-spark-fill" fill="var(--c)" fillOpacity=".1" />
            <path d={line} className="fx-spark-line" vectorEffect="non-scaling-stroke" />
            <circle cx={lx} cy={ly} r="3" className="fx-spark-dot" />
        </svg>
    );
}

/** Ring that fills up to show how much has been collected. */
function Collected({ billed, collected, months }) {
    const p = Math.max(0, Math.min(1, collected / billed));
    return (
        <div className="mt-auto flex items-center gap-4 border-t border-dashed border-white/15 pt-5">
            <svg viewBox="0 0 64 64" className="h-16 w-16 shrink-0 -rotate-90" aria-hidden="true">
                <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="7" />
                <circle cx="32" cy="32" r="28" fill="none" stroke={GREEN} strokeWidth="7" strokeLinecap="round" className="fx-progress" style={{ '--p': (p * 176).toFixed(1) }} />
            </svg>
            <div>
                <div className="fx-glow text-lg font-bold" style={{ color: GREEN }}>{Math.round(p * 100)}% collected</div>
                <div className="text-[13px] text-muted">{inr0(collected)} of {inr0(billed)} billed in the last {months} month{months === 1 ? '' : 's'}</div>
            </div>
        </div>
    );
}

const AVATAR_COLOURS = [GREEN, YELLOW, PINK, VIOLET];
export function Avatar({ name }) {
    const initials = name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
    const colour = AVATAR_COLOURS[[...name].reduce((n, ch) => n + ch.charCodeAt(0), 0) % AVATAR_COLOURS.length];
    return <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] text-xs font-bold text-[#111]" style={{ background: colour, boxShadow: `0 0 12px ${colour}55` }} aria-hidden="true">{initials}</span>;
}

/** Bars for net sales and expenses per month. Hover a month to see the numbers. */
function SalesChart({ months: all, onOpen }) {
    const [range, setRange] = useState(all.length > 3 ? 3 : 6);
    const months = all.slice(-range);
    const max = Math.max(1, ...months.flatMap((m) => [m.netSales, m.expenses]));
    const step = Math.pow(10, Math.floor(Math.log10(max)));
    const top = Math.ceil(max / step) * step;
    const label = (t) => (t >= 1e5 ? `${(t / 1e5).toFixed(t % 1e5 ? 1 : 0)}L` : `${Math.round(t / 1000)}k`);
    const h = (v) => `${Math.max(0, (v / top) * 100)}%`;

    return (
        <div>
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                    <h2 className="font-display text-lg font-semibold text-ink">Sales vs expenses</h2>
                    <p className="mt-0.5 text-sm text-muted">Excluding GST, after credit notes</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {all.length > 3 && <Segmented label="Months shown" value={range} onChange={setRange} options={[[3, '3M'], [6, '6M']]} />}
                    <Button size="sm" variant="ghost" onClick={onOpen}>Open P&amp;L →</Button>
                </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted">
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-[3px] bg-[#3DFF6E] shadow-[0_0_8px_#3DFF6E]" />Net sales</span>
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-[3px] bg-[#FF3D7F] shadow-[0_0_8px_#FF3D7F]" />Expenses</span>
                <span className="hidden sm:inline">Hover a month for details</span>
            </div>

            <div className="mt-5 grid grid-cols-[40px_minmax(0,1fr)]" role="img" aria-label="Monthly net sales versus expenses">
                <div className="relative h-[230px] text-right text-[11px] text-muted">
                    {[1, 0.75, 0.5, 0.25, 0].map((f) => <span key={f} className="absolute right-2 -translate-y-1/2" style={{ top: `${(1 - f) * 100}%` }}>{label(f * top)}</span>)}
                </div>
                <div className="min-w-0">
                    <div className="fx-plot relative flex h-[230px] items-end justify-around border-b border-white/10 bg-[repeating-linear-gradient(to_top,transparent_0,transparent_calc(25%-1px),rgba(255,255,255,.05)_calc(25%-1px),rgba(255,255,255,.05)_25%)]">
                        {months.map((m, i) => (
                            <div key={m.key} className="fx-month flex h-full items-end gap-1.5 px-1.5 sm:gap-2.5 sm:px-3">
                                <div className="fx-tip" role="presentation">
                                    <div className="mb-1 font-bold">{monthLabel(m.key)}</div>
                                    <Row k="Net sales" v={inr0(m.netSales)} c={GREEN} />
                                    <Row k="Expenses" v={inr0(m.expenses)} c={PINK} />
                                    <Row k={m.profit < 0 ? 'Loss' : 'Profit'} v={`${m.profit < 0 ? '−' : '+'}${inr0(Math.abs(m.profit))}`} c={m.profit < 0 ? PINK : GREEN} bold />
                                </div>
                                <div className="fx-bar fx-bar-sales w-4 sm:w-8" style={{ height: h(m.netSales), animationDelay: `${i * 0.12}s` }} />
                                <div className="fx-bar fx-bar-exp w-4 sm:w-8" style={{ height: h(m.expenses), animationDelay: `${i * 0.12 + 0.06}s` }} />
                            </div>
                        ))}
                    </div>
                    <div className="flex justify-around pt-2">
                        {months.map((m) => (
                            <div key={m.key} className="text-center">
                                <div className="text-[13px] font-semibold">{monthShort(m.key)}</div>
                                <div className="fx-glow text-xs font-bold tabular-nums" style={{ color: m.profit < 0 ? PINK : GREEN }}>{m.profit < 0 ? '−' : '+'}{inr0(Math.abs(m.profit)).slice(1)}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

const Row = ({ k, v, c, bold }) => (
    <div className="flex justify-between gap-4 py-px"><span className="text-muted">{k}</span><span className={bold ? 'font-bold' : 'font-semibold'} style={{ color: c }}>{v}</span></div>
);


/** Shown to a new account with no data yet. */
function Welcome() {
    const { a, s, seller } = useApp();
    return (
        <Card className="fx-page mx-auto mt-6 flex max-w-2xl flex-col gap-6 p-8">
            <div>
                <h2 className="font-display text-3xl font-semibold text-balance">Welcome, <span className="fx-shimmer">{seller.name}</span></h2>
                <p className="mt-2 text-muted">Your account is ready. Add your customers and products, then create your first GST invoice. Or load a sample business to explore every feature first.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
                <button type="button" onClick={() => a.set({ screen: 'customers', modal: { type: 'customer', data: { name: '', city: '', state: seller.state, gstin: '', email: '', phone: '' } } })}
                        className="fx-item flex flex-col gap-1 rounded-2xl border border-line bg-sunken/60 p-4 text-left cursor-pointer">
                    <span className="font-semibold">Add your first customer</span>
                    <span className="text-sm text-muted">Their state decides CGST + SGST or IGST.</span>
                </button>
                <button type="button" onClick={() => a.set({ screen: 'products', modal: { type: 'product', data: { name: '', hsn: '', unit: 'Nos', rate: '', gst: 18 } } })}
                        className="fx-item flex flex-col gap-1 rounded-2xl border border-line bg-sunken/60 p-4 text-left cursor-pointer">
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