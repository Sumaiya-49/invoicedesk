// WhatsApp sharing helpers, used by the React app (and the phone check also by the backend).
// We use WhatsApp's free "click to chat" link (wa.me): it opens WhatsApp with the customer's chat
// and the message already typed. The user just presses Send.
import { inr, fdate } from './format.js';

/**
 * Turns what the user typed into the number format WhatsApp needs: country code + number, digits only.
 * "98400 12345", "+91 98400-12345", "098400 12345" -> "919840012345". Returns null if it doesn't look valid.
 */
export function normalizePhone(raw) {
  let d = String(raw || '').replace(/\D/g, '');
  if (d.length === 11 && d.startsWith('0')) d = d.slice(1);      // 0 + 10 digits (STD style)
  if (d.length === 10) d = `91${d}`;                               // Indian mobile without country code
  return d.length >= 11 && d.length <= 15 ? d : null;
}

/** Link the customer opens to see the invoice and download the PDF (no login needed). */
export const shareLink = (origin, code) => `${origin}/?invoice=${code}`;

/** The message that is typed in WhatsApp for the customer. */
export function shareMessage(inv, seller, link) {
  const partPaid = inv.balance > 0 && inv.balance < inv.t.total;
  const lines = [
    `Hello ${inv.c.name},`,
    '',
    `Please find your invoice ${inv.no} from ${seller.name}.`,
    `Invoice date: ${fdate(inv.date)}`,
    partPaid ? `Invoice total: ${inr(inv.t.total)}\nBalance due: ${inr(inv.balance)}` : `Amount: ${inr(inv.t.total)}`,
  ];
  const settled = inv.live && inv.balance === 0;
  if (inv.due && !settled) lines.push(`Due date: ${fdate(inv.due)}`);
  if (settled) lines.push('Status: Paid in full.');
  lines.push('', `View / download PDF: ${link}`, '', 'Thank you!', seller.name);
  return lines.join('\n');
}

/**
 * wa.me link that opens WhatsApp with the message typed in.
 * With a number it opens that customer's chat; without one, WhatsApp lets you pick the contact.
 */
export const whatsappUrl = (phone, text) => `https://wa.me/${phone || ''}?text=${encodeURIComponent(text)}`;
