// Sample data for the demo. In the real app this comes from MySQL via the API.

export const STATES = [
  ['01', 'Jammu and Kashmir'], ['02', 'Himachal Pradesh'], ['03', 'Punjab'], ['04', 'Chandigarh'], ['05', 'Uttarakhand'],
  ['06', 'Haryana'], ['07', 'Delhi'], ['08', 'Rajasthan'], ['09', 'Uttar Pradesh'], ['10', 'Bihar'], ['18', 'Assam'],
  ['19', 'West Bengal'], ['20', 'Jharkhand'], ['21', 'Odisha'], ['22', 'Chhattisgarh'], ['23', 'Madhya Pradesh'],
  ['24', 'Gujarat'], ['27', 'Maharashtra'], ['29', 'Karnataka'], ['30', 'Goa'], ['32', 'Kerala'], ['33', 'Tamil Nadu'],
  ['34', 'Puducherry'], ['36', 'Telangana'], ['37', 'Andhra Pradesh'],
];
export const stateName = (code) => (STATES.find((s) => s[0] === code) || [code, code])[1];

export const SELLER = {
  name: 'Sumaiya Traders',
  gstin: '33AAACS1111A1Z3',
  state: '33',
  stateName: 'Tamil Nadu',
  address: '14, Anna Salai, Chennai 600002',
  email: 'accounts@sumaiyatraders.in',
};

export const EXPENSE_CATEGORIES = ['Stock purchase', 'Rent', 'Salaries', 'Electricity', 'Transport', 'Internet & phone', 'Other'];

const customers = [
  { id: 1, name: 'Ravi Traders', city: 'Chennai', state: '33', stateName: 'Tamil Nadu', gstin: '33AABCR1234K1Z5', email: 'accounts@ravitraders.in' },
  { id: 2, name: 'Kaveri Steels', city: 'Bengaluru', state: '29', stateName: 'Karnataka', gstin: '29AAECK5678L1Z2', email: 'billing@kaveristeels.in' },
  { id: 3, name: 'Malabar Hardware', city: 'Kochi', state: '32', stateName: 'Kerala', gstin: '32AAFCM4321P1Z9', email: 'office@malabarhardware.in' },
  { id: 4, name: 'Deccan Builders', city: 'Hyderabad', state: '36', stateName: 'Telangana', gstin: '36AAGCD8765Q1Z1', email: 'finance@deccanbuilders.in' },
  { id: 5, name: 'Annai Stores', city: 'Madurai', state: '33', stateName: 'Tamil Nadu', gstin: '33AAHCA2468R1Z7', email: 'annaistores@annai.in' },
];

const products = [
  { id: 1, name: 'Steel Rod 12mm', hsn: '7214', unit: 'Nos', rate: 650, gst: 18 },
  { id: 2, name: 'Cement 50kg Bag', hsn: '2523', unit: 'Bag', rate: 420, gst: 28 },
  { id: 3, name: 'PVC Pipe 4 inch', hsn: '3917', unit: 'Nos', rate: 310, gst: 18 },
  { id: 4, name: 'Exterior Paint 20L', hsn: '3208', unit: 'Can', rate: 3800, gst: 18 },
  { id: 5, name: 'Installation Service', hsn: '9954', unit: 'Hrs', rate: 1500, gst: 18 },
  { id: 6, name: 'Wall Putty 40kg', hsn: '3214', unit: 'Bag', rate: 900, gst: 18 },
];

/** Line items keep a snapshot of the product, like invoice_items in the database. */
export const itemFrom = (p, qty = 1, disc = 0) => ({ pid: p.id, name: p.name, hsn: p.hsn, unit: p.unit, rate: p.rate, gst: p.gst, qty, disc });
const items = (rows) => rows.map(([pid, qty, disc]) => itemFrom(products.find((p) => p.id === pid), qty, disc || 0));

const inv = (no, date, due, custId, status, rows, paid = 0, extra = {}) => ({
  no, date, due, custId, status, items: items(rows), paid, override: null, notes: '', ...extra,
});
const quote = (no, date, valid, custId, status, rows, extra = {}) => ({
  no, date, valid, custId, status, items: items(rows), override: null, notes: '', ...extra,
});

export function seed() {
  return {
    customers,
    products,
    invoices: [
      inv('INV-0001', '2026-08-04', '2026-08-19', 1, 'paid', [[1, 40], [2, 30]]),
      inv('INV-0002', '2026-08-11', '2026-08-26', 2, 'paid', [[1, 120, 5]]),
      inv('INV-0003', '2026-08-22', '2026-09-06', 3, 'paid', [[4, 6], [6, 10]]),
      inv('INV-0004', '2026-09-02', '2026-09-17', 4, 'paid', [[2, 200]]),
      inv('INV-0005', '2026-09-09', '2026-10-24', 1, 'partially_paid', [[3, 80], [5, 6]], 20000),
      inv('INV-0006', '2026-09-18', '2026-10-03', 5, 'paid', [[6, 25]]),
      inv('INV-0007', '2026-09-26', '2026-10-11', 2, 'sent', [[1, 60], [3, 40]]),
      inv('INV-0008', '2026-10-03', '2026-10-31', 1, 'sent', [[1, 50], [5, 4]]),
      inv('INV-0009', '2026-10-08', '2026-11-07', 3, 'sent', [[4, 4]]),
      inv('INV-0010', '2026-10-14', '2026-11-13', 4, 'sent', [[2, 150], [5, 10]], 0, { fromQuote: 'QT-0001' }),
      inv('INV-0011', '2026-10-19', '2026-11-18', 5, 'draft', [[3, 30]]),
      inv('INV-0012', '2026-10-21', '2026-11-20', 2, 'draft', [[6, 40]]),
    ],
    quotes: [
      quote('QT-0001', '2026-10-06', '2026-11-05', 4, 'converted', [[2, 150], [5, 10]], { invoiceNo: 'INV-0010' }),
      quote('QT-0002', '2026-09-05', '2026-10-05', 5, 'sent', [[2, 40]]),
      quote('QT-0003', '2026-10-16', '2026-11-15', 2, 'sent', [[1, 200], [3, 100]]),
      quote('QT-0004', '2026-10-12', '2026-11-11', 3, 'accepted', [[4, 10], [5, 8]]),
      quote('QT-0005', '2026-10-20', '2026-11-19', 1, 'draft', [[6, 30]]),
    ],
    creditNotes: [
      { no: 'CN-0001', date: '2026-09-12', invNo: 'INV-0004', custId: 4, type: 'INTER', item: items([[2, 1]])[0], qty: 10, reason: 'Damaged goods' },
      { no: 'CN-0002', date: '2026-10-20', invNo: 'INV-0007', custId: 2, type: 'INTER', item: items([[1, 1]])[0], qty: 5, reason: 'Short supply' },
    ],
    expenses: [
      { id: 1, date: '2026-08-01', category: 'Rent', vendor: 'Lakshmi Properties', amount: 25000, gstRate: 18 },
      { id: 2, date: '2026-08-05', category: 'Stock purchase', vendor: 'Southern Steel Distributors', amount: 50000, gstRate: 18 },
      { id: 3, date: '2026-08-30', category: 'Salaries', vendor: 'Staff payroll', amount: 45000, gstRate: 0 },
      { id: 4, date: '2026-08-28', category: 'Electricity', vendor: 'TANGEDCO', amount: 4500, gstRate: 0 },
      { id: 5, date: '2026-09-01', category: 'Rent', vendor: 'Lakshmi Properties', amount: 25000, gstRate: 18 },
      { id: 6, date: '2026-09-04', category: 'Stock purchase', vendor: 'Coromandel Cement Agency', amount: 75000, gstRate: 28 },
      { id: 7, date: '2026-09-20', category: 'Transport', vendor: 'KPN Logistics', amount: 9000, gstRate: 5 },
      { id: 8, date: '2026-09-30', category: 'Salaries', vendor: 'Staff payroll', amount: 45000, gstRate: 0 },
      { id: 9, date: '2026-10-01', category: 'Rent', vendor: 'Lakshmi Properties', amount: 25000, gstRate: 18 },
      { id: 10, date: '2026-10-07', category: 'Stock purchase', vendor: 'Southern Steel Distributors', amount: 42000, gstRate: 18 },
      { id: 11, date: '2026-10-10', category: 'Internet & phone', vendor: 'BSNL Broadband', amount: 1500, gstRate: 18 },
      { id: 12, date: '2026-10-15', category: 'Transport', vendor: 'KPN Logistics', amount: 6000, gstRate: 5 },
    ],
    settings: {
      accent: '#0B6E4F',
      layout: 'modern',
      logo: null,
      showHsn: true,
      terms: 'Payment due within 15 days of the invoice date. Interest at 18% p.a. applies to overdue amounts. Returns are adjusted through a credit note.',
      notes: 'Thank you for your business.',
      bank: '[BANK NAME] · A/c [ACCOUNT NO.] · IFSC [IFSC CODE]',
    },
    reminders: { 'INV-0007': '2026-10-15' },
  };
}
