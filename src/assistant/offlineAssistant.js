// Built-in "simple mode" assistant. It runs in the browser and works by matching keywords.
// It is used when no AI key is configured or the AI services are unavailable, so the chat never breaks.
// Answers come from the same data and calculations as the rest of the app.
// Changes it proposes are saved through the same backend API (see runOfflineAction at the bottom).
import { itemFrom, STATES } from '../data/seed.js';
import { todayIST, addDays, inr, fdate, r2, monthLabel } from '../lib/format.js';
import { api } from '../api.js';

const today = () => todayIST();
const prevMonth = () => {
  const [y, m] = today().split('-').map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
};

// Edit distance between two words, capped: allows 1 typo in short words, 2 in longer ones
function fuzzy(a, b) {
  const limit = b.length > 6 ? 2 : 1;
  if (Math.abs(a.length - b.length) > limit) return false;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length] <= limit;
}

// The current app state and calculated values, set for each message.
const ref = { current: null };
let lastReply = null;
/** Builds the bot's reply: text plus optional table, preview card, "Open" button and source label. */
const reply = (text, extra = {}) => {
  lastReply = { text, ...extra };
  if (extra.card) lastReply.status = 'pending';
  return lastReply;
};

/** Which month(s) a question is about: "august", "last month", "overall". Defaults to the current month. */
const whichMonths = (q) => {
  const t = q.toLowerCase();
  const all = ref.current.d.months.map((m) => m.key);
  const NAMES = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
  if (/\b(overall|total|all time|all months|so far|till now|ever|year)\b/.test(t)) return { keys: all, label: 'all months so far' };
  if (/\blast month|previous month\b/.test(t)) { const k = prevMonth(); return { keys: [k], label: monthLabel(k), missing: !all.includes(k) }; }
  const words = t.split(/[^a-z]+/);
  const idx = NAMES.findIndex((n) => words.some((w) => w === n || (w.length >= 3 && n.startsWith(w)) || (w.length >= 5 && fuzzy(w, n))));
  if (idx >= 0) { const k = `2026-${String(idx + 1).padStart(2, '0')}`; return { keys: [k], label: monthLabel(k), missing: !all.includes(k) }; }
  return { keys: [today().slice(0, 7)], label: monthLabel(today().slice(0, 7)) };
};

const chatAnswers = {
  owe(q) {
    const { s: cur, d: dd } = ref.current;
    const rows = cur.customers
      .map((c) => {
        const open = dd.invs.filter((i) => i.custId === c.id && i.balance > 0);
        return { c, n: open.length, amt: r2(open.reduce((a, i) => a + i.balance, 0)) };
      })
      .filter((x) => x.amt > 0)
      .sort((x, y) => y.amt - x.amt);
    const total = r2(rows.reduce((a, x) => a + x.amt, 0));
    reply(rows.length ? `${rows.length} customer${rows.length > 1 ? 's owe' : ' owes'} you ${inr(total)} in total.` : 'Nobody owes you anything right now.', {
      table: rows.map((x) => [x.c.name, `${x.n} invoice${x.n > 1 ? 's' : ''}`, inr(x.amt)]), source: 'search_invoices',
    });
  },
  gst(q) {
    const { d: dd } = ref.current;
    const period = whichMonths(q);
    if (period.missing) return reply(`I don’t have any records for ${period.label}. Your data covers ${dd.months.map((m) => monthLabel(m.key)).join(', ')}.`);
    const invs = dd.invs.filter((i) => i.live && period.keys.includes(i.date.slice(0, 7)));
    const ms = dd.months.filter((m) => period.keys.includes(m.key));
    const sum = (k) => r2(invs.reduce((a, i) => a + i.t[k], 0));
    const payable = r2(ms.reduce((a, m) => a + m.gstPayable, 0));
    reply(`In ${period.label} you collected ${inr(sum('gst'))} GST on ${invs.length} invoice${invs.length === 1 ? '' : 's'}. After credit notes and input GST on expenses, net GST payable is ${inr(payable)}.`, {
      table: [
        ['CGST', 'intra-state', inr(sum('cgst'))], ['SGST', 'intra-state', inr(sum('sgst'))], ['IGST', 'inter-state', inr(sum('igst'))],
        ...(ms.length > 1 ? ms.map((m) => [monthLabel(m.key), 'net payable', inr(m.gstPayable)]) : []),
      ],
      source: 'get_gst_summary',
    });
  },
  overdue(q) {
    const od = ref.current.d.invs.filter((i) => i.ds === 'overdue');
    reply(od.length ? `${od.length} invoice${od.length > 1 ? 's are' : ' is'} overdue today.` : 'Nothing is overdue right now.', {
      table: od.map((i) => [i.no, i.c.name, inr(i.balance)]), source: 'search_invoices',
    });
  },
  profit(q) {
    const { d: dd } = ref.current;
    const period = whichMonths(q);
    if (period.missing) return reply(`I don’t have any records for ${period.label}. Your data covers ${dd.months.map((m) => monthLabel(m.key)).join(', ')}.`);
    const ms = dd.months.filter((m) => period.keys.includes(m.key));
    const sum = (k) => r2(ms.reduce((a, m) => a + m[k], 0));
    const profit = sum('profit');
    const askedLoss = /\bloss/.test(q.toLowerCase());
    const text = profit >= 0
      ? `${askedLoss ? `There was no loss in ${period.label}. ` : ''}You made a profit of ${inr(profit)} in ${period.label}. GST is excluded because it isn’t your income.`
      : `You made a loss of ${inr(Math.abs(profit))} in ${period.label}. Expenses were higher than net sales.`;
    reply(text, {
      table: [
        ['Net sales', 'after credit notes', inr(sum('netSales'))],
        ['Expenses', 'excl. GST', inr(sum('expenses'))],
        [profit >= 0 ? 'Profit' : 'Loss', '', inr(Math.abs(profit))],
        ...(ms.length > 1 ? ms.map((m) => [monthLabel(m.key), m.profit >= 0 ? 'profit' : 'loss', inr(Math.abs(m.profit))]) : []),
      ],
      source: 'get_profit_loss',
    });
  },
  customers(q) {
    const { s: cur, d: dd } = ref.current;
    reply(`You have ${cur.customers.length} customers:`, {
      table: cur.customers.map((c) => {
        const owed = r2(dd.invs.filter((i) => i.custId === c.id).reduce((a, i) => a + i.balance, 0));
        return [c.name, `${c.stateName} · ${c.state === ref.current.s.seller.state ? 'CGST + SGST' : 'IGST'}`, owed > 0 ? `owes ${inr(owed)}` : 'nothing due'];
      }),
      source: 'search_customers',
    });
  },
  products(q) {
    const { s: cur } = ref.current;
    reply(`You have ${cur.products.length} products and services:`, {
      table: cur.products.map((p) => [p.name, `HSN ${p.hsn} · GST ${p.gst}%`, `${inr(p.rate)}/${p.unit}`]),
      source: 'search_products',
    });
  },
  quotes(q) {
    const open = ref.current.d.quotes.filter((x) => x.ds === 'sent' || x.ds === 'accepted' || x.ds === 'draft');
    reply(open.length ? `${open.length} quotation${open.length > 1 ? 's are' : ' is'} still open, worth ${inr(r2(open.reduce((a, x) => a + x.t.total, 0)))} in total.` : 'There are no open quotations.', {
      table: open.map((x) => [x.no, `${x.c.name} · ${x.ds}`, inr(x.t.total)]), source: 'search_quotes',
    });
  },
  sales(q) {
    const live = ref.current.d.invs.filter((i) => i.live);
    const total = r2(live.reduce((a, i) => a + i.t.total, 0));
    const received = r2(live.reduce((a, i) => a + i.paidAmt, 0));
    reply(`Across ${live.length} invoices (drafts excluded) you’ve billed ${inr(total)} including GST.`, {
      table: [['Billed', 'incl. GST', inr(total)], ['Received', '', inr(received)], ['Still due', '', inr(r2(live.reduce((a, i) => a + i.balance, 0)))]],
      source: 'get_summary',
    });
  },
  invoice(q, no) {
    const i = ref.current.d.byNo[no];
    if (!i) return reply(`I couldn’t find ${no} in your records.`, { source: 'get_invoice' });
    reply(`${no} is for ${i.c.name}, dated ${fdate(i.date)}. It’s ${i.type === 'INTRA' ? 'intra-state (CGST + SGST)' : 'inter-state (IGST)'} and currently ${i.ds.replace('_', ' ')}.`, {
      table: [...i.lines.map((l) => [l.name, `${l.qty} ${l.unit} @ ${inr(l.rate)}`, inr(l.amount)]), ['Total', i.balance > 0 ? `balance ${inr(i.balance)}` : 'nothing due', inr(i.t.total)]],
      openNo: no, source: 'get_invoice',
    });
  },
  customerOwes(q, c) {
    const open = ref.current.d.invs.filter((i) => i.custId === c.id && i.balance > 0);
    const total = r2(open.reduce((a, i) => a + i.balance, 0));
    reply(open.length ? `${c.name} owes you ${inr(total)} across ${open.length} invoice${open.length > 1 ? 's' : ''}.` : `${c.name} has nothing outstanding.`, {
      table: open.map((i) => [i.no, `${i.ds.replace('_', ' ')} · due ${fdate(i.due)}`, inr(i.balance)]), source: 'search_invoices',
    });
  },
  type(q) {
    const i = ref.current.d.byNo['INV-0007'];
    if (!i) return reply('I couldn’t find INV-0007.');
    reply(i.type === 'INTER'
      ? `INV-0007 is inter-state. You’re in ${ref.current.s.seller.stateName} (${ref.current.s.seller.state}) and ${i.c.name} is in ${i.c.stateName} (${i.c.state}), so IGST of ${inr(i.t.igst)} applies.`
      : `INV-0007 is intra-state, so CGST ${inr(i.t.cgst)} and SGST ${inr(i.t.sgst)} apply.`, { source: 'get_invoice' });
  },
};

// ---------------------------------------------------------------- chatbot: understanding the message
// The prototype reads customers, products, quantities, dates and amounts out of the text.
// In the real app an LLM does this and calls the same actions through backend tools.
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const tokens = (t) => t.split(/[^a-z0-9₹.,-]+/).map((w) => w.replace(/[.,]+$/, '')).filter(Boolean);
const num = (w) => {
  const n = Number(String(w).replace(/[₹,]/g, ''));
  return Number.isFinite(n) && /\d/.test(w) && !/[a-z]/.test(w) ? n : null;
};

const findCustomer = (t, words) => ref.current.s.customers.find((c) => {
  const first = c.name.toLowerCase().split(' ')[0];
  return t.includes(c.name.toLowerCase()) || t.includes(first) || words.some((w) => w.length >= 4 && fuzzy(w, first));
});

/** "5 cement bags and 10 steel rods" -> [{ prod, qty: 5 }, { prod, qty: 10 }] */
const findItems = (t) => {
  const words = tokens(t);
  const found = [];
  ref.current.s.products.forEach((p) => {
    const keys = p.name.toLowerCase().split(/\s+/).filter((k) => k.length >= 4 && !/\d/.test(k));
    const idx = words.findIndex((w) => keys.some((k) => w === k || w === k + 's' || (w.length >= 5 && fuzzy(w, k))));
    if (idx === -1) return;
    let qty = null;
    for (let j = idx - 1; j >= Math.max(0, idx - 4) && qty == null; j--) qty = num(words[j]);
    for (let j = idx + 1; j <= Math.min(words.length - 1, idx + 3) && qty == null; j++) if (words[j - 1] === 'x' || words[j - 1] === 'qty' || words[j - 1] === 'quantity') qty = num(words[j]);
    found.push({ prod: p, qty: qty && qty > 0 ? qty : 1, explicit: !!(qty && qty > 0), at: idx });
  });
  return found.sort((x, y) => x.at - y.at);
};

/** "30 nov", "nov 30", "30/11/2026", "2026-11-30", "in 7 days" */
const findDate = (t, base = today()) => {
  let m = t.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return m[0];
  m = t.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{4}))?\b/);
  if (m) return `${m[3] || '2026'}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  m = t.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*/);
  if (m) return `2026-${String(MONTHS.indexOf(m[2]) + 1).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  m = t.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2})\b/);
  if (m) return `2026-${String(MONTHS.indexOf(m[1]) + 1).padStart(2, '0')}-${m[2].padStart(2, '0')}`;
  m = t.match(/(\d+)\s*days?/);
  if (m) return addDays(base, Number(m[1]));
  return null;
};

const findAmount = (t) => {
  const m = t.match(/(?:₹|rs\.?|inr)\s*([\d,]+(?:\.\d+)?)/) || t.match(/\b([\d,]{3,}(?:\.\d+)?)\b(?!\s*(?:days?|-))/);
  return m ? Number(m[1].replace(/,/g, '')) : null;
};

const productList = () => ref.current.s.products.map((p) => [p.name, `GST ${p.gst}%`, `${inr(p.rate)}/${p.unit}`]);
const customerList = () => ref.current.s.customers.map((c) => [c.name, c.stateName, c.state === ref.current.s.seller.state ? 'CGST + SGST' : 'IGST']);

// ---------------------------------------------------------------- chatbot: write actions (preview first, save on Confirm)
const proposals = {
  create(q, kind = 'invoice') {
    const t = q.toLowerCase();
    const words = tokens(t);
    const c = findCustomer(t, words);
    const found = findItems(t);
    const label = kind === 'quote' ? 'quotation' : 'invoice';
    if (!c) return reply(`Which customer is this ${label} for? Mention one of these, e.g. “${label === 'quotation' ? 'Quote' : 'Invoice'} Ravi Traders for 5 cement bags”.`, { table: customerList(), source: 'search_customers' });
    if (!found.length) return reply(`What should I put on the ${label} for ${c.name}? Mention products and quantities, e.g. “10 steel rods and 5 cement bags”.`, { table: productList(), source: 'search_products' });

    const { s: cur, d: dd } = ref.current;
    const items = found.map((f) => itemFrom(f.prod, f.qty));
    const k = dd.calc({ custId: c.id, items });
    const due = findDate(t) || addDays(today(), kind === 'quote' ? 30 : 15);
    const rows = [
      ['Customer', `${k.c.name} · ${k.c.stateName} (${k.c.state})`],
      ['GST type', k.type === 'INTRA' ? 'Intra-state: CGST + SGST' : 'Inter-state: IGST'],
      ...k.lines.map((l) => [`${l.name} × ${l.qty}`, `${inr(l.taxable)} + ${l.gst}% GST`]),
      ['Taxable value', inr(k.t.taxable)],
      ...(k.type === 'INTRA' ? [['CGST', inr(k.t.cgst)], ['SGST', inr(k.t.sgst)]] : [['IGST', inr(k.t.igst)]]),
      [kind === 'quote' ? 'Valid until' : 'Due date', fdate(due)],
      ['Total', inr(k.t.total), true],
    ];
    const doc = { custId: c.id, date: today(), status: 'draft', override: null, notes: cur.settings.notes, items };
    reply(`Here’s the ${label} I’ll create. Nothing is saved until you confirm.`, {
      card: { title: `Create ${label} (draft)`, rows }, status: 'pending', source: 'search_customers · search_products',
      action: kind === 'quote' ? { type: 'createQuote', doc: { ...doc, valid: due } } : { type: 'create', inv: { ...doc, due, paid: 0 } },
    });
  },

  update(q, no) {
    const t = q.toLowerCase();
    const i = ref.current.d.byNo[no];
    if (!i) return reply(`I couldn’t find ${no} in your records.`);
    const changes = {};
    const rows = [['Invoice', `${no} · ${i.c.name}`]];

    if (/\b(due|extend|deadline)\b/.test(t)) {
      const date = findDate(t, /extend/.test(t) ? i.due : today());
      if (!date) return reply(`What should the new due date for ${no} be? For example “change due date of ${no} to 30 Nov” or “extend ${no} by 7 days”.`);
      changes.due = date;
      rows.push(['Due date', `${fdate(i.due)} → ${fdate(date)}`]);
    }
    if (/\b(qty|quantity|quantities|units?)\b/.test(t) || (!changes.due && findItems(t).length)) {
      if (['paid', 'partially_paid'].includes(i.status)) return reply(`${no} already has payments recorded, so I won’t change its items. Issue a credit note for returns, or create a new invoice for extra items.`);
      const found = findItems(t).filter((f) => i.items.some((it) => it.pid === f.prod.id));
      if (!found.length) return reply(`Which item on ${no} should change? It has: ${i.items.map((it) => `${it.name} (${it.qty})`).join(', ')}.`);
      const toQty = Number((t.match(/\bto\s+(\d+)/) || [])[1]) || null;
      found.forEach((f) => { if (!f.explicit && toQty) f.qty = toQty; });
      if (found.some((f) => !f.explicit && !toQty)) return reply(`What should the new quantity be? For example “change quantity of ${found[0].prod.name.toLowerCase()} in ${no} to 25”.`);
      const items = i.items.map((it) => { const f = found.find((x) => x.prod.id === it.pid); return f ? { ...it, qty: f.qty } : it; });
      const k = ref.current.d.calc({ custId: i.custId, override: i.override, items });
      found.forEach((f) => { const old = i.items.find((it) => it.pid === f.prod.id); rows.push([old.name, `${old.qty} → ${f.qty} ${old.unit}`]); });
      rows.push(['Total', `${inr(i.t.total)} → ${inr(k.t.total)}`, true]);
      changes.items = items;
    }
    if (/\bcancel/.test(t)) { changes.status = 'cancelled'; rows.push(['Status', `${i.ds} → cancelled`]); }
    else if (/\b(as sent|to sent|mark sent|mark it sent)\b/.test(t) || /mark .*sent/.test(t)) { changes.status = 'sent'; rows.push(['Status', `${i.ds} → sent`]); }

    if (Object.keys(changes).length === 0) {
      return reply(`What should I change on ${no}? I can update the due date, item quantities or status. For example: “change due date of ${no} to 30 Nov”, “change quantity of steel rods in ${no} to 40”, “mark ${no} as sent”.`);
    }
    reply(`Here are the changes to ${no}. Nothing is saved until you confirm.`, {
      card: { title: `Update ${no}`, rows }, status: 'pending', source: 'get_invoice', action: { type: 'update', no, changes },
    });
  },

  unpaid(no) {
    const i = ref.current.d.byNo[no];
    if (!i) return reply(`${no} isn’t in your records.`);
    if (!(i.paidAmt > 0)) return reply(`${no} has no payments recorded, so it’s already unpaid.`);
    reply(`I’ll mark ${no} as unpaid. Its recorded payments will be removed.`, {
      card: { title: `Mark ${no} as unpaid`, rows: [['Invoice', `${no} · ${i.c.name}`], ['Status', `${i.ds} → unpaid (sent)`], ['Payments removed', inr(i.paidAmt)], ['Balance after', inr(r2(i.t.total - (i.credit || 0))), true]] },
      status: 'pending', source: 'get_invoice', action: { type: 'unpaid', no },
    });
  },

  payment(q, no) {
    const i = ref.current.d.byNo[no];
    if (!i) return reply(`${no} isn’t in your records.`);
    if (i.balance <= 0) return reply(`${no} has no balance due, so there’s nothing to record.`);
    const t = q.toLowerCase();
    const asked = /full|paid in full|fully|mark .*paid|as paid/.test(t) ? null : findAmount(t.replace(/inv-?\s?\d+/g, ''));
    const amount = asked ? Math.min(asked, i.balance) : i.balance;
    const method = ['upi', 'cash', 'cheque', 'card', 'bank'].find((m) => t.includes(m)) || 'upi';
    const after = r2(i.balance - amount);
    reply(asked && asked > i.balance ? `That’s more than the balance, so I’ll record the full balance of ${inr(i.balance)}.` : `I’ll record this payment on ${no}.`, {
      card: { title: 'Record payment', rows: [['Invoice', `${no} · ${i.c.name}`], ['Method', method.toUpperCase()], ['Payment', inr(amount), true], ['Balance after', inr(after)], ['Status after', after <= 0 ? 'Paid' : 'Part paid']] },
      status: 'pending', source: 'get_invoice', action: { type: 'payment', no, amount, method },
    });
  },

  addCustomer(q) {
    const t = q.toLowerCase();
    const gstin = (q.toUpperCase().match(/\b\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]\b/) || [])[0] || '';
    const st = STATES.find(([code, name]) => t.includes(name.toLowerCase())) || (gstin ? STATES.find(([code]) => code === gstin.slice(0, 2)) : null);
    const nameMatch = q.match(/customer\s+(?:named\s+|called\s+)?(.+?)(?:\s+(?:from|in|of|located|based|with|gstin|,)\b|,|$)/i);
    const name = nameMatch ? nameMatch[1].trim().replace(/\b\w/g, (ch) => ch.toUpperCase()) : '';
    if (!name) return reply('What’s the customer’s name? For example: “add customer Sri Balaji Agencies from Karnataka”.');
    if (!st) return reply(`Which state is ${name} in? I need it to decide CGST + SGST or IGST. For example: “add customer ${name} from Karnataka”.`);
    if (gstin && gstin.slice(0, 2) !== st[0]) return reply(`The GSTIN starts with ${gstin.slice(0, 2)}, which doesn’t match ${st[1]} (${st[0]}). Please check it.`);
    const city = (q.match(/\b(?:city|in)\s+([A-Z][a-z]+)/) || [])[1] || '';
    reply(`I’ll add ${name} as a new customer.`, {
      card: { title: 'Add customer', rows: [['Name', name], ['State', `${st[1]} (${st[0]})`], ['GSTIN', gstin || 'Unregistered'], ['GST on invoices', st[0] === ref.current.s.seller.state ? 'CGST + SGST' : 'IGST']] },
      status: 'pending', source: 'create_customer',
      action: { type: 'addCustomer', c: { name, state: st[0], stateName: st[1], gstin, city, email: '' } },
    });
  },

  convert(q, no) {
    const qt = ref.current.d.quotes.find((x) => x.no === no);
    if (!qt) return reply(`I couldn’t find ${no}.`);
    if (qt.ds === 'converted') return reply(`${no} was already converted to ${qt.invoiceNo}.`, { openNo: qt.invoiceNo });
    if (qt.ds === 'expired') return reply(`${no} expired on ${fdate(qt.valid)}. Edit its validity date first if the customer still wants it.`);
    reply(`I’ll turn ${no} into an invoice with the same items and prices.`, {
      card: { title: `Convert ${no} to invoice`, rows: [['Customer', qt.c.name], ['Items', `${qt.items.length} line${qt.items.length > 1 ? 's' : ''}`], ['GST type', qt.type === 'INTRA' ? 'CGST + SGST' : 'IGST'], ['Invoice total', inr(qt.t.total), true]] },
      status: 'pending', source: 'get_quote', action: { type: 'convert', no },
    });
  },

  remind(q, no) {
    const od = no ? [ref.current.d.byNo[no]].filter((i) => i && i.balance > 0) : ref.current.d.invs.filter((i) => i.ds === 'overdue');
    if (!od.length) return reply(no ? `${no} has nothing due, so there’s no reminder to send.` : 'Nothing is overdue, so there’s no one to remind.');
    reply(`I’ll email a payment reminder for ${od.length} invoice${od.length > 1 ? 's' : ''}.`, {
      card: { title: 'Send payment reminders', rows: [...od.map((i) => [`${i.no} · ${i.c.email}`, inr(i.balance)]), ['Total due', inr(r2(od.reduce((a, i) => a + i.balance, 0))), true]] },
      status: 'pending', source: 'search_invoices', action: { type: 'remind', nos: od.map((i) => i.no) },
    });
  },

  del(q, target) {
    if (target.startsWith('QT')) {
      const qt = ref.current.d.quotes.find((x) => x.no === target);
      if (!qt) return reply(`${target} wasn’t found.`);
      return reply(`This permanently deletes ${target}.`, {
        card: { title: `Delete ${target}`, rows: [['Customer', qt.c.name], ['Total', inr(qt.t.total), true]], warning: 'This can’t be undone.' },
        status: 'pending', source: 'get_quote', action: { type: 'deleteQuote', no: target },
      });
    }
    const i = ref.current.d.byNo[target];
    if (!i) return reply(`${target} wasn’t found. It may already be deleted.`);
    reply(`This permanently deletes ${target}.`, {
      card: { title: `Delete ${target}`, rows: [['Customer', i.c.name], ['Status', i.ds], ['Total', inr(i.t.total), true]], warning: i.live ? 'This invoice was already issued. A credit note is usually better than deleting.' : 'This can’t be undone.' },
      status: 'pending', source: 'get_invoice', action: { type: 'delete', no: target },
    });
  },

  deleteCustomer(q, c) {
    const used = ref.current.s.invoices.filter((i) => i.custId === c.id).length;
    if (used) return reply(`${c.name} has ${used} invoice${used > 1 ? 's' : ''}, so I can’t delete them. Delete or reassign those invoices first.`);
    reply(`This removes ${c.name} from your customers.`, {
      card: { title: `Delete ${c.name}`, rows: [['State', c.stateName], ['Invoices', '0']], warning: 'This can’t be undone.' },
      status: 'pending', source: 'search_customers', action: { type: 'deleteCustomer', id: c.id, name: c.name },
    });
  },
};

const READ_SUGGESTIONS = ['How much does Ravi Traders owe me?', 'GST collected in October?', 'What was my profit in October?', 'Show overdue invoices', 'List all customers'];
const WRITE_SUGGESTIONS = ['Invoice Ravi Traders for 5 cement bags and 10 steel rods', 'Change due date of INV-0009 to 30 Nov', 'Record payment of ₹10,000 on INV-0005', 'Add customer Sri Balaji Agencies from Karnataka', 'Change price of PVC Pipe to ₹330', 'Edit the BSNL expense to 1650', 'Convert QT-0003 to an invoice', 'Change invoice template colour to Indigo'];

const handleChat = (q) => {
  const t = q.toLowerCase();
  const write = ref.current.s.chat.mode === 'write';
  const ref_ = (q.toUpperCase().match(/\b(INV|QT)-?\s?\d{1,4}\b/) || [])[0]?.replace(/^(INV|QT)-?\s?(\d+)$/, (_, p, n) => `${p}-${n.padStart(4, '0')}`);
  // Typo-tolerant keyword match: "cutomers" still matches "customer"
  const words = tokens(t);
  const has = (...keys) => keys.some((k) => t.includes(k) || words.some((w) => w.length >= 5 && k.length >= 6 && fuzzy(w, k)));
  const verb = (...keys) => keys.some((k) => words.includes(k) || (k.length >= 6 && words.some((w) => w.length >= 5 && fuzzy(w, k))));

  // ---------- write requests
  const isWrite = verb('create', 'make', 'generate', 'raise', 'prepare', 'bill', 'add', 'new', 'delete', 'remove', 'mark', 'update', 'change', 'edit', 'set', 'extend', 'cancel', 'convert', 'remind', 'record', 'received', 'receive')
    || (/^(invoice|quote|quotation)\b/.test(t) && findItems(t).length > 0);
  if (isWrite) {
    if (!write) return reply('I’m in Read mode, so I can only look things up. Switch to Write mode and I’ll prepare the change for you to confirm.');
    const cust = findCustomer(t, words);
    if (verb('remind')) return proposals.remind(q, ref_ && ref_.startsWith('INV') ? ref_ : null);
    if (verb('convert')) return ref_ && ref_.startsWith('QT') ? proposals.convert(q, ref_) : reply('Which quotation should I convert? For example “convert QT-0003 to an invoice”.');
    if (verb('delete', 'remove')) {
      if (ref_) return proposals.del(q, ref_);
      if (cust && has('customer', 'client')) return proposals.deleteCustomer(q, cust);
      return reply('What should I delete? Give an invoice or quotation number like INV-0011 or QT-0005, or say “delete customer <name>”.');
    }
    if (has('customer', 'client') && verb('add', 'new', 'create')) return proposals.addCustomer(q);
    if (ref_ && ref_.startsWith('INV') && /\b(unpaid|not paid)\b/.test(t) && !has('show', 'list', 'which')) return proposals.unpaid(ref_);
    if (ref_ && ref_.startsWith('INV') && (verb('record', 'received', 'receive') || has('payment') || /\bpaid\b/.test(t))) return proposals.payment(q, ref_);
    if (ref_ && ref_.startsWith('INV')) return proposals.update(q, ref_);
    if (has('quote', 'quotation', 'estimate')) return proposals.create(q, 'quote');
    return proposals.create(q, 'invoice');
  }

  // ---------- read questions
  const cust = findCustomer(t, words);
  if (ref_ && ref_.startsWith('INV')) return chatAnswers.invoice(q, ref_);
  if (ref_ && ref_.startsWith('QT')) return chatAnswers.quotes(q);
  if (cust && has('owe', 'due', 'pending', 'balance', 'outstanding', 'unpaid')) return chatAnswers.customerOwes(q, cust);
  if (has('owe')) return chatAnswers.owe(q);
  if (has('customer', 'customers', 'client', 'clients', 'buyer', 'buyers', 'party', 'parties')) return chatAnswers.customers(q);
  if (has('product', 'products', 'item', 'items', 'service', 'services', 'price', 'hsn', 'stock')) return chatAnswers.products(q);
  if (has('quote', 'quotes', 'quotation', 'quotations', 'estimate', 'estimates')) return chatAnswers.quotes(q);
  if (has('profit', 'loss', 'earning', 'earnings', 'income')) return chatAnswers.profit(q);
  if (has('overdue', 'late', 'delayed')) return chatAnswers.overdue(q);
  if (has('inter', 'intra', 'igst', 'cgst', 'sgst') && !has('collect', 'collected', 'total')) return chatAnswers.type(q);
  if (has('gst', 'tax', 'taxes')) return chatAnswers.gst(q);
  if (has('sales', 'revenue', 'billed', 'total', 'turnover', 'invoices', 'invoice')) return chatAnswers.sales(q);
  if (cust) return chatAnswers.customerOwes(q, cust);
  reply(write
    ? 'I didn’t catch that. In Write mode I can create invoices and quotations, update due dates, quantities and status, record payments, add customers, convert quotes, send reminders and delete records. Try one of the suggestions below.'
    : 'I can’t answer that one in this preview. Try asking about customers, products, quotations, overdue invoices, GST, profit, total sales, what a customer owes, or an invoice number like INV-0008.');
};

// Simple mode (no AI key) only understands these write requests
const SIMPLE_WRITE_SUGGESTIONS = ['Invoice Ravi Traders for 5 cement bags and 10 steel rods', 'Change due date of INV-0009 to 30 Nov', 'Record payment of ₹10,000 on INV-0005', 'Add customer Sri Balaji Agencies from Karnataka', 'Convert QT-0003 to an invoice', 'Delete INV-0011'];
export const SUGGESTIONS = { read: READ_SUGGESTIONS, write: WRITE_SUGGESTIONS, simpleWrite: SIMPLE_WRITE_SUGGESTIONS };

/** Answer one message. s = app state (data + chat mode), d = derived values from derive(). */
export function offlineReply(q, s, d) {
  ref.current = { s, d };
  lastReply = null;
  handleChat(q);
  return lastReply || { text: 'Sorry, I didn’t get that.' };
}

/** Saves a change the user confirmed, through the backend API. Returns the message for the chat. */
export async function runOfflineAction(a) {
  switch (a.type) {
    case 'create': { const inv = await api.post('/invoices', a.inv); return { text: `Done. ${inv.no} is saved as a draft.`, openNo: inv.no }; }
    case 'createQuote': { const q = await api.post('/quotes', a.doc); return { text: `Done. ${q.no} is saved under Quotations.` }; }
    case 'update': await api.put(`/invoices/${a.no}`, a.changes); return { text: `Done. ${a.no} is updated.`, openNo: a.no };
    case 'payment': {
      const inv = await api.post(`/invoices/${a.no}/payments`, { amount: a.amount, method: a.method, date: today() });
      return { text: `Done. ${inr(a.amount)} recorded on ${a.no}. It’s now ${inv.status === 'paid' ? 'paid' : 'part paid'}.`, openNo: a.no };
    }
    case 'addCustomer': { const c = await api.post('/customers', a.c); return { text: `Done. ${c.name} is added.` }; }
    case 'convert': { const inv = await api.post(`/quotes/${a.no}/convert`); return { text: `Done. ${a.no} is now ${inv.no}, marked as sent.`, openNo: inv.no }; }
    case 'remind': await api.post('/invoices/reminders', { nos: a.nos }); return { text: `Done. Reminder recorded for ${a.nos.join(', ')}.` };
    case 'unpaid': await api.post(`/invoices/${a.no}/unpaid`); return { text: `Done. ${a.no} is unpaid again.`, openNo: a.no };
    case 'delete': await api.del(`/invoices/${a.no}`); return { text: `Done. ${a.no} is deleted.` };
    case 'deleteQuote': await api.del(`/quotes/${a.no}`); return { text: `Done. ${a.no} is deleted.` };
    case 'deleteCustomer': await api.del(`/customers/${a.id}`); return { text: `Done. ${a.name} is removed from your customers.` };
    default: throw new Error('Unknown action');
  }
}
