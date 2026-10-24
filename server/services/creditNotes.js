// Credit notes: issued when goods are returned or a customer was overcharged.
// They reduce what the customer owes and the GST you have to pay.
import { query, fromJson } from '../db.js';
import { badRequest, notFound } from '../errors.js';
import { nextNumber, getInvoice, calculate } from './invoices.js';
import { todayIST, nowIST } from '../../src/lib/format.js';

const toCreditNote = (r) => ({
  no: r.cn_no, date: r.cn_date, invNo: r.invoice_no, custId: r.customer_id, type: r.supply_type,
  item: fromJson(r.item, {}), qty: Number(r.qty), reason: r.reason, createdAt: r.created_at || null, updatedAt: r.updated_at || null,
});

export async function listCreditNotes(userId) {
  const rows = await query('SELECT * FROM credit_notes WHERE user_id = ? ORDER BY cn_date DESC, cn_no DESC', [userId]);
  return rows.map(toCreditNote);
}

/** A credit note returns part of one invoice line. It can't credit more than was billed. */
export async function createCreditNote(userId, { invNo, idx, qty, reason }) {
  const inv = await getInvoice(userId, invNo);
  if (['draft', 'cancelled'].includes(inv.status)) throw badRequest(`${inv.no} is ${inv.status}, so it can't have a credit note.`);
  const line = inv.items[idx];
  if (!line) throw badRequest('Pick an item from the invoice');
  const earlier = (await listCreditNotes(userId)).filter((c) => c.invNo === inv.no && c.item.name === line.name);
  const max = Number(line.qty) - earlier.reduce((s, c) => s + c.qty, 0);
  if (qty > max) throw badRequest(`You can credit at most ${max} ${line.unit} of ${line.name}.`);

  const { type } = await calculate(userId, inv);
  const no = await nextNumber(query, 'credit_notes', 'cn_no', 'CN', userId);
  await query(
    `INSERT INTO credit_notes (user_id, cn_no, cn_date, invoice_no, customer_id, supply_type, item, qty, reason, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [userId, no, todayIST(), inv.no, inv.custId, type, JSON.stringify(line), qty, reason, nowIST()]
  );
  return (await listCreditNotes(userId)).find((c) => c.no === no);
}

/** Removes a credit note. The invoice's balance and the GST figures go back to what they were before it. */
export async function deleteCreditNote(userId, no) {
  const r = await query('DELETE FROM credit_notes WHERE user_id = ? AND cn_no = ?', [userId, String(no).toUpperCase()]);
  if (!r.affectedRows) throw notFound(`Credit note ${no}`);
  return { deleted: true };
}

/** Changes the quantity and/or reason of a credit note. It still can't credit more than the invoice line had. */
export async function updateCreditNote(userId, no, { qty, reason }) {
  const all = await listCreditNotes(userId);
  const cn = all.find((c) => c.no === String(no).toUpperCase());
  if (!cn) throw notFound(`Credit note ${no}`);
  const inv = await getInvoice(userId, cn.invNo);
  const line = inv.items.find((it) => it.name === cn.item.name);
  const others = all.filter((c) => c.no !== cn.no && c.invNo === cn.invNo && c.item.name === cn.item.name).reduce((s, c) => s + c.qty, 0);
  const newQty = qty ?? cn.qty;
  const max = Number(line?.qty ?? cn.qty) - others;
  if (newQty > max) throw badRequest(`You can credit at most ${max} ${cn.item.unit} of ${cn.item.name}.`);
  await query('UPDATE credit_notes SET qty = ?, reason = ?, updated_at = ? WHERE user_id = ? AND cn_no = ?', [newQty, reason ?? cn.reason, nowIST(), userId, cn.no]);
  return (await listCreditNotes(userId)).find((c) => c.no === cn.no);
}
