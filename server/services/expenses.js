// Expenses: money the business spends. Used for profit & loss and input GST credit.
import { query } from '../db.js';
import { nowIST } from '../../src/lib/format.js';
import { notFound } from '../errors.js';

const toExpense = (r) => ({
  id: r.id, date: r.expense_date, category: r.category, vendor: r.vendor, amount: Number(r.amount), gstRate: Number(r.gst_rate),
  createdAt: r.created_at || null, updatedAt: r.updated_at || null,
});

export async function listExpenses(userId) {
  const rows = await query('SELECT * FROM expenses WHERE user_id = ? ORDER BY expense_date DESC, id DESC', [userId]);
  return rows.map(toExpense);
}

export async function createExpense(userId, e) {
  const r = await query(
    'INSERT INTO expenses (user_id, expense_date, category, vendor, amount, gst_rate, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [userId, e.date, e.category, e.vendor, e.amount, e.gstRate, nowIST()]
  );
  const [row] = await query('SELECT * FROM expenses WHERE id = ?', [r.insertId]);
  return toExpense(row);
}

export async function updateExpense(userId, id, e) {
  const r = await query(
    'UPDATE expenses SET expense_date = ?, category = ?, vendor = ?, amount = ?, gst_rate = ?, updated_at = ? WHERE id = ? AND user_id = ?',
    [e.date, e.category, e.vendor, e.amount, e.gstRate, nowIST(), id, userId]
  );
  if (!r.affectedRows) throw notFound('Expense');
  const [row] = await query('SELECT * FROM expenses WHERE id = ?', [id]);
  return toExpense(row);
}

export async function deleteExpense(userId, id) {
  const r = await query('DELETE FROM expenses WHERE id = ? AND user_id = ?', [id, userId]);
  if (!r.affectedRows) throw notFound('Expense');
  return { deleted: true };
}
