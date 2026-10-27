import { query, transaction, fromJson } from '../db.js';
import { notFound, badRequest } from '../errors.js';
import { calcDoc } from '../../src/lib/gst.js';
import { r2, todayIST, nowIST } from '../../src/lib/format.js';
import { getCustomer } from './customers.js';

// ------------------------------------------------------------------ helpers

/** INV-0001, INV-0002 ... per business. */
export async function nextNumber(q, table, column, prefix, userId) {
  const rows = await q(`SELECT ${column} AS no FROM ${table} WHERE user_id = ?`, [userId]);
  const max = rows.reduce((m, r) => Math.max(m, Number(String(r.no).split('-')[1]) || 0), 0);
  return `${prefix}-${String(max + 1).padStart(4, '0')}`;
}

export async function sellerState(userId) {
  const [u] = await query('SELECT state_code FROM users WHERE id = ?', [userId]);
  if (!u) throw notFound('Account');
  return u.state_code;
}

const toItem = (r) => ({
  pid: r.product_id, name: r.description, hsn: r.hsn_sac || '', unit: r.unit, rate: Number(r.rate),
  gst: Number(r.gst_rate), qty: Number(r.qty), disc: Number(r.discount_pct),
});

const toInvoice = (r, items, payments) => ({
  no: r.invoice_no, date: r.invoice_date, due: r.due_date, custId: r.customer_id, status: r.status,
  override: r.supply_type_override || null, notes: r.notes || '', paid: Number(r.amount_paid),
  fromQuote: r.from_quote || null, remindedOn: r.last_reminder_on || null, sharedOn: r.shared_on || null,
  createdAt: r.created_at || null, updatedAt: r.updated_at || null,
  items, payments: payments.map((p) => ({ amount: Number(p.amount), method: p.method, date: p.paid_on, recordedAt: p.created_at || null })),
});

// ------------------------------------------------------------------ read

/** All invoices with their items and payments (3 queries, not one per invoice). */
export async function listInvoices(userId) {
  const invoices = await query('SELECT * FROM invoices WHERE user_id = ? ORDER BY invoice_date DESC, invoice_no DESC', [userId]);
  const items = await query(
    'SELECT ii.* FROM invoice_items ii JOIN invoices i ON i.id = ii.invoice_id WHERE i.user_id = ? ORDER BY ii.id', [userId]);
  const payments = await query(
    'SELECT p.* FROM payments p JOIN invoices i ON i.id = p.invoice_id WHERE i.user_id = ? ORDER BY p.paid_on, p.id', [userId]);
  return invoices.map((inv) => toInvoice(
    inv,
    items.filter((it) => it.invoice_id === inv.id).map(toItem),
    payments.filter((p) => p.invoice_id === inv.id)
  ));
}

async function findRow(userId, no) {
  const [row] = await query('SELECT * FROM invoices WHERE user_id = ? AND invoice_no = ?', [userId, String(no).toUpperCase()]);
  if (!row) throw notFound(`Invoice ${no}`);
  return row;
}

export async function getInvoice(userId, no) {
  const row = await findRow(userId, no);
  const items = await query('SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY id', [row.id]);
  const payments = await query('SELECT * FROM payments WHERE invoice_id = ? ORDER BY paid_on, id', [row.id]);
  return toInvoice(row, items.map(toItem), payments);
}

// ------------------------------------------------------------------ write

/** Runs the GST engine for this customer. Same function the React app uses for its live preview. */
export async function calculate(userId, { custId, override, items }) {
  const customer = await getCustomer(userId, custId);
  const k = calcDoc({ custId, override, items }, [customer], await sellerState(userId));
  return { customer, ...k };
}

async function insertLines(q, invoiceId, lines) {
  for (const l of lines) {
    await q(
      `INSERT INTO invoice_items (invoice_id, product_id, description, hsn_sac, unit, qty, rate, discount_pct, gst_rate,
        taxable_value, cgst, sgst, igst, amount) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [invoiceId, l.pid || null, l.name, l.hsn || null, l.unit || 'Nos', l.qty, l.rate, l.disc || 0, l.gst,
        l.taxable, l.cgst, l.sgst, l.igst, l.amount]
    );
  }
}

export async function createInvoice(userId, d, { fromQuote = null } = {}) {
  const k = await calculate(userId, d);
  const no = await transaction(async (q) => {
    const invoiceNo = await nextNumber(q, 'invoices', 'invoice_no', 'INV', userId);
    const r = await q(
      `INSERT INTO invoices (user_id, invoice_no, customer_id, invoice_date, due_date, supply_type, supply_type_override,
        taxable_total, cgst_total, sgst_total, igst_total, grand_total, status, notes, from_quote, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, invoiceNo, d.custId, d.date, d.due || null, k.type, d.override || null, k.t.taxable, k.t.cgst, k.t.sgst,
        k.t.igst, k.t.total, d.status || 'draft', d.notes || null, fromQuote, nowIST()]
    );
    await insertLines(q, r.insertId, k.lines);
    return invoiceNo;
  });
  return getInvoice(userId, no);
}

/** Partial update: only the fields sent are changed. Totals are recalculated whenever items or customer change. */
export async function updateInvoice(userId, no, changes) {
  const row = await findRow(userId, no);
  const current = await getInvoice(userId, no);
  const merged = { ...current, ...changes };
  const recalc = ['items', 'custId', 'override'].some((f) => f in changes);

  if (recalc && Number(row.amount_paid) > 0) {
    throw badRequest(`${row.invoice_no} already has payments, so its items can't change. Use a credit note for returns.`);
  }

  await transaction(async (q) => {
    if (recalc) {
      const k = await calculate(userId, merged);
      await q(
        `UPDATE invoices SET customer_id = ?, supply_type = ?, supply_type_override = ?, taxable_total = ?, cgst_total = ?,
          sgst_total = ?, igst_total = ?, grand_total = ? WHERE id = ?`,
        [merged.custId, k.type, merged.override || null, k.t.taxable, k.t.cgst, k.t.sgst, k.t.igst, k.t.total, row.id]
      );
      await q('DELETE FROM invoice_items WHERE invoice_id = ?', [row.id]);
      await insertLines(q, row.id, k.lines);
    }
    await q('UPDATE invoices SET invoice_date = ?, due_date = ?, status = ?, notes = ?, updated_at = ? WHERE id = ?',
      [merged.date, merged.due || null, merged.status, merged.notes || null, nowIST(), row.id]);
  });
  return getInvoice(userId, no);
}

export async function deleteInvoice(userId, no) {
  const row = await findRow(userId, no);
  await transaction(async (q) => {
    await q('DELETE FROM credit_notes WHERE user_id = ? AND invoice_no = ?', [userId, row.invoice_no]);
    await q('DELETE FROM invoices WHERE id = ?', [row.id]); // items and payments go too (ON DELETE CASCADE)
  });
  return { deleted: true };
}

/** Records money received. The invoice becomes "paid" once payments + credit notes cover the total. */
export async function addPayment(userId, no, p) {
  const row = await findRow(userId, no);
  if (['draft', 'cancelled'].includes(row.status)) throw badRequest(`${row.invoice_no} is ${row.status}. Mark it as sent before recording payments.`);
  const creditTotal = await creditNoteTotal(userId, row.invoice_no);
  const balance = r2(Number(row.grand_total) - Number(row.amount_paid) - creditTotal);
  if (balance <= 0) throw badRequest(`${row.invoice_no} has nothing left to pay.`);
  const amount = r2(Math.min(p.amount, balance));
  const paid = r2(Number(row.amount_paid) + amount);
  const status = paid + creditTotal >= Number(row.grand_total) - 0.005 ? 'paid' : 'partially_paid';

  await transaction(async (q) => {
    const now = nowIST();
    await q('INSERT INTO payments (invoice_id, amount, method, paid_on, created_at) VALUES (?, ?, ?, ?, ?)', [row.id, amount, p.method, p.date, now]);
    await q('UPDATE invoices SET amount_paid = ?, status = ?, updated_at = ? WHERE id = ?', [paid, status, now, row.id]);
  });
  return getInvoice(userId, no);
}

/** Undo payments: removes every payment on the invoice and sets it back to "sent" (unpaid). */
export async function markUnpaid(userId, no) {
  const row = await findRow(userId, no);
  if (!['paid', 'partially_paid'].includes(row.status) && !(Number(row.amount_paid) > 0)) {
    throw badRequest(`${row.invoice_no} has no payments, so it is already unpaid.`);
  }
  await transaction(async (q) => {
    await q('DELETE FROM payments WHERE invoice_id = ?', [row.id]);
    await q('UPDATE invoices SET amount_paid = 0, status = ?, updated_at = ? WHERE id = ?', ['sent', nowIST(), row.id]);
  });
  return getInvoice(userId, no);
}

/** Total of credit notes against an invoice, calculated with the GST engine. */
export async function creditNoteTotal(userId, invoiceNo) {
  const rows = await query('SELECT * FROM credit_notes WHERE user_id = ? AND invoice_no = ?', [userId, invoiceNo]);
  if (!rows.length) return 0;
  let total = 0;
  for (const cn of rows) {
    const item = fromJson(cn.item, {});
    const k = await calculate(userId, { custId: cn.customer_id, override: cn.supply_type, items: [{ ...item, qty: Number(cn.qty), disc: 0 }] });
    total += k.t.total;
  }
  return r2(total);
}

/** Payment reminders. Emails are not sent in this version; the reminder date is recorded. */
export async function markReminded(userId, nos) {
  const today = todayIST();
  for (const no of nos) {
    await query('UPDATE invoices SET last_reminder_on = ? WHERE user_id = ? AND invoice_no = ?', [today, userId, String(no).toUpperCase()]);
  }
  return { reminded: nos.length, date: today };
}
