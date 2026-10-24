import { calcDoc } from './gst.js';
import { r2, todayIST } from './format.js';
import { SELLER } from '../data/seed.js';

const byDateDesc = (a, b) => (a.date === b.date ? (a.no < b.no ? 1 : -1) : a.date < b.date ? 1 : -1);

/** Everything the screens show is computed from the raw records here. */
// Used by the React app AND by the backend (AI assistant), so both always show the same numbers.
export function derive(s) {
  const TODAY = todayIST();
  const sellerState = (s.seller || SELLER).state;
  const calc = (doc) => calcDoc(doc, s.customers, sellerState);

  const cns = s.creditNotes
    .map((cn) => ({ ...cn, ...calc({ custId: cn.custId, override: cn.type, items: [{ ...cn.item, qty: cn.qty, disc: 0 }] }) }))
    .sort(byDateDesc);
  const credits = {};
  cns.forEach((cn) => { credits[cn.invNo] = r2((credits[cn.invNo] || 0) + cn.t.total); });

  const invs = s.invoices
    .map((inv) => {
      const k = calc(inv);
      const credit = credits[inv.no] || 0;
      const open = inv.status !== 'draft' && inv.status !== 'cancelled';
      const paidAmt = inv.status === 'paid' ? Math.max(0, r2(k.t.total - credit)) : Math.min(inv.paid || 0, k.t.total);
      const balance = open ? Math.max(0, r2(k.t.total - paidAmt - credit)) : 0;
      let ds = inv.status;
      if (ds === 'sent' && inv.due && inv.due < TODAY) ds = 'overdue';
      if ((ds === 'sent' || ds === 'overdue' || ds === 'partially_paid') && balance === 0 && credit > 0) ds = 'credited';
      return { ...inv, ...k, credit, paidAmt, balance, ds, live: open, reminded: inv.remindedOn || s.reminders?.[inv.no] || null };
    })
    .sort(byDateDesc);

  const quotes = s.quotes
    .map((q) => {
      const k = calc(q);
      let ds = q.status;
      if ((ds === 'sent' || ds === 'draft') && q.valid < TODAY) ds = 'expired';
      return { ...q, ...k, ds };
    })
    .sort(byDateDesc);

  const live = invs.filter((i) => i.live);
  const keys = [...new Set([...live.map((i) => i.date.slice(0, 7)), ...s.expenses.map((e) => e.date.slice(0, 7))])].sort().slice(-6);
  const months = keys.map((key) => {
    const mi = live.filter((i) => i.date.startsWith(key));
    const mc = cns.filter((c) => c.date.startsWith(key));
    const me = s.expenses.filter((e) => e.date.startsWith(key));
    const sales = r2(mi.reduce((a, i) => a + i.t.taxable, 0));
    const creditTaxable = r2(mc.reduce((a, c) => a + c.t.taxable, 0));
    const netSales = r2(sales - creditTaxable);
    const expenses = r2(me.reduce((a, e) => a + Number(e.amount), 0));
    const outGst = r2(mi.reduce((a, i) => a + i.t.gst, 0) - mc.reduce((a, c) => a + c.t.gst, 0));
    const inGst = r2(me.reduce((a, e) => a + (Number(e.amount) * e.gstRate) / 100, 0));
    return {
      key, invoiceCount: mi.length, sales, creditTaxable, netSales, expenses, profit: r2(netSales - expenses),
      outGst, inGst, gstPayable: r2(outGst - inGst), billed: r2(mi.reduce((a, i) => a + i.t.total, 0)),
    };
  });

  return { invs, quotes, cns, credits, months, calc, byNo: Object.fromEntries(invs.map((i) => [i.no, i])) };
}

export const STATUS = {
  paid: ['Paid', 'bg-ok-soft text-ok'],
  sent: ['Sent', 'bg-info-soft text-info'],
  overdue: ['Overdue', 'bg-warn-soft text-warn'],
  partially_paid: ['Part paid', 'bg-violet-soft text-violet'],
  credited: ['Credited', 'bg-sunken text-muted'],
  draft: ['Draft', 'bg-sunken text-muted'],
  cancelled: ['Cancelled', 'bg-sunken text-muted'],
  accepted: ['Accepted', 'bg-ok-soft text-ok'],
  converted: ['Converted', 'bg-violet-soft text-violet'],
  expired: ['Expired', 'bg-danger-soft text-danger'],
};
