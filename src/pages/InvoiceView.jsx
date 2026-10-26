import { useApp } from '../store.jsx';
import { Card, Button, StatusPill, Icon, Empty, cx } from '../components/ui.jsx';
import { InvoiceDocument } from '../components/InvoiceDocument.jsx';
import { inr, fdate, fdateTime } from '../lib/format.js';

export function InvoiceView() {
  const { s, d, a, seller } = useApp();
  const inv = d.byNo[s.viewNo];
  if (!inv) return <Card><Empty title="Invoice not found" body="It may have been deleted." action={<Button onClick={() => a.go('invoices')}>Back to invoices</Button>} /></Card>;

  const cns = d.cns.filter((c) => c.invNo === inv.no);
  // Each event has a date, and "at" (exact date and time) when the app recorded it
  const edited = inv.updatedAt && inv.updatedAt !== inv.createdAt;
  const timeline = [
    { date: inv.date, at: inv.createdAt, text: inv.fromQuote ? `Created from ${inv.fromQuote}` : inv.status === 'draft' ? 'Created as draft' : 'Invoice created', icon: inv.fromQuote ? 'convert' : 'invoice' },
    ...(inv.reminded ? [{ date: inv.reminded, text: `Reminder emailed to ${inv.c.email}`, icon: 'bell' }] : []),
    ...cns.map((c) => ({ date: c.date, at: c.createdAt, text: `${c.no}: ${c.reason} (−${inr(c.t.total)})`, icon: 'credit' })),
    ...(inv.payments || []).map((p) => ({ date: p.date, at: p.recordedAt, text: `Payment ${inr(p.amount)} via ${p.method.toUpperCase()}${p.recordedAt && !p.recordedAt.startsWith(p.date) ? ` (paid on ${fdate(p.date)})` : ''}`, icon: 'rupee' })),
    ...(inv.status === 'paid' && !(inv.payments || []).length ? [{ date: inv.due, text: 'Marked as paid', icon: 'check' }] : []),
    ...(edited ? [{ date: inv.updatedAt.slice(0, 10), at: inv.updatedAt, text: 'Last edited', icon: 'edit' }] : []),
  ].sort((x, y) => ((x.at || x.date) < (y.at || y.date) ? -1 : 1));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button size="sm" variant="ghost" icon="arrowLeft" onClick={() => a.go('invoices')}>Invoices</Button>
          <StatusPill status={inv.ds} />
        </div>
        <div className="flex flex-wrap gap-2">
          {inv.status === 'draft' && <Button size="sm" variant="primary" onClick={() => a.markSent(inv.no)}>Mark as sent</Button>}
          {inv.balance > 0 && <Button size="sm" variant="primary" icon="rupee" onClick={() => a.openPayment(inv.no)}>Record payment</Button>}
          {inv.paidAmt > 0 && <Button size="sm" icon="convert" onClick={() => a.askMarkUnpaid(inv.no)}>Mark as unpaid</Button>}
          {inv.balance > 0 && <Button size="sm" icon="bell" onClick={() => a.openReminder([inv.no])}>Send reminder</Button>}
          <Button size="sm" icon="edit" onClick={() => a.editInvoice(inv.no)}>Edit</Button>
          <Button size="sm" icon="copy" onClick={() => a.duplicateInvoice(inv.no)}>Duplicate</Button>
          {inv.live && <Button size="sm" icon="credit" onClick={() => a.go('credits', { cnInvoice: inv.no })}>Credit note</Button>}
          <Button size="sm" icon="download" onClick={() => a.downloadPdf(inv.no)}>PDF</Button>
          <Button size="sm" variant="danger" icon="trash" onClick={() => a.askDeleteInvoice(inv.no)}>Delete</Button>
        </div>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0"><InvoiceDocument inv={inv} seller={seller} settings={s.settings} /></div>
        <div className="flex flex-col gap-4">
          <Card className="p-5">
            <div className="text-[13px] font-medium text-muted">Balance due</div>
            <div className={cx('mt-1 font-display text-3xl font-semibold tabular-nums', inv.ds === 'overdue' && 'text-warn')}>{inr(inv.balance)}</div>
            <div className="mt-3 flex flex-col gap-1.5 text-sm">
              <Row k="Invoice total" v={inr(inv.t.total)} />
              {inv.credit > 0 && <Row k="Credit notes" v={'− ' + inr(inv.credit)} />}
              <Row k="Paid" v={'− ' + inr(inv.paidAmt)} />
              <Row k="Due date" v={fdate(inv.due)} />
            </div>
            <div className="mt-4 flex flex-col gap-1 border-t border-dashed border-line pt-3 text-xs text-muted">
              <div>Created {fdateTime(inv.createdAt)}</div>
              {edited && <div className="font-semibold text-accent">Last edited {fdateTime(inv.updatedAt)}</div>}
            </div>
          </Card>
          <Card className="p-5">
            <h3 className="font-display font-semibold">Activity</h3>
            <ol className="mt-3 flex flex-col gap-3">
              {timeline.map((t, i) => (
                <li key={i} className="flex gap-3 text-sm">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sunken text-muted"><Icon name={t.icon} size={14} /></span>
                  <div className="min-w-0"><div className="text-ink">{t.text}</div><div className="text-xs text-muted">{t.at ? fdateTime(t.at) : fdate(t.date)}</div></div>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>
    </div>
  );
}

const Row = ({ k, v }) => <div className="flex justify-between gap-3"><span className="text-muted">{k}</span><span className="tabular-nums">{v}</span></div>;
