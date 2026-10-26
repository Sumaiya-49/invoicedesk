import { useApp } from '../store.jsx';
import { Card, Button, SectionHead, Segmented, Field, Th, Td, Icon, MobileList, MobileRow, inputCls, cx } from '../components/ui.jsx';
import { useIsPhone } from '../lib/effects.js';
import { InvoiceDocument } from '../components/InvoiceDocument.jsx';
import { inr, monthLabel, r2 } from '../lib/format.js';

// ------------------------------------------------------------------ reports
export function Reports() {
  const { d, a } = useApp();
  const phone = useIsPhone();
  const m = d.months;
  const tot = (k) => r2(m.reduce((s, x) => s + x[k], 0));
  const cols = [...m.map((x) => ({ label: monthLabel(x.key), x })), { label: 'Total', x: Object.fromEntries(['sales', 'creditTaxable', 'netSales', 'expenses', 'profit', 'outGst', 'inGst', 'gstPayable'].map((k) => [k, tot(k)])), total: true }];

  const Row = ({ label, k, neg, strong, sign }) => (
    <tr className={strong ? 'bg-sunken/50' : ''}>
      <Td className={cx(strong ? 'font-semibold' : 'text-muted', 'sticky left-0 bg-surface')}>{label}</Td>
      {cols.map((c) => {
        const v = c.x[k];
        return <Td key={c.label} right className={cx(strong && 'font-semibold', c.total && 'border-l border-line', sign && (v < 0 ? 'text-danger' : 'text-ok'))}>{neg && v ? '− ' : ''}{inr(sign ? v : Math.abs(v))}</Td>;
      })}
    </tr>
  );

  return (
    <div className="flex flex-col gap-6">
      <Card className="min-w-0 overflow-hidden">
        <div className="p-5 pb-3">
          <SectionHead title="Profit and loss" sub="Net sales (before GST, after credit notes) minus expenses (before GST). GST is collected for the government, so it isn’t income.">
            <Button size="sm" icon="download" onClick={() => a.exportData('pnl', 'csv')}>CSV</Button>
            <Button size="sm" icon="download" onClick={() => a.exportData('pnl', 'excel')}>Excel</Button>
          </SectionHead>
        </div>
        {phone ? (
          <MobileList>
            {cols.map((c) => (
              <MobileRow key={c.label} title={c.label} value={`${c.x.profit < 0 ? '− ' : ''}${inr(Math.abs(c.x.profit))}`} valueClass={c.x.profit < 0 ? 'text-danger' : 'text-ok'} valueSub={c.x.profit < 0 ? 'net loss' : 'net profit'}>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-xl bg-sunken/70 px-3 py-2.5 text-xs tabular-nums">
                  <dt className="text-muted">Sales</dt><dd className="text-right">{inr(c.x.sales)}</dd>
                  <dt className="text-muted">Credit notes</dt><dd className="text-right">{c.x.creditTaxable ? '− ' : ''}{inr(c.x.creditTaxable)}</dd>
                  <dt className="font-semibold">Net sales</dt><dd className="text-right font-semibold">{inr(c.x.netSales)}</dd>
                  <dt className="text-muted">Expenses</dt><dd className="text-right">{c.x.expenses ? '− ' : ''}{inr(c.x.expenses)}</dd>
                </dl>
              </MobileRow>
            ))}
          </MobileList>
        ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead><tr><Th className="sticky left-0">&nbsp;</Th>{cols.map((c) => <Th key={c.label} right className={c.total ? 'border-l border-line' : ''}>{c.label}</Th>)}</tr></thead>
            <tbody className="tabular-nums">
              <Row label="Sales (taxable value)" k="sales" />
              <Row label="Less: credit notes" k="creditTaxable" neg />
              <Row label="Net sales" k="netSales" strong />
              <Row label="Less: expenses" k="expenses" neg />
              <Row label="Net profit" k="profit" strong sign />
            </tbody>
          </table>
        </div>
        )}
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="min-w-0 overflow-hidden">
          <div className="p-5 pb-3">
            <SectionHead title="GST summary" sub="What you owe the government each month, GSTR-3B style.">
              <Button size="sm" icon="download" onClick={() => a.exportData('gst', 'csv')}>CSV</Button>
            </SectionHead>
          </div>
          {phone ? (
            <MobileList>
              {m.map((x) => (
                <MobileRow key={x.key} title={monthLabel(x.key)} sub={<>Output GST {inr(x.outGst)}<br />Input credit − {inr(x.inGst)}</>} value={inr(x.gstPayable)} valueClass="text-info" valueSub="net payable" />
              ))}
            </MobileList>
          ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead><tr><Th>Month</Th><Th right>Output GST</Th><Th right>Input credit</Th><Th right>Net payable</Th></tr></thead>
              <tbody className="tabular-nums">
                {m.map((x) => (
                  <tr key={x.key} className="hover:bg-sunken/50"><Td>{monthLabel(x.key)}</Td><Td right>{inr(x.outGst)}</Td><Td right className="text-muted">− {inr(x.inGst)}</Td><Td right className="font-semibold">{inr(x.gstPayable)}</Td></tr>
                ))}
              </tbody>
            </table>
          </div>
          )}
          <p className="p-5 pt-3 text-xs text-muted">Output GST is charged on your sales, net of credit notes. Input credit is GST you paid on business expenses.</p>
        </Card>
        <Card className="p-5">
          <SectionHead title="Exports" sub="Download your data for your CA or for filing." />
          <ul className="mt-4 flex flex-col divide-y divide-line">
            {[['invoices', 'All invoices', 'Every invoice with GSTIN, place of supply and the CGST/SGST/IGST split'], ['gst', 'GST summary', 'Monthly output GST, input credit and net payable'], ['pnl', 'Profit and loss', 'Monthly sales, credit notes, expenses and profit'], ['expenses', 'Expenses', 'All expenses with GST paid']].map(([k, t, sub]) => (
              <li key={k} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0"><div className="font-semibold">{t}</div><div className="text-xs text-muted">{sub}</div></div>
                <div className="flex gap-2"><Button size="sm" onClick={() => a.exportData(k, 'csv')}>CSV</Button><Button size="sm" onClick={() => a.exportData(k, 'excel')}>Excel</Button></div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ invoice template settings
const ACCENTS = [['#0B6E4F', 'Emerald'], ['#3730A3', 'Indigo'], ['#9F1239', 'Maroon'], ['#334155', 'Slate'], ['#B45309', 'Saffron']];

export function Settings() {
  const { s, d, a, seller } = useApp();
  const st = s.settings;
  const sample = d.invs.find((i) => i.type === 'INTER') || d.invs[0];

  const onLogo = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return a.toast('Choose a PNG, JPG or SVG image.', 'error');
    if (file.size > 600 * 1024) return a.toast('Logo must be smaller than 600 KB.', 'error');
    const reader = new FileReader();
    reader.onload = () => { a.updateSettings({ logo: reader.result }); a.toast('Logo updated.'); };
    reader.readAsDataURL(file);
  };

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
      <Card className="flex flex-col gap-5 p-5">
        <SectionHead title="Invoice template" sub="Applies to invoices, quotations and their PDFs." />
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border border-dashed border-line bg-sunken">
            {st.logo ? <img src={st.logo} alt="Your logo" className="h-full w-full object-contain" /> : <Icon name="upload" size={20} className="text-muted" />}
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="logo-file" className="inline-flex h-9 cursor-pointer items-center justify-center rounded-xl border border-line bg-surface px-3 text-[13px] font-semibold text-ink hover:bg-sunken">Upload logo</label>
            <input id="logo-file" type="file" accept="image/*" className="sr-only" onChange={onLogo} />
            {st.logo ? <button type="button" onClick={() => a.updateSettings({ logo: null })} className="text-left text-xs font-semibold text-danger hover:underline cursor-pointer">Remove logo</button> : <span className="text-xs text-muted">PNG, JPG or SVG, up to 600 KB</span>}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-semibold">Brand colour</span>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Brand colour">
            {ACCENTS.map(([hex, name]) => (
              <button key={hex} type="button" role="radio" aria-checked={st.accent === hex} aria-label={name} title={name} onClick={() => a.updateSettings({ accent: hex })}
                className={cx('h-10 w-10 rounded-xl ring-offset-2 ring-offset-surface transition cursor-pointer', st.accent === hex ? 'ring-2 ring-ink' : 'hover:scale-105')} style={{ background: hex }} />
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-semibold">Layout</span>
          <Segmented label="Layout" value={st.layout} onChange={(v) => a.updateSettings({ layout: v })} options={[['modern', 'Modern'], ['classic', 'Classic']]} />
        </div>
        <label className="flex items-center justify-between gap-3 text-sm">
          <span><span className="font-semibold">Show HSN/SAC column</span><span className="block text-xs text-muted">Required on B2B invoices above certain turnover</span></span>
          <input type="checkbox" className="h-5 w-5 accent-[var(--accent)]" checked={st.showHsn} onChange={(e) => a.updateSettings({ showHsn: e.target.checked })} />
        </label>
        <Field label="Default terms" id="set-terms"><textarea id="set-terms" rows={3} className={cx(inputCls, 'h-auto py-2')} value={st.terms} onChange={(e) => a.updateSettings({ terms: e.target.value })} /></Field>
        <Field label="Default note" id="set-notes"><input id="set-notes" className={inputCls} value={st.notes} onChange={(e) => a.updateSettings({ notes: e.target.value })} /></Field>
        <Field label="Bank details" id="set-bank"><input id="set-bank" className={inputCls} value={st.bank} onChange={(e) => a.updateSettings({ bank: e.target.value })} /></Field>
      </Card>
      <div className="flex min-w-0 flex-col gap-2">
        {sample ? <>
          <p className="text-sm text-muted">Live preview using {sample.no}</p>
          <InvoiceDocument inv={sample} seller={seller} settings={st} />
        </> : <Card className="p-6 text-sm text-muted">Create your first invoice to see a preview of the template here.</Card>}
      </div>
    </div>
  );
}
