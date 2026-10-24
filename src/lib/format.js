// Formatting helpers (Indian numbering, dates, amount in words)

/** Today's date in India (YYYY-MM-DD), whatever the computer's or server's time zone is. */
export const todayIST = () => new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
export const TODAY = todayIST();

/** The current date and time in India as 'YYYY-MM-DD HH:MM:SS'. Saved as the "created" and "last edited" time of records. */
export const nowIST = () => new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 19).replace('T', ' ');

/** '2026-10-24 19:06:00' -> '24 Oct 2026, 7:06 pm' (times are stored in Indian time) */
export const fdateTime = (s) => {
  if (!s) return '—';
  const [d, t = '00:00'] = String(s).replace('T', ' ').split(' ');
  const [h, m] = t.split(':').map(Number);
  return `${fdate(d)}, ${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
};

export const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

export const inr = (n) =>
  '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const inr0 = (n) => '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN');

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const fdate = (d) => {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${Number(day)} ${MON[Number(m) - 1]} ${y}`;
};

export const monthLabel = (key) => `${MON[Number(key.slice(5)) - 1]} ${key.slice(0, 4)}`;
export const monthShort = (key) => MON[Number(key.slice(5)) - 1];

export const addDays = (d, n) => {
  const t = new Date(d + 'T00:00:00Z');
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
};

export const daysBetween = (a, b) =>
  Math.round((new Date(b + 'T00:00:00Z') - new Date(a + 'T00:00:00Z')) / 86400000);

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve',
  'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
const two = (n) => (n < 20 ? ONES[n] : TENS[Math.floor(n / 10)] + (n % 10 ? ' ' + ONES[n % 10] : ''));
const three = (n) => {
  const h = Math.floor(n / 100), r = n % 100;
  return [h ? `${ONES[h]} Hundred` : '', r ? two(r) : ''].filter(Boolean).join(' ');
};
const conv = (n) => {
  if (n === 0) return 'Zero';
  const p = [];
  const cr = Math.floor(n / 1e7); n %= 1e7;
  const l = Math.floor(n / 1e5); n %= 1e5;
  const t = Math.floor(n / 1000); n %= 1000;
  if (cr) p.push(`${conv(cr)} Crore`);
  if (l) p.push(`${two(l)} Lakh`);
  if (t) p.push(`${two(t)} Thousand`);
  if (n) p.push(three(n));
  return p.join(' ');
};

export function amountInWords(amount) {
  const paise = Math.round((Number(amount) || 0) * 100);
  const rs = Math.floor(paise / 100), ps = paise % 100;
  return `Rupees ${conv(rs)}${ps ? ` and ${two(ps)} Paise` : ''} Only`;
}

/** Build CSV text from rows (array of objects) */
export function toCsv(rows) {
  if (!rows.length) return '';
  const cols = Object.keys(rows[0]);
  const esc = (v) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n');
}
