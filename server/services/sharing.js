// Sharing an invoice with the customer on WhatsApp.
// Each shared invoice gets a long random code. The customer's link (/?invoice=<code>) shows only that invoice,
// without logging in. Nobody can guess the code, and it stops working if the invoice is deleted.
import { randomBytes } from 'node:crypto';
import { query } from '../db.js';
import { notFound, badRequest } from '../errors.js';
import { nowIST } from '../../src/lib/format.js';
import { derive } from '../../src/lib/derive.js';
import { normalizePhone } from '../../src/lib/whatsapp.js';
import { getInvoice } from './invoices.js';
import { getCustomer } from './customers.js';
import { listCreditNotes } from './creditNotes.js';
import { getUser, toSeller, getSettings } from './users.js';

const CODE = /^[a-f0-9]{32}$/;

/**
 * Called when the user clicks the WhatsApp button (or confirms it in the assistant).
 * Saves a new phone number on the customer if one is given, creates the link code (once) and records the time.
 * Returns what the app needs to open WhatsApp: the code and the customer's phone (null if none is saved).
 */
export async function shareInvoice(userId, no, { phone } = {}) {
  const [row] = await query('SELECT id, invoice_no, customer_id, share_code FROM invoices WHERE user_id = ? AND invoice_no = ?', [userId, String(no).toUpperCase()]);
  if (!row) throw notFound(`Invoice ${no}`);
  const customer = await getCustomer(userId, row.customer_id);

  let number = normalizePhone(customer.phone);
  if (phone) {
    number = normalizePhone(phone);
    if (!number) throw badRequest('That doesn’t look like a valid mobile number. Enter 10 digits, or the full number with country code.');
    await query('UPDATE customers SET phone = ?, updated_at = ? WHERE id = ? AND user_id = ?', [phone.trim(), nowIST(), customer.id, userId]);
  }
  // No number saved: still fine. WhatsApp opens and the user picks the contact there.

  const code = row.share_code || randomBytes(16).toString('hex');
  const sharedOn = nowIST();
  await query('UPDATE invoices SET share_code = ?, shared_on = ? WHERE id = ?', [code, sharedOn, row.id]);
  return { no: row.invoice_no, code, phone: number, customer: customer.name, sharedOn };
}

/**
 * Public: the invoice behind a share code, worked out exactly like in the app (GST, credit notes, payments, balance),
 * with the seller's details and invoice template. Only what the printed invoice shows is returned.
 */
export async function getSharedInvoice(code) {
  if (!CODE.test(String(code))) throw notFound('Invoice');
  const [row] = await query('SELECT user_id, invoice_no FROM invoices WHERE share_code = ?', [code]);
  if (!row) throw notFound('Invoice');
  const userId = row.user_id;
  const [u, inv] = await Promise.all([getUser(userId), getInvoice(userId, row.invoice_no)]);
  const [customer, creditNotes] = await Promise.all([
    getCustomer(userId, inv.custId),
    listCreditNotes(userId).then((list) => list.filter((c) => c.invNo === inv.no)),
  ]);
  const seller = toSeller(u);
  const d = derive({ seller, customers: [customer], invoices: [inv], quotes: [], creditNotes, expenses: [], reminders: {} });
  const x = d.invs[0];
  return {
    seller: { name: seller.name, gstin: seller.gstin, state: seller.state, stateName: seller.stateName, address: seller.address },
    settings: getSettings(u),
    invoice: {
      no: x.no, date: x.date, due: x.due, status: x.status, ds: x.ds, type: x.type, notes: x.notes,
      c: { name: x.c.name, city: x.c.city, state: x.c.state, stateName: x.c.stateName, gstin: x.c.gstin },
      lines: x.lines, t: x.t, credit: x.credit, paidAmt: x.paidAmt, balance: x.balance, live: x.live,
    },
  };
}
