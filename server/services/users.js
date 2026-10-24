// Business accounts: signup, login and the invoice template settings.
import { query, fromJson } from '../db.js';
import { AppError, conflict, notFound } from '../errors.js';
import { hashPassword, checkPassword } from '../auth.js';
import { seed, stateName } from '../../src/data/seed.js';

export const DEFAULT_SETTINGS = seed().settings; // brand colour, layout, terms, notes, bank details

/** The business details printed on invoices ("seller"). */
export const toSeller = (u) => ({
  id: u.id, ownerName: u.owner_name, email: u.email, name: u.business_name, gstin: u.gstin || '',
  state: u.state_code, stateName: stateName(u.state_code), address: u.address || '',
});

export async function getUser(userId) {
  const [u] = await query('SELECT * FROM users WHERE id = ?', [userId]);
  if (!u) throw notFound('Account');
  return u;
}

export async function signup(d) {
  const [existing] = await query('SELECT id FROM users WHERE email = ?', [d.email]);
  if (existing) throw conflict('An account with this email already exists. Log in instead.');
  const r = await query(
    'INSERT INTO users (owner_name, email, password_hash, business_name, gstin, state_code, address, settings) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [d.ownerName, d.email, await hashPassword(d.password), d.businessName, d.gstin, d.state, d.address, JSON.stringify(DEFAULT_SETTINGS)]
  );
  return r.insertId;
}

export async function login({ email, password }) {
  const [u] = await query('SELECT * FROM users WHERE email = ?', [email]);
  // Same message for both cases, so nobody can find out which emails have accounts.
  if (!u || !(await checkPassword(password, u.password_hash))) throw new AppError(401, 'Wrong email or password');
  return u.id;
}

export const getSettings = (u) => ({ ...DEFAULT_SETTINGS, ...fromJson(u.settings, {}) });

export async function updateSettings(userId, patch) {
  const settings = { ...getSettings(await getUser(userId)), ...patch };
  await query('UPDATE users SET settings = ? WHERE id = ?', [JSON.stringify(settings), userId]);
  return settings;
}
