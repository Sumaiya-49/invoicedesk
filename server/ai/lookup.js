// Helpers that turn what the AI passes ("ravi", "steel rod", "Karnataka") into real records.
// If a name matches nothing, or several things, the error message lists the options so the AI can ask the user.
import { STATES } from '../../src/data/seed.js';

const norm = (s) => String(s ?? '').trim().toLowerCase().replace(/[^a-z0-9\s&]/g, ' ').replace(/\s+/g, ' ').trim();

// Words people add that aren't part of the name: "the product pipeline", "customer ravi"
const FILLER = new Set(['the', 'a', 'an', 'product', 'products', 'poduct', 'item', 'service', 'customer', 'custmer', 'client', 'expense', 'expence', 'vendor', 'called', 'named', 'name', 'of', 'for', 'to', 'from', 'my', 'our']);
const keyWords = (s) => norm(s).split(' ').filter((w) => w && !FILLER.has(w));

/** Edit distance: how many letters must change to turn a into b ("pipline" -> "pipeline" = 1). */
function distance(a, b) {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0]; row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cur = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
  }
  return row[b.length];
}
const similar = (a, b) => 1 - distance(a, b) / Math.max(a.length, b.length, 1);

/**
 * How well what the user typed matches a name, from 0 to 1. Forgives typos and partial names:
 * "ravi tradrs" ~ "Ravi Traders", "pipline" ~ "PVC Pipe 4 inch", "kaveri" ~ "Kaveri Steels".
 */
export function matchScore(typed, name) {
  const t = keyWords(typed).join(' '), n = norm(name);
  if (!t || !n) return 0;
  if (t === n) return 1;
  if (n.includes(t) || (t.includes(n) && n.length >= 3)) return 0.92;
  const tw = t.split(' '), nw = n.split(' ').filter((w) => w.length > 1);
  const wordScore = (w) => Math.max(0, ...nw.map((x) => {
    if (x.length >= 3 && w.length >= 3 && (x.startsWith(w) || w.startsWith(x))) return 0.9; // "pipe" ~ "pipeline"
    const k = Math.min(w.length, x.length);
    if (k >= 4 && similar(w.slice(0, k), x.slice(0, k)) >= 0.75) return 0.8; // misspelt start: "pipline" ~ "pipe"
    return similar(w, x);
  }));
  const avg = tw.reduce((s, w) => s + wordScore(w), 0) / tw.length;
  return Math.max(similar(t, n), avg * 0.95);
}

function pick(list, ref, label, nameOf = (x) => x.name) {
  const r = norm(ref);
  if (!r) throw new Error(`Which ${label}? Options: ${list.map(nameOf).join(', ') || 'none yet'}`);
  const byId = list.filter((x) => String(x.id) === String(ref).trim());
  if (byId.length === 1) return byId[0];
  const scored = list.map((x) => ({ x, score: matchScore(ref, nameOf(x)) })).sort((a, b) => b.score - a.score);
  const [best, second] = scored;
  if (best && best.score === 1) return best.x;
  // A clear winner: good enough and clearly better than the next one
  if (best && best.score >= 0.6 && (!second || best.score - second.score >= 0.1)) return best.x;
  const close = scored.filter((s) => s.score >= 0.6 && best.score - s.score < 0.1);
  if (close.length > 1) throw new Error(`"${ref}" could mean more than one ${label}: ${close.map((s) => nameOf(s.x)).join(', ')}. Ask the user which one.`);
  const guesses = scored.filter((s) => s.score >= 0.35).slice(0, 3).map((s) => nameOf(s.x));
  throw new Error(`No ${label} called "${ref}".${guesses.length ? ` Did they mean: ${guesses.join(', ')}?` : ''} Existing ${label}s: ${list.map(nameOf).join(', ') || 'none yet'}.`);
}

/** Keeps the records whose name matches a search, typos allowed. If nothing matches, returns null. */
export function fuzzyFilter(list, search, nameOf = (x) => x.name) {
  if (!norm(search)) return list;
  const hits = list.filter((x) => matchScore(search, nameOf(x)) >= 0.6);
  return hits.length ? hits : null;
}

export const findCustomer = (data, ref) => pick(data.customers, ref, 'customer');
export const findProduct = (data, ref) => pick(data.products, ref, 'product');

/**
 * Finds an expense from what the user said: its id, or who was paid ("BSNL"), optionally with a date or amount.
 * If the same vendor was paid several times, the most recent one is used and `others` says how many more there are.
 */
export function findExpense(data, { expense_id, expense, date, amount }) {
  if (expense_id != null && expense_id !== '') {
    const hit = data.expenses.find((e) => e.id === Number(expense_id));
    if (hit) return { e: hit, others: 0 };
  }
  const r = norm(expense);
  if (!r) throw new Error('Which expense? Say who was paid (for example "BSNL") and, if needed, the date.');
  let list = data.expenses.filter((e) => matchScore(expense, e.vendor) >= 0.6);
  if (!list.length) list = data.expenses.filter((e) => matchScore(expense, e.category) >= 0.75);
  // Narrow down by date / amount when given (ignored if nothing matches them)
  const narrow = (keep) => { const n = list.filter(keep); if (n.length) list = n; };
  if (date) narrow((e) => e.date === date);
  if (amount != null && amount !== '') narrow((e) => Number(e.amount) === Number(amount));
  if (!list.length) throw new Error(`No expense paid to "${expense}". Recent vendors: ${[...new Set(data.expenses.map((e) => e.vendor))].slice(0, 12).join(', ')}.`);
  const vendors = [...new Set(list.map((e) => e.vendor))];
  if (vendors.length > 1) throw new Error(`"${expense}" matches several vendors: ${vendors.join(', ')}. Ask the user which one.`);
  list.sort((a, b) => (a.date < b.date ? 1 : -1));
  return { e: list[0], others: list.length - 1 };
}

export function findState(ref) {
  const r = norm(ref);
  const hit = STATES.find(([code, name]) => code === r.padStart(2, '0') || norm(name) === r)
    || STATES.find(([, name]) => norm(name).includes(r) && r.length >= 3)
    || STATES.map(([code, name]) => [code, name, similar(r, norm(name))]).filter((x) => x[2] >= 0.75).sort((a, b) => b[2] - a[2])[0]; // "karnatka" -> Karnataka
  if (!hit) throw new Error(`Unknown state "${ref}". Use an Indian state name like Karnataka or a 2-digit GST state code.`);
  return { code: hit[0], name: hit[1] };
}

/** "inv 7", "INV7", "inv-0007" -> "INV-0007" */
export function docNo(ref, prefix) {
  const m = String(ref ?? '').toUpperCase().match(/(\d+)/);
  if (!m) throw new Error(`Give a ${prefix === 'INV' ? 'invoice' : 'quotation'} number like ${prefix}-0007`);
  return `${prefix}-${m[1].padStart(4, '0')}`;
}

/** AI item { product, qty, rate?, discount_pct? } -> invoice line in the app's format */
export function toLineItem(data, it) {
  const qty = Number(it.qty);
  if (!(qty > 0)) throw new Error(`Quantity for "${it.product}" must be more than 0`);
  const p = findProduct(data, it.product);
  return {
    pid: p.id, name: p.name, hsn: p.hsn, unit: p.unit,
    rate: it.rate != null ? Number(it.rate) : p.rate, gst: p.gst, qty, disc: Number(it.discount_pct || 0),
  };
}
