import { query } from '../db.js';
import { nowIST } from '../../src/lib/format.js';
import { notFound } from '../errors.js';

export const toProduct = (r) => ({
  id: r.id, name: r.name, hsn: r.hsn_sac || '', unit: r.unit, rate: Number(r.price), gst: Number(r.gst_rate),
  // Optional smaller unit: 1 <unit> = altPer <altUnit>; altRate null = worked out as price ÷ altPer
  altUnit: r.alt_unit || null, altPer: r.alt_per_main != null ? Number(r.alt_per_main) : null,
  altRate: r.alt_rate != null ? Number(r.alt_rate) : null,
  createdAt: r.created_at || null, updatedAt: r.updated_at || null,
});

export async function listProducts(userId) {
  const rows = await query('SELECT * FROM products WHERE user_id = ? ORDER BY name', [userId]);
  return rows.map(toProduct);
}

export async function getProduct(userId, id) {
  const [row] = await query('SELECT * FROM products WHERE user_id = ? AND id = ?', [userId, id]);
  if (!row) throw notFound('Product');
  return toProduct(row);
}

export async function createProduct(userId, p) {
  const r = await query(
    'INSERT INTO products (user_id, name, hsn_sac, unit, price, gst_rate, alt_unit, alt_per_main, alt_rate, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [userId, p.name, p.hsn, p.unit, p.rate, p.gst, p.altUnit ?? null, p.altPer ?? null, p.altRate ?? null, nowIST()]
  );
  return getProduct(userId, r.insertId);
}

export async function updateProduct(userId, id, p) {
  await getProduct(userId, id);
  await query(
    'UPDATE products SET name = ?, hsn_sac = ?, unit = ?, price = ?, gst_rate = ?, alt_unit = ?, alt_per_main = ?, alt_rate = ?, updated_at = ? WHERE id = ? AND user_id = ?',
    [p.name, p.hsn, p.unit, p.rate, p.gst, p.altUnit ?? null, p.altPer ?? null, p.altRate ?? null, nowIST(), id, userId]
  );
  return getProduct(userId, id);
}

/** Old invoices keep their own copy of the item, so deleting a product never changes them. */
export async function deleteProduct(userId, id) {
  await getProduct(userId, id);
  await query('DELETE FROM products WHERE id = ? AND user_id = ?', [id, userId]);
  return { deleted: true };
}
