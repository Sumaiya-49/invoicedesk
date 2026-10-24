import { r2 } from './format.js';

// GST engine — the same rules the backend will use.
// Same state for seller and place of supply -> INTRA (CGST + SGST, rate split 50/50)
// Different states -> INTER (IGST at the full rate)

export const GST_RATES = [0, 5, 12, 18, 28];

export const supplyType = (sellerState, placeOfSupply) => (sellerState === placeOfSupply ? 'INTRA' : 'INTER');

/**
 * doc: { custId, override?: 'INTRA'|'INTER', items: [{ name, hsn, unit, rate, gst, qty, disc }] }
 */
export function calcDoc(doc, customers, sellerState) {
  const c = customers.find((x) => x.id === doc.custId) || { name: 'Unknown customer', state: sellerState, stateName: '' };
  const auto = supplyType(sellerState, c.state);
  const type = doc.override || auto;

  const lines = doc.items.map((it, idx) => {
    const qty = Number(it.qty) || 0;
    const rate = Number(it.rate) || 0;
    const disc = Math.min(100, Math.max(0, Number(it.disc) || 0));
    const gross = r2(qty * rate);
    const discount = r2((gross * disc) / 100);
    const taxable = r2(gross - discount);
    let cgst = 0, sgst = 0, igst = 0;
    if (type === 'INTRA') {
      cgst = r2((taxable * it.gst) / 200);
      sgst = cgst;
    } else {
      igst = r2((taxable * it.gst) / 100);
    }
    return { ...it, idx, qty, rate, disc, gross, discount, taxable, cgst, sgst, igst, amount: r2(taxable + cgst + sgst + igst) };
  });

  const sum = (k) => r2(lines.reduce((s, l) => s + l[k], 0));
  const t = {
    subtotal: sum('gross'),
    discount: sum('discount'),
    taxable: sum('taxable'),
    cgst: sum('cgst'),
    sgst: sum('sgst'),
    igst: sum('igst'),
  };
  t.gst = r2(t.cgst + t.sgst + t.igst);
  t.total = r2(t.taxable + t.gst);
  return { c, auto, type, lines, t };
}
