import { query } from '../db.js';
import { nowIST } from '../../src/lib/format.js';
import { notFound, conflict } from '../errors.js';
import { stateName } from '../../src/data/seed.js';

/** Database row -> the shape the React app uses */
export const toCustomer = (r) => ({
  id: r.id, name: r.name, city: r.city || '', state: r.state_code, stateName: stateName(r.state_code),
  gstin: r.gstin || '', email: r.email || '', phone: r.phone || '',
  createdAt: r.created_at || null, updatedAt: r.updated_at || null,
});

export async function listCustomers(userId) {
  const rows = await query('SELECT * FROM customers WHERE user_id = ? ORDER BY name', [userId]);
  return rows.map(toCustomer);
}

export async function getCustomer(userId, id) {
  const [row] = await query('SELECT * FROM customers WHERE user_id = ? AND id = ?', [userId, id]);
  if (!row) throw notFound('Customer');
  return toCustomer(row);
}

export async function createCustomer(userId, c) {
  const r = await query(
    'INSERT INTO customers (user_id, name, email, phone, gstin, state_code, city, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [userId, c.name, c.email, c.phone, c.gstin, c.state, c.city, nowIST()]
  );
  return getCustomer(userId, r.insertId);
}

export async function updateCustomer(userId, id, c) {
  await getCustomer(userId, id); // 404 if it isn't this user's customer
  await query(
    'UPDATE customers SET name = ?, email = ?, phone = ?, gstin = ?, state_code = ?, city = ?, updated_at = ? WHERE id = ? AND user_id = ?',
    [c.name, c.email, c.phone, c.gstin, c.state, c.city, nowIST(), id, userId]
  );
  return getCustomer(userId, id);
}

export async function deleteCustomer(userId, id) {
  const customer = await getCustomer(userId, id);
  const [{ n }] = await query(
    'SELECT (SELECT COUNT(*) FROM invoices WHERE customer_id = ?) + (SELECT COUNT(*) FROM quotes WHERE customer_id = ?) AS n',
    [id, id]
  );
  if (Number(n) > 0) throw conflict(`${customer.name} has invoices or quotations. Delete those first.`);
  await query('DELETE FROM customers WHERE id = ? AND user_id = ?', [id, userId]);
  return { deleted: true };
}
