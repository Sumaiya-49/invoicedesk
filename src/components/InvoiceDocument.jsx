import { inr, fdate, amountInWords } from '../lib/format.js';
import { cx } from './ui.jsx';

/**
 * The printable tax invoice. Uses the template settings (accent, layout, logo, terms).
 * The document keeps its own fixed light palette, like paper, so it looks the same in dark mode.
 */
export function InvoiceDocument({ inv, seller, settings, title = 'Tax invoice', dueLabel = 'Due date', compact = false }) {
  const { accent, layout, logo, showHsn, terms, notes, bank } = settings;
  const modern = layout === 'modern';
  const intra = inv.type === 'INTRA';
  const pad = compact ? 'p-5' : 'p-6 sm:p-10';

  const Logo = () => logo
    ? <img src={logo} alt={`${seller.name} logo`} className="h-12 w-auto max-w-[140px] object-contain" />
    : <div className="flex h-12 w-12 items-center justify-center rounded-xl font-display text-lg font-bold"
      style={modern ? { background: '#ffffff', color: accent } : { background: accent, color: '#ffffff' }}>{initials(seller.name)}</div>;

  return (
    <article className="doc overflow-hidden rounded-2xl border border-[#E2E6E2] bg-white text-[#16201B]" aria-label={`${title} ${inv.no}`}>
      <header className={cx('flex flex-wrap items-start justify-between gap-6', pad, modern ? 'text-white' : 'border-b-4')}
        style={modern ? { background: accent } : { borderColor: accent }}>
        <div className="flex items-start gap-4">
          <Logo />
          <div>
            <div className="font-display text-xl font-bold">{seller.name}</div>
            <div className={cx('mt-1 text-[13px] leading-relaxed', modern ? 'text-white/85' : 'text-[#56625B]')}>
              {seller.address}<br />{seller.stateName} · State code {seller.state}<br />
              <span className="tabular-nums">GSTIN {seller.gstin}</span>
            </div>
          </div>
        </div>
        <div className="sm:text-right">
          <div className={cx('text-xs font-bold tracking-[0.14em] uppercase', modern ? 'text-white/85' : '')} style={modern ? undefined : { color: accent }}>{title}</div>
          <div className="mt-1 font-display text-2xl font-bold tabular-nums">{inv.no}</div>
          <div className={cx('mt-1 text-[13px]', modern ? 'text-white/85' : 'text-[#56625B]')}>
            Date {fdate(inv.date)}<br />{dueLabel} {fdate(inv.due || inv.valid)}
          </div>
        </div>
      </header>

      <div className={cx('flex flex-col gap-6', pad)}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl bg-[#F3F6F3] p-4">
            <div className="text-xs font-semibold text-[#56625B]">Bill to</div>
            <div className="mt-1 font-semibold">{inv.c.name}</div>
            <div className="text-[13px] text-[#56625B]">{inv.c.city}, {inv.c.stateName}</div>
            <div className="text-[13px] tabular-nums">GSTIN {inv.c.gstin || 'Unregistered'}</div>
          </div>
          <div className="rounded-xl bg-[#F3F6F3] p-4">
            <div className="text-xs font-semibold text-[#56625B]">Place of supply</div>
            <div className="mt-1 font-semibold">{inv.c.stateName} ({inv.c.state})</div>
            <div className="text-[13px] text-[#56625B]">
              {intra ? 'Intra-state supply: CGST + SGST' : 'Inter-state supply: IGST'}
            </div>
          </div>
        </div>

        {/* Phones: one block per item instead of a wide table */}
        <ul className="flex flex-col divide-y divide-[#EDF0ED] border-y border-[#E2E6E2] text-[13px] tabular-nums sm:hidden">
          {inv.lines.map((l, n) => (
            <li key={n} className="py-3">
              <div className="flex justify-between gap-3">
                <div className="min-w-0 font-medium">{n + 1}. {l.name}</div>
                <div className="font-semibold whitespace-nowrap">{inr(l.amount)}</div>
              </div>
              <div className="mt-1 text-xs leading-relaxed text-[#56625B]">
                {l.qty} {l.unit} × {inr(l.rate)}{l.disc > 0 && ` · ${l.disc}% off`}{showHsn && ` · HSN/SAC ${l.hsn}`}<br />
                Taxable {inr(l.taxable)} · {intra ? `CGST ${inr(l.cgst)} + SGST ${inr(l.sgst)} (${l.gst / 2}% each)` : `IGST ${inr(l.igst)} (${l.gst}%)`}
              </div>
            </li>
          ))}
        </ul>

        <div className="hidden overflow-x-auto sm:block">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="text-left text-xs text-[#56625B]">
                <th className="border-b border-[#E2E6E2] py-2 pr-3 font-semibold">#</th>
                <th className="border-b border-[#E2E6E2] py-2 pr-3 font-semibold">Item</th>
                {showHsn && <th className="border-b border-[#E2E6E2] py-2 pr-3 font-semibold">HSN/SAC</th>}
                <th className="border-b border-[#E2E6E2] py-2 pr-3 text-right font-semibold">Qty</th>
                <th className="border-b border-[#E2E6E2] py-2 pr-3 text-right font-semibold">Rate</th>
                <th className="border-b border-[#E2E6E2] py-2 pr-3 text-right font-semibold">Taxable</th>
                {intra ? <>
                  <th className="border-b border-[#E2E6E2] py-2 pr-3 text-right font-semibold">CGST</th>
                  <th className="border-b border-[#E2E6E2] py-2 pr-3 text-right font-semibold">SGST</th>
                </> : <th className="border-b border-[#E2E6E2] py-2 pr-3 text-right font-semibold">IGST</th>}
                <th className="border-b border-[#E2E6E2] py-2 text-right font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {inv.lines.map((l, n) => (
                <tr key={n} className="align-top">
                  <td className="border-b border-[#EDF0ED] py-2.5 pr-3 text-[#56625B]">{n + 1}</td>
                  <td className="border-b border-[#EDF0ED] py-2.5 pr-3">
                    <div className="font-medium">{l.name}</div>
                    {l.disc > 0 && <div className="text-xs text-[#56625B]">Discount {l.disc}%</div>}
                  </td>
                  {showHsn && <td className="border-b border-[#EDF0ED] py-2.5 pr-3 text-[#56625B]">{l.hsn}</td>}
                  <td className="border-b border-[#EDF0ED] py-2.5 pr-3 text-right whitespace-nowrap">{l.qty} {l.unit}</td>
                  <td className="border-b border-[#EDF0ED] py-2.5 pr-3 text-right whitespace-nowrap">{inr(l.rate)}</td>
                  <td className="border-b border-[#EDF0ED] py-2.5 pr-3 text-right whitespace-nowrap">{inr(l.taxable)}</td>
                  {intra ? <>
                    <td className="border-b border-[#EDF0ED] py-2.5 pr-3 text-right whitespace-nowrap">{inr(l.cgst)}<div className="text-[11px] text-[#56625B]">{l.gst / 2}%</div></td>
                    <td className="border-b border-[#EDF0ED] py-2.5 pr-3 text-right whitespace-nowrap">{inr(l.sgst)}<div className="text-[11px] text-[#56625B]">{l.gst / 2}%</div></td>
                  </> : <td className="border-b border-[#EDF0ED] py-2.5 pr-3 text-right whitespace-nowrap">{inr(l.igst)}<div className="text-[11px] text-[#56625B]">{l.gst}%</div></td>}
                  <td className="border-b border-[#EDF0ED] py-2.5 text-right font-semibold whitespace-nowrap">{inr(l.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-3 text-[13px]">
            <div><div className="text-xs font-semibold text-[#56625B]">Amount in words</div><div className="mt-0.5 font-medium">{amountInWords(inv.t.total)}</div></div>
            <div><div className="text-xs font-semibold text-[#56625B]">Bank details</div><div className="mt-0.5 text-[#56625B]">{bank}</div></div>
            {terms && <div><div className="text-xs font-semibold text-[#56625B]">Terms</div><div className="mt-0.5 text-[#56625B]">{terms}</div></div>}
            {(inv.notes || notes) && <div className="text-[#56625B] italic">{inv.notes || notes}</div>}
          </div>
          <div className="flex w-full max-w-[300px] flex-col gap-1.5 text-[13px] tabular-nums">
            <Row k="Taxable value" v={inr(inv.t.taxable)} />
            {intra ? <><Row k="CGST" v={inr(inv.t.cgst)} /><Row k="SGST" v={inr(inv.t.sgst)} /></> : <Row k="IGST" v={inr(inv.t.igst)} />}
            <div className="my-1 h-px bg-[#E2E6E2]" />
            <div className="flex items-baseline justify-between gap-4"><span className="font-semibold">Grand total</span><span className="font-display text-xl font-bold" style={{ color: accent }}>{inr(inv.t.total)}</span></div>
            {inv.credit > 0 && <Row k="Less credit notes" v={'− ' + inr(inv.credit)} />}
            {inv.paidAmt > 0 && <Row k="Paid" v={'− ' + inr(inv.paidAmt)} />}
            {inv.balance != null && inv.live && <div className="flex justify-between gap-4 font-semibold"><span>Balance due</span><span>{inr(inv.balance)}</span></div>}
          </div>
        </div>

        <div className="flex justify-end border-t border-dashed border-[#D5DBD5] pt-5 text-right text-[13px]">
          <div><div className="font-semibold">For {seller.name}</div><div className="mt-8 text-[#56625B]">Authorised signatory</div></div>
        </div>
      </div>
    </article>
  );
}

const initials = (name = '') => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');

const Row = ({ k, v }) => <div className="flex justify-between gap-4"><span className="text-[#56625B]">{k}</span><span>{v}</span></div>;
