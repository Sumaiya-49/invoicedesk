// The page a customer sees when they open the invoice link sent on WhatsApp (/?invoice=<code>).
// No login: it shows only that one invoice, exactly as the business sees it, with a Download PDF button.
import { useEffect, useState } from 'react';
import { Button, Icon, cx } from '../components/ui.jsx';
import { InvoiceDocument } from '../components/InvoiceDocument.jsx';
import { inr, fdate } from '../lib/format.js';
import { downloadInvoicePdf } from '../lib/downloads.js';

// Status in words a customer understands
const STATUS = {
  paid: ['Paid', 'bg-ok-soft text-ok'],
  credited: ['Settled', 'bg-ok-soft text-ok'],
  partially_paid: ['Part paid', 'bg-violet-soft text-violet'],
  overdue: ['Payment overdue', 'bg-warn-soft text-warn'],
  sent: ['Payment due', 'bg-info-soft text-info'],
};

export function SharedInvoice({ code }) {
  const [state, setState] = useState({ loading: true });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/public/invoice/${encodeURIComponent(code)}`)
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(r.status === 404 ? 'missing' : data.error || 'error');
        document.title = `${data.invoice.no} from ${data.seller.name}`;
        setState({ data });
      })
      .catch((err) => setState({ error: err.message }));
  }, [code]);

  if (state.loading) {
    return <Center><span className="typing-dots flex gap-1.5" aria-hidden="true"><i /><i /><i /></span>Loading invoice…</Center>;
  }
  if (state.error) {
    return (
      <Center>
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sunken text-muted"><Icon name="invoice" size={22} /></div>
        <h1 className="font-display text-xl font-semibold text-ink">{state.error === 'missing' ? 'This invoice link isn’t valid' : 'Couldn’t load the invoice'}</h1>
        <p className="max-w-sm text-sm">{state.error === 'missing'
          ? 'The invoice may have been cancelled or replaced. Please ask the business to send you a new link.'
          : 'Please check your internet connection and try again.'}</p>
      </Center>
    );
  }

  const { invoice: inv, seller, settings } = state.data;
  const [label, cls] = (inv.live && STATUS[inv.ds]) || [];
  const download = async () => {
    setSaving(true);
    try { await downloadInvoicePdf(inv, seller, settings); } finally { setSaving(false); }
  };

  return (
    <div className="min-h-screen bg-bg text-ink">
      <header className="border-b border-line bg-surface">
        <div className="gutter mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 py-4">
          <div className="min-w-0">
            <div className="text-xs font-medium text-muted">Invoice from</div>
            <div className="truncate font-display text-lg font-semibold">{seller.name}</div>
          </div>
          <Button variant="primary" icon="download" onClick={download} disabled={saving}>{saving ? 'Preparing…' : 'Download PDF'}</Button>
        </div>
      </header>

      <main className="gutter mx-auto flex max-w-4xl flex-col gap-4 py-6">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-5 py-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-display text-xl font-semibold tabular-nums">{inv.no}</span>
              {label && <span className={cx('rounded-full px-2.5 py-0.5 text-xs font-semibold', cls)}>{label}</span>}
            </div>
            <div className="mt-0.5 text-sm text-muted">Dated {fdate(inv.date)}{inv.due && inv.balance > 0 ? ` · due ${fdate(inv.due)}` : ''}</div>
          </div>
          <div className="text-right">
            <div className="text-xs font-medium text-muted">{inv.live && inv.balance > 0 ? 'Balance due' : 'Invoice total'}</div>
            <div className="font-display text-2xl font-semibold tabular-nums">{inr(inv.live && inv.balance > 0 ? inv.balance : inv.t.total)}</div>
          </div>
        </div>
        <InvoiceDocument inv={inv} seller={seller} settings={settings} />
        <p className="pb-6 text-center text-xs text-muted">Questions about this invoice? Please contact {seller.name} directly.</p>
      </main>
    </div>
  );
}

const Center = ({ children }) => (
  <div className="gutter flex min-h-screen flex-col items-center justify-center gap-3 bg-bg text-center text-muted" role="status">{children}</div>
);
