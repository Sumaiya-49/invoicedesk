import { useState } from 'react';
import { useApp } from '../store.jsx';
import { Card, Button, IconButton, TypeBadge, Field, SectionHead, Empty, Th, Td, Icon, MobileList, MobileRow, EditedAt, inputCls, cx } from '../components/ui.jsx';
import { useIsPhone } from '../lib/effects.js';
import { hasAltUnit, altRateOf, conversionLabel } from '../lib/units.js';
import { inr, fdate, TODAY, r2, monthLabel } from '../lib/format.js';
import { EXPENSE_CATEGORIES } from '../data/seed.js';

// ------------------------------------------------------------------ credit notes
const REASONS = ['Damaged goods', 'Short supply', 'Goods returned', 'Price overcharged', 'Other'];

export function CreditNotes() {
  const { s, d, a } = useApp();
  const phone = useIsPhone();
  const eligible = d.invs.filter((i) => i.live);
  const [invNo, setInvNo] = useState(s.cnInvoice && d.byNo[s.cnInvoice] ? s.cnInvoice : eligible[0]?.no);
  const [idx, setIdx] = useState(0);
  const [qty, setQty] = useState(1);
  const [reason, setReason] = useState(REASONS[0]);
  const inv = d.byNo[invNo];
  const line = inv?.items[idx] || inv?.items[0];
  const preview = inv && line ? d.calc({ custId: inv.custId, override: inv.type, items: [{ ...line, qty: Number(qty) || 0, disc: 0 }] }) : null;

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
      <Card className="flex flex-col gap-4 p-5">
        <SectionHead title="Issue a credit note" sub="For returns, short supply or overcharging. It reduces what the customer owes and your GST." />
        <Field label="Against invoice" id="cn-inv">
          <select id="cn-inv" className={inputCls} value={invNo} onChange={(e) => { setInvNo(e.target.value); setIdx(0); setQty(1); }}>
            {eligible.map((i) => <option key={i.no} value={i.no}>{i.no} · {i.c.name}</option>)}
          </select>
        </Field>
        {inv && <>
          <Field label="Item" id="cn-item">
            <select id="cn-item" className={inputCls} value={idx} onChange={(e) => setIdx(Number(e.target.value))}>
              {inv.items.map((it, i) => <option key={i} value={i}>{it.name} ({it.qty} {it.unit} @ {inr(it.rate)})</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={`Quantity (${line.unit})`} id="cn-qty"><input id="cn-qty" type="number" min="1" className={cx(inputCls, 'tabular-nums')} value={qty} onChange={(e) => setQty(e.target.value)} /></Field>
            <Field label="Reason" id="cn-reason">
              <select id="cn-reason" className={inputCls} value={reason} onChange={(e) => setReason(e.target.value)}>{REASONS.map((r) => <option key={r}>{r}</option>)}</select>
            </Field>
          </div>
          <div className="flex flex-col gap-1.5 rounded-xl bg-sunken p-3 text-sm">
            <div className="flex items-center justify-between"><span className="text-muted">GST type</span><TypeBadge type={inv.type} /></div>
            <div className="flex justify-between"><span className="text-muted">Taxable</span><span className="tabular-nums">{inr(preview.t.taxable)}</span></div>
            <div className="flex justify-between"><span className="text-muted">GST reversed</span><span className="tabular-nums">{inr(preview.t.gst)}</span></div>
            <div className="flex justify-between font-semibold"><span>Credit total</span><span className="tabular-nums">{inr(preview.t.total)}</span></div>
          </div>
          <Button variant="primary" icon="credit" onClick={() => a.issueCreditNote({ invNo, idx, qty: Number(qty), reason })}>Issue credit note</Button>
        </>}
      </Card>

      <Card className="min-w-0 overflow-hidden">
        {phone ? (
          <MobileList>
            {d.cns.map((c) => (
              <MobileRow key={c.no} title={c.no} sub={<>Against <button type="button" onClick={() => a.viewInvoice(c.invNo)} className="font-semibold text-accent cursor-pointer">{c.invNo}</button> · {c.c.name}<br />{c.item.name} × {c.qty} {c.item.unit} · {fdate(c.date)}</>}
                value={inr(c.t.total)} valueSub={`GST ${inr(c.t.gst)}`} meta={<span className="rounded-md border border-line bg-sunken px-2 py-0.5 text-xs font-semibold text-muted">{c.reason}</span>}
                actions={<IconButton icon="trash" tone="danger" label={`Delete ${c.no}`} onClick={() => a.askDeleteCreditNote(c.no)} />} />
            ))}
          </MobileList>
        ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead><tr><Th>Credit note</Th><Th>Against</Th><Th>Item</Th><Th>Reason</Th><Th right>Taxable</Th><Th right>GST</Th><Th right>Total</Th><Th right><span className="sr-only">Actions</span></Th></tr></thead>
            <tbody>
              {d.cns.map((c) => (
                <tr key={c.no} className="hover:bg-sunken/50">
                  <Td><span className="font-semibold tabular-nums">{c.no}</span><div className="text-xs text-muted">{fdate(c.date)}</div></Td>
                  <Td><button type="button" onClick={() => a.viewInvoice(c.invNo)} className="font-semibold text-accent hover:underline cursor-pointer tabular-nums">{c.invNo}</button><div className="text-xs text-muted">{c.c.name}</div></Td>
                  <Td className="!whitespace-normal">{c.item.name}<div className="text-xs text-muted tabular-nums">{c.qty} {c.item.unit}</div></Td>
                  <Td className="!whitespace-normal text-muted">{c.reason}</Td>
                  <Td right>{inr(c.t.taxable)}</Td>
                  <Td right className="text-muted">{inr(c.t.gst)}<div className="text-xs">{c.type === 'INTRA' ? 'CGST + SGST' : 'IGST'}</div></Td>
                  <Td right className="font-semibold">{inr(c.t.total)}</Td>
                  <Td right><IconButton icon="trash" tone="danger" label={`Delete ${c.no}`} onClick={() => a.askDeleteCreditNote(c.no)} /></Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        )}
        {d.cns.length === 0 && <Empty icon="credit" title="No credit notes" body="Issue one when goods come back or a price was wrong." />}
      </Card>
    </div>
  );
}

// ------------------------------------------------------------------ customers
export function Customers() {
  const { s, d, a, seller } = useApp();
  const phone = useIsPhone();
  const owedBy = (c) => r2(d.invs.filter((i) => i.custId === c.id).reduce((x, i) => x + i.balance, 0));
  const customerActions = (c) => (
    <>
      <IconButton icon="edit" label={`Edit ${c.name}`} onClick={() => a.set({ modal: { type: 'customer', data: { ...c } } })} />
      <IconButton icon="trash" tone="danger" label={`Delete ${c.name}`} onClick={() => a.askDeleteCustomer(c)} />
    </>
  );
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-sm text-muted">GST type is worked out by comparing each customer’s state with yours. The first two digits of a GSTIN are its state code.</p>
        <Button variant="primary" icon="plus" onClick={() => a.set({ modal: { type: 'customer', data: { name: '', city: '', state: seller.state, gstin: '', email: '', phone: '' } } })}>Add customer</Button>
      </div>
      <Card className="overflow-hidden">
        {phone ? (
          <MobileList>
            {s.customers.map((c) => {
              const owed = owedBy(c);
              return (
                <MobileRow key={c.id} title={c.name} sub={<>{c.gstin ? `GSTIN ${c.gstin}` : 'Unregistered'}<br />{c.city}, {c.stateName} ({c.state}){c.phone && <><br /><span className="tabular-nums">{c.phone}</span></>}<EditedAt at={c.updatedAt} className="mt-1" /></>}
                  value={owed > 0 ? inr(owed) : '—'} valueClass={owed > 0 ? 'text-warn' : 'text-muted'} valueSub={owed > 0 ? 'outstanding' : `${d.invs.filter((i) => i.custId === c.id).length} invoices`}
                  meta={<TypeBadge type={c.state === seller.state ? 'INTRA' : 'INTER'} />} actions={customerActions(c)} />
              );
            })}
          </MobileList>
        ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead><tr><Th>Customer</Th><Th>GSTIN</Th><Th>State</Th><Th>GST type</Th><Th right>Invoices</Th><Th right>Outstanding</Th><Th right><span className="sr-only">Actions</span></Th></tr></thead>
            <tbody>
              {s.customers.map((c) => {
                const mine = d.invs.filter((i) => i.custId === c.id);
                const owed = r2(mine.reduce((x, i) => x + i.balance, 0));
                return (
                  <tr key={c.id} className="hover:bg-sunken/50">
                    <Td><div className="font-semibold">{c.name}</div><div className="text-xs text-muted">{c.email}</div>{c.phone && <div className="text-xs text-muted tabular-nums">{c.phone}</div>}<EditedAt at={c.updatedAt} /></Td>
                    <Td className="tabular-nums">{c.gstin || <span className="text-muted">Unregistered</span>}</Td>
                    <Td>{c.stateName} <span className="text-muted tabular-nums">({c.state})</span><div className="text-xs text-muted">{c.city}</div></Td>
                    <Td><TypeBadge type={c.state === seller.state ? 'INTRA' : 'INTER'} /></Td>
                    <Td right>{mine.length}</Td>
                    <Td right className={cx('font-semibold', owed > 0 && 'text-warn')}>{owed > 0 ? inr(owed) : '—'}</Td>
                    <Td right><div className="inline-flex gap-0.5">{customerActions(c)}</div></Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        )}
      </Card>
    </div>
  );
}

// ------------------------------------------------------------------ products
export function Products() {
  const { s, a } = useApp();
  const phone = useIsPhone();
  const productActions = (p) => (
    <>
      <IconButton icon="edit" label={`Edit ${p.name}`} onClick={() => a.set({ modal: { type: 'product', data: { ...p } } })} />
      <IconButton icon="trash" tone="danger" label={`Delete ${p.name}`} onClick={() => a.askDeleteProduct(p)} />
    </>
  );
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-sm text-muted">Prices are before GST. Goods use an HSN code and services a SAC code; both print on the invoice.</p>
        <Button variant="primary" icon="plus" onClick={() => a.set({ modal: { type: 'product', data: { name: '', hsn: '', unit: 'Nos', rate: '', gst: 18 } } })}>Add product</Button>
      </div>
      <Card className="overflow-hidden">
        {phone ? (
          <MobileList>
            {s.products.map((p) => (
              <MobileRow key={p.id} title={p.name} sub={<>HSN/SAC {p.hsn} · per {p.unit}{hasAltUnit(p) && <><br />{conversionLabel(p)} · {inr(altRateOf(p))} per {p.altUnit}</>}<EditedAt at={p.updatedAt} className="mt-1" /></>} value={inr(p.rate)} valueSub={`per ${p.unit}, before GST`}
                meta={<span className="rounded-md border border-line bg-sunken px-2 py-0.5 text-xs font-semibold">GST {p.gst}%</span>} actions={productActions(p)} />
            ))}
          </MobileList>
        ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead><tr><Th>Name</Th><Th>HSN/SAC</Th><Th>Unit</Th><Th right>Price</Th><Th right>GST rate</Th><Th right><span className="sr-only">Actions</span></Th></tr></thead>
            <tbody>
              {s.products.map((p) => (
                <tr key={p.id} className="hover:bg-sunken/50">
                  <Td className="font-semibold">{p.name}<EditedAt at={p.updatedAt} /></Td>
                  <Td className="tabular-nums">{p.hsn}</Td>
                  <Td className="text-muted">{p.unit}{hasAltUnit(p) && <div className="text-xs">{conversionLabel(p)}</div>}</Td>
                  <Td right>{inr(p.rate)}<span className="text-xs text-muted"> / {p.unit}</span>{hasAltUnit(p) && <div className="text-xs text-muted">{inr(altRateOf(p))} / {p.altUnit}</div>}</Td>
                  <Td right><span className="rounded-md bg-sunken px-2 py-0.5 text-xs font-semibold">{p.gst}%</span></Td>
                  <Td right><div className="inline-flex gap-0.5">{productActions(p)}</div></Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        )}
      </Card>
    </div>
  );
}

// ------------------------------------------------------------------ expenses
export function Expenses() {
  const { s, a } = useApp();
  const phone = useIsPhone();
  const blank = { date: TODAY, category: EXPENSE_CATEGORIES[0], vendor: '', amount: '', gstRate: 18 };
  const [e, setE] = useState(blank);
  const [editingId, setEditingId] = useState(null); // set when an existing expense is loaded into the form
  const [cat, setCat] = useState('all');
  const [month, setMonth] = useState('all');
  const [q, setQ] = useState('');

  const months = [...new Set(s.expenses.map((x) => x.date.slice(0, 7)))].sort().reverse();
  const inMonth = s.expenses.filter((x) => month === 'all' || x.date.startsWith(month));
  const list = inMonth
    .filter((x) => cat === 'all' || x.category === cat)
    .filter((x) => !q.trim() || x.vendor.toLowerCase().includes(q.trim().toLowerCase()))
    .sort((x, y) => (x.date < y.date ? 1 : -1));
  const listTotal = r2(list.reduce((t, x) => t + x.amount, 0));
  const listGst = r2(list.reduce((t, x) => t + (x.amount * x.gstRate) / 100, 0));
  const filtered = cat !== 'all' || month !== 'all' || q.trim();

  const byCat = EXPENSE_CATEGORIES.map((c) => [c, r2(inMonth.filter((x) => x.category === c).reduce((t, x) => t + x.amount, 0))]).filter(([, v]) => v > 0);
  const periodTotal = r2(byCat.reduce((t, [, v]) => t + v, 0));
  const countIn = (c) => inMonth.filter((x) => c === 'all' || x.category === c).length;
  const save = async () => {
    const ok = editingId ? await a.updateExpense(editingId, e) : await a.addExpense(e);
    if (ok) { setE(blank); setEditingId(null); }
  };
  const startEdit = (x) => {
    setEditingId(x.id);
    setE({ date: x.date, category: x.category, vendor: x.vendor, amount: x.amount, gstRate: x.gstRate });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const cancelEdit = () => { setEditingId(null); setE(blank); };
  const expenseActions = (x) => (
    <>
      <IconButton icon="edit" label={`Edit expense to ${x.vendor}`} onClick={() => startEdit(x)} />
      <IconButton icon="trash" tone="danger" label={`Delete expense to ${x.vendor}`} onClick={() => a.deleteExpense(x.id)} />
    </>
  );

  return (
    <div className="flex flex-col gap-6">
      <Card className={cx('p-5', editingId && 'border-accent')}>
        <SectionHead title={editingId ? 'Edit expense' : 'Add an expense'} sub="Enter the amount before GST. GST you pay on business purchases is input tax credit, which lowers your GST payable." />
        <form className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-[150px_180px_minmax(0,1fr)_140px_110px_auto] lg:items-end"
          onSubmit={(ev) => { ev.preventDefault(); save(); }}>
          <Field label="Date" id="ex-date"><input id="ex-date" type="date" className={inputCls} value={e.date} onChange={(ev) => setE({ ...e, date: ev.target.value })} /></Field>
          <Field label="Category of new expense" id="ex-cat">
            <select id="ex-cat" className={inputCls} value={e.category} onChange={(ev) => setE({ ...e, category: ev.target.value })}>{EXPENSE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
          </Field>
          <Field label="Paid to" id="ex-vendor"><input id="ex-vendor" className={inputCls} placeholder="e.g. Southern Steel Distributors" value={e.vendor} onChange={(ev) => setE({ ...e, vendor: ev.target.value })} /></Field>
          <Field label="Amount (₹)" id="ex-amt"><input id="ex-amt" type="number" min="0" className={cx(inputCls, 'tabular-nums')} value={e.amount} onChange={(ev) => setE({ ...e, amount: ev.target.value })} /></Field>
          <Field label="GST paid" id="ex-gst">
            <select id="ex-gst" className={inputCls} value={e.gstRate} onChange={(ev) => setE({ ...e, gstRate: Number(ev.target.value) })}>{[0, 5, 12, 18, 28].map((r) => <option key={r} value={r}>{r}%</option>)}</select>
          </Field>
          <div className="flex gap-2">
            <Button variant="primary" icon={editingId ? 'check' : 'plus'} onClick={save} className="flex-1">{editingId ? 'Save changes' : 'Add'}</Button>
            {editingId && <Button onClick={cancelEdit}>Cancel</Button>}
          </div>
        </form>
      </Card>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Month" id="flt-month" className="w-full sm:w-44">
              <select id="flt-month" className={inputCls} value={month} onChange={(ev) => setMonth(ev.target.value)}>
                <option value="all">All months</option>
                {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
              </select>
            </Field>
            <Field label="Search paid to" id="flt-q" className="min-w-0 flex-[1_1_200px]">
              <div className="relative">
                <Icon name="search" size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input id="flt-q" type="search" className={cx(inputCls, 'pl-9')} placeholder="e.g. Lakshmi" value={q} onChange={(ev) => setQ(ev.target.value)} />
              </div>
            </Field>
            {filtered && <Button variant="ghost" onClick={() => { setCat('all'); setMonth('all'); setQ(''); }}>Clear filters</Button>}
          </div>
          <div className="scroll-x -mx-4 flex gap-1.5 px-4 sm:mx-0 sm:flex-wrap sm:px-0" role="radiogroup" aria-label="Filter by category">
            {['all', ...EXPENSE_CATEGORIES].map((c) => (
              <button key={c} type="button" role="radio" aria-checked={cat === c} onClick={() => setCat(c)}
                className={cx('h-8 shrink-0 whitespace-nowrap rounded-full border px-3 text-[13px] font-semibold transition-colors cursor-pointer',
                  cat === c ? 'border-accent bg-accent text-accent-ink' : 'border-line bg-surface text-ink hover:border-accent hover:text-accent')}>
                {c === 'all' ? 'All categories' : c}<span className="ml-1.5 tabular-nums opacity-70">{countIn(c)}</span>
              </button>
            ))}
          </div>

          <Card className="min-w-0 overflow-hidden">
            {phone ? (
              <MobileList>
                {list.map((x) => (
                  <MobileRow key={x.id} title={x.vendor} sub={<>{fdate(x.date)}<EditedAt at={x.updatedAt} className="mt-1" /></>} value={inr(x.amount)}
                    valueSub={x.gstRate ? `GST credit ${inr((x.amount * x.gstRate) / 100)}` : 'No GST'}
                    meta={<span className="rounded-md border border-line bg-sunken px-2 py-0.5 text-xs font-semibold">{x.category}</span>}
                    actions={expenseActions(x)} />
                ))}
                {list.length > 0 && (
                  <li className="flex items-center justify-between gap-3 bg-sunken/50 px-4 py-3 text-sm font-semibold">
                    <span>{list.length} expense{list.length > 1 ? 's' : ''}{filtered ? ' shown' : ''}</span>
                    <span className="text-right tabular-nums">{inr(listTotal)}<div className="text-xs font-medium text-muted">GST credit {inr(listGst)}</div></span>
                  </li>
                )}
              </MobileList>
            ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead><tr><Th>Date</Th><Th>Category</Th><Th>Paid to</Th><Th right>Amount</Th><Th right>GST credit</Th><Th right><span className="sr-only">Actions</span></Th></tr></thead>
                <tbody>
                  {list.map((x) => (
                    <tr key={x.id} className="hover:bg-sunken/50">
                      <Td className="text-muted">{fdate(x.date)}</Td>
                      <Td><span className="rounded-md bg-sunken px-2 py-0.5 text-xs font-semibold">{x.category}</span></Td>
                      <Td className="!whitespace-normal">{x.vendor}<EditedAt at={x.updatedAt} /></Td>
                      <Td right className="font-semibold">{inr(x.amount)}</Td>
                      <Td right className="text-muted">{x.gstRate ? `${inr((x.amount * x.gstRate) / 100)} · ${x.gstRate}%` : '—'}</Td>
                      <Td right><div className="inline-flex gap-0.5">{expenseActions(x)}</div></Td>
                    </tr>
                  ))}
                </tbody>
                {list.length > 0 && (
                  <tfoot>
                    <tr className="bg-sunken/50">
                      <Td className="font-semibold" colSpan={3}>{list.length} expense{list.length > 1 ? 's' : ''}{filtered ? ' shown' : ''}</Td>
                      <Td right className="font-semibold">{inr(listTotal)}</Td>
                      <Td right className="font-semibold">{inr(listGst)}</Td>
                      <Td />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
            )}
            {list.length === 0 && <Empty icon="wallet" title="No expenses match these filters" body="Try another month or category, or clear the filters." action={<Button onClick={() => { setCat('all'); setMonth('all'); setQ(''); }}>Clear filters</Button>} />}
          </Card>
        </div>

        <Card className="p-5">
          <SectionHead title={month === 'all' ? 'Spending by category' : `${monthLabel(month)} spending`} sub={`${inr(periodTotal)} before GST · click a category to filter`} />
          <ul className="mt-4 flex flex-col gap-1">
            {byCat.map(([c, v]) => (
              <li key={c}>
                <button type="button" onClick={() => setCat(cat === c ? 'all' : c)} aria-pressed={cat === c}
                  className={cx('w-full rounded-lg px-2 py-2 text-left text-sm transition-colors cursor-pointer', cat === c ? 'bg-accent-soft' : 'hover:bg-sunken')}>
                  <div className="flex justify-between gap-2"><span className={cat === c ? 'font-semibold' : ''}>{c}</span><span className="tabular-nums font-medium">{inr(v)}</span></div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-sunken"><div className="h-full rounded-full bg-saffron" style={{ width: `${periodTotal ? (v / periodTotal) * 100 : 0}%` }} /></div>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
