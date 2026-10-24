import { useApp } from '../store.jsx';
import { Card, Button, IconButton, StatusPill, TypeBadge, Segmented, Empty, Th, Td, Icon, MobileList, MobileRow, EditedAt } from '../components/ui.jsx';
import { inr, fdate } from '../lib/format.js';
import { useIsPhone } from '../lib/effects.js';

const FILTERS = {
  all: () => true,
  unpaid: (i) => i.balance > 0,
  overdue: (i) => i.ds === 'overdue',
  paid: (i) => i.ds === 'paid' || i.ds === 'credited',
  draft: (i) => i.ds === 'draft',
};

export function Invoices() {
  const { s, d, a } = useApp();
  const phone = useIsPhone();
  const q = s.invSearch.trim().toLowerCase();
  const rows = d.invs.filter(FILTERS[s.invFilter]).filter((i) => !q || i.no.toLowerCase().includes(q) || i.c.name.toLowerCase().includes(q));

  const actions = (i) => (
    <>
      <IconButton icon="eye" label={`View ${i.no}`} onClick={() => a.viewInvoice(i.no)} />
      <IconButton icon="copy" label={`Duplicate ${i.no}`} onClick={() => a.duplicateInvoice(i.no)} />
      {i.balance > 0 && <IconButton icon="bell" label={`Send reminder for ${i.no}`} onClick={() => a.openReminder([i.no])} />}
      <IconButton icon="trash" tone="danger" label={`Delete ${i.no}`} onClick={() => a.askDeleteInvoice(i.no)} />
    </>
  );

  return (
    <div className="fx-page flex flex-col gap-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <Segmented label="Filter invoices" value={s.invFilter} onChange={(v) => a.set({ invFilter: v })}
          options={[['all', 'All'], ['unpaid', 'Unpaid'], ['overdue', 'Overdue'], ['paid', 'Paid'], ['draft', 'Drafts']].map(([k, l]) => [k, l, d.invs.filter(FILTERS[k]).length])} />
        <div className="flex gap-2">
          <label htmlFor="inv-search" className="relative min-w-0 flex-1 md:hidden">
            <span className="sr-only">Search invoices</span>
            <Icon name="search" size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input id="inv-search" type="search" value={s.invSearch} onChange={(e) => a.set({ invSearch: e.target.value })} placeholder="Search"
              className="fx-input h-10 w-full rounded-full border-[1.5px] border-white/15 bg-transparent pl-9 pr-3 text-sm text-ink focus:outline-none" />
          </label>
          <Button icon="download" onClick={() => a.exportData('invoices', 'csv')}>CSV</Button>
          <Button icon="download" onClick={() => a.exportData('invoices', 'excel')}>Excel</Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        {phone ? (
          <MobileList>
            {rows.map((i) => (
              <MobileRow key={i.no} title={i.no} onOpen={() => a.viewInvoice(i.no)}
                sub={<>{i.c.name} · {i.c.city}<br />Issued {fdate(i.date)} · due {fdate(i.due)}<EditedAt at={i.updatedAt} className="mt-1" /></>}
                value={inr(i.t.total)} valueSub={i.balance > 0 && i.balance < i.t.total ? `${inr(i.balance)} due` : null}
                meta={<><StatusPill status={i.ds} /><TypeBadge type={i.type} /></>} actions={actions(i)} />
            ))}
          </MobileList>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr><Th>Invoice</Th><Th>Customer</Th><Th>Due</Th><Th>GST type</Th><Th right>Taxable</Th><Th right className="hidden 2xl:table-cell">GST</Th><Th right>Total</Th><Th right>Balance</Th><Th>Status</Th><Th right><span className="sr-only">Actions</span></Th></tr>
              </thead>
              <tbody>
                {rows.map((i) => (
                  <tr key={i.no} className="group fx-row">
                    <Td>
                      <button type="button" onClick={() => a.viewInvoice(i.no)} className="font-semibold tabular-nums text-ink hover:text-accent cursor-pointer">{i.no}</button>
                      <div className="text-xs text-muted">{fdate(i.date)}</div>
                      <EditedAt at={i.updatedAt} />
                    </Td>
                    <Td><div className="font-medium">{i.c.name}</div><div className="text-xs text-muted">{i.c.city}</div></Td>
                    <Td className="text-muted">{fdate(i.due)}{i.reminded && <div className="flex items-center gap-1 text-xs"><Icon name="bell" size={11} />{fdate(i.reminded)}</div>}</Td>
                    <Td><TypeBadge type={i.type} /></Td>
                    <Td right>{inr(i.t.taxable)}</Td>
                    <Td right className="hidden text-muted 2xl:table-cell">{inr(i.t.gst)}</Td>
                    <Td right className="font-semibold">{inr(i.t.total)}</Td>
                    <Td right>{i.balance > 0 ? inr(i.balance) : <span className="text-muted">—</span>}</Td>
                    <Td><StatusPill status={i.ds} /></Td>
                    <Td right><div className="inline-flex gap-0.5">{actions(i)}</div></Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {rows.length === 0 && <Empty title="No invoices match" body="Try another filter or clear the search." action={<Button onClick={() => a.set({ invFilter: 'all', invSearch: '' })}>Show all invoices</Button>} />}
      </Card>
    </div>
  );
}

export function Quotes() {
  const { d, a } = useApp();
  const phone = useIsPhone();

  const actions = (q) => (
    <>
      {(q.ds === 'sent' || q.ds === 'accepted') && <Button size="sm" variant="soft" icon="convert" aria-label="Convert to invoice" onClick={() => a.convertQuoteAndOpen(q.no)}>Convert</Button>}
      {q.ds === 'sent' && <Button size="sm" variant="ghost" onClick={() => a.setQuoteStatus(q.no, 'accepted')}>Mark accepted</Button>}
      {q.ds === 'draft' && <Button size="sm" variant="ghost" onClick={() => a.setQuoteStatus(q.no, 'sent')}>Mark sent</Button>}
      {q.ds !== 'converted' && <IconButton icon="edit" label={`Edit ${q.no}`} onClick={() => a.editQuote(q.no)} />}
      <IconButton icon="trash" tone="danger" label={`Delete ${q.no}`} onClick={() => a.askDeleteQuote(q.no)} />
    </>
  );
  const invoiceLink = (q) => q.invoiceNo && <button type="button" onClick={() => a.viewInvoice(q.invoiceNo)} className="text-xs font-semibold text-accent hover:underline cursor-pointer">{q.invoiceNo}</button>;

  return (
    <div className="fx-page flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-sm text-muted">Quotations don’t count as sales or GST until you convert them. Converting copies the items and prices into a new invoice.</p>
        <Button variant="primary" icon="plus" onClick={a.newQuote}>New quotation</Button>
      </div>
      <Card className="overflow-hidden">
        {phone ? (
          <MobileList>
            {d.quotes.map((q) => (
              <MobileRow key={q.no} title={q.no}
                sub={<>{q.c.name} · {q.items.length} item{q.items.length > 1 ? 's' : ''}<br /><span className={q.ds === 'expired' ? 'text-danger' : ''}>Valid until {fdate(q.valid)}</span><EditedAt at={q.updatedAt} className="mt-1" /></>}
                value={inr(q.t.total)} meta={<><StatusPill status={q.ds} /><TypeBadge type={q.type} />{invoiceLink(q)}</>} actions={actions(q)} />
            ))}
          </MobileList>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead><tr><Th>Quotation</Th><Th>Customer</Th><Th>Valid until</Th><Th>GST type</Th><Th right>Total</Th><Th>Status</Th><Th right><span className="sr-only">Actions</span></Th></tr></thead>
              <tbody>
                {d.quotes.map((q) => (
                  <tr key={q.no} className="fx-row">
                    <Td><span className="font-semibold tabular-nums">{q.no}</span><div className="text-xs text-muted">{fdate(q.date)}</div><EditedAt at={q.updatedAt} /></Td>
                    <Td><div className="font-medium">{q.c.name}</div><div className="text-xs text-muted">{q.items.length} item{q.items.length > 1 ? 's' : ''}</div></Td>
                    <Td className={q.ds === 'expired' ? 'text-danger' : 'text-muted'}>{fdate(q.valid)}</Td>
                    <Td><TypeBadge type={q.type} /></Td>
                    <Td right className="font-semibold">{inr(q.t.total)}</Td>
                    <Td><StatusPill status={q.ds} /><span className="ml-2">{invoiceLink(q)}</span></Td>
                    <Td right><div className="inline-flex items-center gap-0.5">{actions(q)}</div></Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {d.quotes.length === 0 && <Empty icon="quote" title="No quotations yet" body="Send a quote first, then convert it to an invoice in one click." action={<Button variant="primary" onClick={a.newQuote}>New quotation</Button>} />}
      </Card>
    </div>
  );
}
