// Loading all of a business's data at once, and filling a new account with the sample business.
import { query } from '../db.js';
import { conflict } from '../errors.js';
import { seed } from '../../src/data/seed.js';
import { getUser, toSeller, getSettings } from './users.js';
import { listCustomers, createCustomer } from './customers.js';
import { listProducts, createProduct } from './products.js';
import { listInvoices, createInvoice } from './invoices.js';
import { listQuotes, createQuote } from './quotes.js';
import { listCreditNotes } from './creditNotes.js';
import { listExpenses, createExpense } from './expenses.js';

/** Everything the app needs after login, in one request. */
export async function loadAll(userId) {
  const u = await getUser(userId);
  const [customers, products, invoices, quotes, creditNotes, expenses] = await Promise.all([
    listCustomers(userId), listProducts(userId), listInvoices(userId),
    listQuotes(userId), listCreditNotes(userId), listExpenses(userId),
  ]);
  return {
    seller: toSeller(u),
    settings: getSettings(u),
    customers, products, invoices, quotes, creditNotes, expenses,
  };
}

/**
 * Fills an empty account with the sample business data (customers, products, 3 months of invoices,
 * quotations, credit notes and expenses). Used by `npm run db:setup` and the "Load sample data" button.
 */
export async function loadSampleData(userId) {
  const [{ n }] = await query('SELECT COUNT(*) AS n FROM customers WHERE user_id = ?', [userId]);
  if (Number(n) > 0) throw conflict('Sample data can only be loaded into an empty account.');
  const s = seed();

  // Sample records use ids 1, 2, 3...; the database gives new ids, so keep a map from old to new.
  const custIds = {};
  for (const c of s.customers) custIds[c.id] = (await createCustomer(userId, { ...c, phone: null })).id;
  const prodIds = {};
  for (const p of s.products) prodIds[p.id] = (await createProduct(userId, p)).id;
  const items = (list) => list.map((it) => ({ ...it, pid: prodIds[it.pid] }));

  for (const inv of s.invoices) {
    const created = await createInvoice(userId, {
      custId: custIds[inv.custId], date: inv.date, due: inv.due, status: inv.status === 'draft' ? 'draft' : 'sent',
      override: inv.override, notes: inv.notes, items: items(inv.items),
    }, { fromQuote: inv.fromQuote || null });
    const [row] = await query('SELECT id, grand_total FROM invoices WHERE user_id = ? AND invoice_no = ?', [userId, created.no]);
    // Sample invoices look as if they were created on their invoice date
    await query('UPDATE invoices SET created_at = ? WHERE id = ?', [`${inv.date} 10:30:00`, row.id]);
    const paid = inv.status === 'paid' ? Number(row.grand_total) : inv.paid || 0;
    if (paid > 0) {
      const paidOn = inv.status === 'paid' ? inv.due : '2026-10-01';
      await query('INSERT INTO payments (invoice_id, amount, method, paid_on, created_at) VALUES (?, ?, ?, ?, ?)', [row.id, paid, 'bank', paidOn, `${paidOn} 16:15:00`]);
      await query('UPDATE invoices SET amount_paid = ?, status = ? WHERE id = ?', [paid, inv.status, row.id]);
    }
    if (s.reminders[inv.no]) await query('UPDATE invoices SET last_reminder_on = ? WHERE id = ?', [s.reminders[inv.no], row.id]);
  }

  for (const q of s.quotes) {
    const created = await createQuote(userId, {
      custId: custIds[q.custId], date: q.date, valid: q.valid, status: q.status === 'converted' ? 'sent' : q.status,
      override: q.override, notes: q.notes || null, items: items(q.items),
    });
    await query('UPDATE quotes SET created_at = ? WHERE user_id = ? AND quote_no = ?', [`${q.date} 11:00:00`, userId, created.no]);
    if (q.status === 'converted') {
      await query("UPDATE quotes SET status = 'converted', invoice_no = ? WHERE user_id = ? AND quote_no = ?", [q.invoiceNo, userId, created.no]);
    }
  }

  for (const cn of s.creditNotes) {
    await query(
      `INSERT INTO credit_notes (user_id, cn_no, cn_date, invoice_no, customer_id, supply_type, item, qty, reason, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, cn.no, cn.date, cn.invNo, custIds[cn.custId], cn.type, JSON.stringify({ ...cn.item, pid: prodIds[cn.item.pid] }), cn.qty, cn.reason, `${cn.date} 14:00:00`]
    );
  }

  for (const e of s.expenses) await createExpense(userId, e);
  return { loaded: true };
}
