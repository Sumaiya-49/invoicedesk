import { useApp } from '../store.jsx';
import { Card, Button, IconButton, Field, Segmented, TypeBadge, inputCls, cx } from '../components/ui.jsx';
import { inr, amountInWords } from '../lib/format.js';
import { GST_RATES } from '../lib/gst.js';
import { useIsPhone } from '../lib/effects.js';

/** Create / edit form shared by invoices and quotations. */
export function DocForm() {
  const { s, d, a, seller } = useApp();
  const f = s.form;
  const quote = f.kind === 'quote';
  const k = d.calc(f);
  const intra = k.type === 'INTRA';
  const phone = useIsPhone();

  // Item inputs, shared by the desktop table and the phone cards
  const productField = (l) => (
    <>
      <select id={`it-p-${l.idx}`} aria-label="Product" className={inputCls} value={l.pid || ''} onChange={(e) => a.pickProduct(l.idx, e.target.value)}>
        {!s.products.some((p) => p.id === l.pid) && <option value="">{l.name}</option>}
        {s.products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      <div className="mt-1 text-xs text-muted tabular-nums">HSN/SAC {l.hsn} · per {l.unit}</div>
    </>
  );
  const qtyField = (l, w = '') => <input id={`it-q-${l.idx}`} type="number" min="1" inputMode="decimal" className={cx(inputCls, w, 'text-right tabular-nums')} value={f.items[l.idx].qty} onChange={(e) => a.setItem(l.idx, { qty: e.target.value })} />;
  const rateField = (l, w = '') => <input id={`it-r-${l.idx}`} type="number" min="0" inputMode="decimal" className={cx(inputCls, w, 'text-right tabular-nums')} value={f.items[l.idx].rate} onChange={(e) => a.setItem(l.idx, { rate: e.target.value })} />;
  const discField = (l, w = '') => <input id={`it-d-${l.idx}`} type="number" min="0" max="100" inputMode="decimal" className={cx(inputCls, w, 'text-right tabular-nums')} value={f.items[l.idx].disc} onChange={(e) => a.setItem(l.idx, { disc: e.target.value })} />;
  const gstField = (l, w = '') => (
    <select id={`it-g-${l.idx}`} className={cx(inputCls, w, 'tabular-nums')} value={l.gst} onChange={(e) => a.setItem(l.idx, { gst: Number(e.target.value) })}>
      {GST_RATES.map((r) => <option key={r} value={r}>{r}%</option>)}
    </select>
  );

  return (
    <div className="fx-page grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="flex min-w-0 flex-col gap-6">
        <Card className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Customer" id="f-cust" className="sm:col-span-2">
            <select id="f-cust" className={inputCls} value={f.custId} onChange={(e) => a.setForm({ custId: Number(e.target.value) })}>
              {s.customers.map((c) => <option key={c.id} value={c.id}>{c.name} · {c.stateName}</option>)}
            </select>
          </Field>
          <Field label={quote ? 'Quote date' : 'Invoice date'} id="f-date">
            <input id="f-date" type="date" className={inputCls} value={f.date} onChange={(e) => a.setForm({ date: e.target.value })} />
          </Field>
          <Field label={quote ? 'Valid until' : 'Due date'} id="f-due">
            <input id="f-due" type="date" className={inputCls} value={f.due} onChange={(e) => a.setForm({ due: e.target.value })} />
          </Field>
        </Card>

        <Card className="flex flex-wrap items-center gap-4 p-5">
          <div className="flex min-w-0 flex-[1_1_320px] items-start gap-3">
            <div className={cx('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-display text-sm font-bold', intra ? 'bg-accent-soft text-accent' : 'bg-info-soft text-info')}>{k.c.state}</div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2"><span className="font-semibold">Place of supply: {k.c.stateName}</span><TypeBadge type={k.type} long /></div>
              <p className="mt-1 text-sm text-muted">
                {f.override
                  ? `Set manually. Auto-detect would choose ${k.auto === 'INTRA' ? 'CGST + SGST' : 'IGST'}.`
                  : `You’re in ${seller.stateName} (${seller.state}) and ${k.c.name} is in ${k.c.stateName} (${k.c.state}), so ${intra ? 'the GST rate is split equally into CGST and SGST.' : 'IGST applies at the full rate.'}`}
              </p>
            </div>
          </div>
          <Segmented label="GST type" value={f.override} onChange={(v) => a.setForm({ override: v })}
            options={[[null, 'Auto'], ['INTRA', 'Intra-state'], ['INTER', 'Inter-state']]} />
        </Card>

        <Card className="overflow-hidden">
          {phone ? (
            // Phones: each item is a small card with its fields stacked
            <ul className="flex flex-col divide-y divide-line">
              {k.lines.map((l) => (
                <li key={l.idx} className="flex flex-col gap-3 p-4">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">{productField(l)}</div>
                    <IconButton icon="trash" tone="danger" label={`Remove ${l.name}`} onClick={() => a.removeItem(l.idx)} className="mt-0.5" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Qty" id={`it-q-${l.idx}`}>{qtyField(l)}</Field>
                    <Field label="Rate (₹)" id={`it-r-${l.idx}`}>{rateField(l)}</Field>
                    <Field label="Disc %" id={`it-d-${l.idx}`}>{discField(l)}</Field>
                    <Field label="GST %" id={`it-g-${l.idx}`}>{gstField(l)}</Field>
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-sunken/70 px-3 py-2 text-sm tabular-nums">
                    <span className="text-muted">{intra ? 'CGST + SGST' : 'IGST'} {inr(l.cgst + l.sgst + l.igst)}</span>
                    <span className="font-bold">{inr(l.amount)}</span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold text-muted">
                  <th className="border-b border-line bg-white/[.02] px-4 py-3">Product or service</th>
                  <th className="border-b border-line bg-white/[.02] px-2 py-3 text-right">Qty</th>
                  <th className="border-b border-line bg-white/[.02] px-2 py-3 text-right">Rate (₹)</th>
                  <th className="border-b border-line bg-white/[.02] px-2 py-3 text-right">Disc %</th>
                  <th className="border-b border-line bg-white/[.02] px-2 py-3 text-right">GST %</th>
                  <th className="border-b border-line bg-white/[.02] px-2 py-3 text-right">{intra ? 'CGST + SGST' : 'IGST'}</th>
                  <th className="border-b border-line bg-white/[.02] px-4 py-3 text-right">Amount</th>
                  <th className="border-b border-line bg-white/[.02] px-2 py-3"><span className="sr-only">Remove</span></th>
                </tr>
              </thead>
              <tbody>
                {k.lines.map((l) => (
                  <tr key={l.idx} className="align-top">
                    <td className="min-w-[220px] border-b border-line/70 px-4 py-3">
                      <label htmlFor={`it-p-${l.idx}`} className="sr-only">Product</label>
                      {productField(l)}
                    </td>
                    <td className="border-b border-line/70 px-2 py-3"><label htmlFor={`it-q-${l.idx}`} className="sr-only">Quantity</label>{qtyField(l, 'min-w-20')}</td>
                    <td className="border-b border-line/70 px-2 py-3"><label htmlFor={`it-r-${l.idx}`} className="sr-only">Rate</label>{rateField(l, 'min-w-24')}</td>
                    <td className="border-b border-line/70 px-2 py-3"><label htmlFor={`it-d-${l.idx}`} className="sr-only">Discount percent</label>{discField(l, 'min-w-[72px]')}</td>
                    <td className="border-b border-line/70 px-2 py-3"><label htmlFor={`it-g-${l.idx}`} className="sr-only">GST rate</label>{gstField(l, 'min-w-[84px]')}</td>
                    <td className="border-b border-line/70 px-2 py-3 text-right tabular-nums">
                      <div className="pt-2.5">{inr(l.cgst + l.sgst + l.igst)}</div>
                      <div className="text-xs text-muted">{intra ? `${l.gst / 2}% + ${l.gst / 2}%` : `${l.gst}%`}</div>
                    </td>
                    <td className="border-b border-line/70 px-4 py-3 text-right font-semibold tabular-nums"><div className="pt-2.5">{inr(l.amount)}</div></td>
                    <td className="border-b border-line/70 px-2 py-3"><IconButton icon="trash" tone="danger" label={`Remove ${l.name}`} onClick={() => a.removeItem(l.idx)} className="mt-0.5" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}
          <div className="p-4"><Button size="sm" icon="plus" onClick={a.addItem}>Add item</Button></div>
        </Card>

        <Card className="p-5">
          <Field label="Note on this document" id="f-notes" hint="Shown at the bottom of the PDF.">
            <textarea id="f-notes" rows={2} className={cx(inputCls, 'h-auto py-2')} value={f.notes} onChange={(e) => a.setForm({ notes: e.target.value })} />
          </Field>
        </Card>
      </div>

      <Card className="flex flex-col gap-3 p-5 xl:sticky xl:top-[calc(80px+env(safe-area-inset-top,0px))]">
        <h2 className="font-display text-lg font-semibold">Summary</h2>
        <Line k="Subtotal" v={inr(k.t.subtotal)} />
        {k.t.discount > 0 && <Line k="Discount" v={'− ' + inr(k.t.discount)} />}
        <Line k="Taxable value" v={inr(k.t.taxable)} />
        {intra ? <><Line k="CGST" v={inr(k.t.cgst)} /><Line k="SGST" v={inr(k.t.sgst)} /></> : <Line k="IGST" v={inr(k.t.igst)} />}
        <div className="h-px bg-line" />
        <div className="flex items-baseline justify-between gap-3"><span className="font-semibold">Total</span><span className="font-display text-3xl font-semibold tabular-nums">{inr(k.t.total)}</span></div>
        <p className="text-xs leading-relaxed text-muted">{amountInWords(k.t.total)}</p>
        <div className="mt-2 flex flex-col gap-2">
          <Button variant="primary" onClick={() => a.saveForm('sent')}>{f.editingNo ? 'Save changes' : quote ? 'Save and mark as sent' : 'Save and mark as sent'}</Button>
          <Button onClick={() => a.saveForm('draft')}>Save as draft</Button>
          <Button variant="ghost" onClick={() => a.go(quote ? 'quotes' : 'invoices')}>Cancel</Button>
        </div>
      </Card>
    </div>
  );
}

const Line = ({ k, v }) => <div className="flex justify-between gap-3 text-sm"><span className="text-muted">{k}</span><span className="tabular-nums">{v}</span></div>;
