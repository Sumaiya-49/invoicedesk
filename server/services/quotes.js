// Quotations: a price offer sent before the sale. Not counted in sales or GST until converted to an invoice.
import { query, fromJson } from '../db.js';
import { notFound, badRequest, conflict } from '../errors.js';
import { getCustomer } from './customers.js';
import { nextNumber, createInvoice } from './invoices.js';
import { todayIST, addDays, nowIST } from '../../src/lib/format.js';

const toQuote = (r) => ({
  no: r.quote_no, date: r.quote_date, valid: r.valid_until, custId: r.customer_id, status: r.status,
  override: r.supply_type_override || null, items: fromJson(r.items, []), notes: r.notes || '', invoiceNo: r.invoice_no || null,
  createdAt: r.created_at || null, updatedAt: r.updated_at || null,
});

export async function listQuotes(userId) {
  const rows = await query('SELECT * FROM quotes WHERE user_id = ? ORDER BY quote_date DESC, quote_no DESC', [userId]);
  return rows.map(toQuote);
}

export async function getQuote(userId, no) {
  const [row] = await query('SELECT * FROM quotes WHERE user_id = ? AND quote_no = ?', [userId, String(no).toUpperCase()]);
  if (!row) throw notFound(`Quotation ${no}`);
  return toQuote(row);
}

export async function createQuote(userId, d) {
  await getCustomer(userId, d.custId);
  const no = await nextNumber(query, 'quotes', 'quote_no', 'QT', userId);
  await query(
    `INSERT INTO quotes (user_id, quote_no, customer_id, quote_date, valid_until, status, supply_type_override, items, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [userId, no, d.custId, d.date, d.valid, d.status, d.override, JSON.stringify(d.items), d.notes, nowIST()]
  );
  return getQuote(userId, no);
}

export async function updateQuote(userId, no, d) {
  const q = await getQuote(userId, no);
  if (q.status === 'converted') throw badRequest(`${q.no} is already converted to ${q.invoiceNo}.`);
  await getCustomer(userId, d.custId);
  await query(
    `UPDATE quotes SET customer_id = ?, quote_date = ?, valid_until = ?, status = ?, supply_type_override = ?, items = ?, notes = ?, updated_at = ?
     WHERE user_id = ? AND quote_no = ?`,
    [d.custId, d.date, d.valid, d.status, d.override, JSON.stringify(d.items), d.notes, nowIST(), userId, q.no]
  );
  return getQuote(userId, no);
}

export async function setQuoteStatus(userId, no, status) {
  const q = await getQuote(userId, no);
  if (q.status === 'converted') throw badRequest(`${q.no} is already converted.`);
  await query('UPDATE quotes SET status = ?, updated_at = ? WHERE user_id = ? AND quote_no = ?', [status, nowIST(), userId, q.no]);
  return getQuote(userId, no);
}

export async function deleteQuote(userId, no) {
  const q = await getQuote(userId, no);
  await query('DELETE FROM quotes WHERE user_id = ? AND quote_no = ?', [userId, q.no]);
  return { deleted: true };
}

/** Copies the quotation's items and prices into a new invoice (status: sent, due in 15 days). */
export async function convertQuote(userId, no) {
  const q = await getQuote(userId, no);
  if (q.status === 'converted') throw conflict(`${q.no} was already converted to ${q.invoiceNo}.`);
  const today = todayIST();
  const inv = await createInvoice(userId, {
    custId: q.custId, date: today, due: addDays(today, 15), status: 'sent', override: q.override, notes: q.notes, items: q.items,
  }, { fromQuote: q.no });
  await query("UPDATE quotes SET status = 'converted', invoice_no = ?, updated_at = ? WHERE user_id = ? AND quote_no = ?", [inv.no, nowIST(), userId, q.no]);
  return inv;
}
