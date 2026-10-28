// Write tools work in two steps:
//   1. prepareWrite(): check the request and build a preview card. Nothing is saved.
//   2. executeWrite(): runs only after the user clicks Confirm.
import { calcDoc } from '../../src/lib/gst.js';
import { derive } from '../../src/lib/derive.js';
import { inr, fdate, todayIST, addDays, r2 } from '../../src/lib/format.js';
import { check, customerSchema, productSchema, expenseSchema, invoiceSchema, quoteSchema, invoiceUpdateSchema, creditNoteSchema } from '../validation.js';
import { findCustomer, findProduct, findExpense, findState, docNo, toLineItem } from './lookup.js';
import { createInvoice, updateInvoice, deleteInvoice, addPayment, markUnpaid, markReminded } from '../services/invoices.js';
import { createQuote, updateQuote, deleteQuote, convertQuote } from '../services/quotes.js';
import { createCreditNote, updateCreditNote, deleteCreditNote } from '../services/creditNotes.js';
import { updateSettings } from '../services/users.js';
import { TEMPLATE_COLOURS } from './readTools.js';
import { createCustomer, updateCustomer, deleteCustomer } from '../services/customers.js';
import { createProduct, updateProduct, deleteProduct } from '../services/products.js';
import { shareInvoice } from '../services/sharing.js';
import { normalizePhone } from '../../src/lib/whatsapp.js';
import { createExpense, updateExpense, deleteExpense } from '../services/expenses.js';

const gstRows = (k) => (k.type === 'INTRA'
  ? [['GST type', 'Same state: CGST + SGST'], ['CGST', inr(k.t.cgst)], ['SGST', inr(k.t.sgst)]]
  : [['GST type', 'Other state: IGST'], ['IGST', inr(k.t.igst)]]);

const lineRows = (k) => k.lines.map((l) => [`${l.name} × ${l.qty}`, `${inr(l.taxable)} + ${l.gst}% GST`]);

/** Returns { action, card } or throws an Error whose message is sent back to the AI. */
export function prepareWrite(name, args, data) {
  const d = derive(data);
  const today = todayIST();
  const calc = (doc) => calcDoc(doc, data.customers, data.seller.state);

  switch (name) {
    case 'create_invoice':
    case 'create_quotation': {
      const quote = name === 'create_quotation';
      const c = findCustomer(data, args.customer);
      if (!Array.isArray(args.items) || !args.items.length) throw new Error('Which products and quantities?');
      const items = args.items.map((it) => toLineItem(data, it));
      const doc = quote
        ? check(quoteSchema, { custId: c.id, date: today, valid: args.valid_until || addDays(today, 30), status: 'draft', items, notes: data.settings.notes })
        : check(invoiceSchema, { custId: c.id, date: today, due: args.due_date || addDays(today, 15), status: args.status || 'draft', items, notes: args.notes || data.settings.notes });
      const k = calc(doc);
      return {
        action: { type: name, doc },
        card: {
          title: quote ? 'Create quotation' : `Create invoice (${doc.status})`,
          rows: [['Customer', `${c.name} · ${c.stateName}`], ...lineRows(k), ['Taxable value', inr(k.t.taxable)], ...gstRows(k),
            [quote ? 'Valid until' : 'Due date', fdate(quote ? doc.valid : doc.due)], ['Total', inr(k.t.total), true]],
        },
      };
    }

    case 'update_invoice': {
      const no = docNo(args.invoice_no, 'INV');
      const inv = d.byNo[no];
      if (!inv) throw new Error(`${no} does not exist.`);
      const changes = {};
      const rows = [['Invoice', `${no} · ${inv.c.name}`]];
      if (args.due_date) { changes.due = args.due_date; rows.push(['Due date', `${fdate(inv.due)} → ${fdate(args.due_date)}`]); }
      if (args.status) { changes.status = args.status; rows.push(['Status', `${inv.ds} → ${args.status}`]); }
      if (args.notes) { changes.notes = args.notes; rows.push(['Note', args.notes]); }

      let items = inv.items.map((it) => ({ ...it }));
      const touched = args.set_quantities?.length || args.add_items?.length || args.remove_products?.length;
      for (const sq of args.set_quantities || []) {
        const p = findProduct({ products: items.map((it, i) => ({ ...it, id: `line${i}` })) }, sq.product);
        items = items.map((it) => (it.name === p.name ? { ...it, qty: Number(sq.qty) } : it));
        rows.push([p.name, `${p.qty} → ${sq.qty} ${p.unit}`]);
      }
      for (const it of args.add_items || []) { const line = toLineItem(data, it); items.push(line); rows.push(['Add', `${line.name} × ${line.qty}`]); }
      for (const rp of args.remove_products || []) {
        const p = findProduct({ products: items.map((it, i) => ({ ...it, id: `line${i}` })) }, rp);
        items = items.filter((it) => it.name !== p.name);
        rows.push(['Remove', p.name]);
      }
      if (touched) {
        if (inv.paidAmt > 0) throw new Error(`${no} already has payments, so its items can't change. Suggest a credit note instead.`);
        if (!items.length) throw new Error('An invoice needs at least one item.');
        const k = calc({ custId: inv.custId, override: inv.override, items });
        changes.items = items;
        rows.push(['Total', `${inr(inv.t.total)} → ${inr(k.t.total)}`, true]);
      }
      if (!Object.keys(changes).length) throw new Error('What should change? Due date, status, notes or item quantities.');
      check(invoiceUpdateSchema, changes);
      return { action: { type: name, no, changes }, card: { title: `Update ${no}`, rows } };
    }

    case 'record_payment': {
      const no = docNo(args.invoice_no, 'INV');
      const inv = d.byNo[no];
      if (!inv) throw new Error(`${no} does not exist.`);
      if (inv.balance <= 0) throw new Error(`${no} has nothing left to pay (status: ${inv.ds}).`);
      if (['draft', 'cancelled'].includes(inv.status)) throw new Error(`${no} is ${inv.status}; it must be sent before payments are recorded.`);
      const amount = r2(Math.min(Number(args.amount) || inv.balance, inv.balance));
      const payment = { amount, method: args.method || 'upi', date: args.date || today };
      const after = r2(inv.balance - amount);
      return {
        action: { type: name, no, payment },
        card: { title: 'Record payment', rows: [['Invoice', `${no} · ${inv.c.name}`], ['Method', payment.method.toUpperCase()], ['Amount', inr(amount), true], ['Balance after', inr(after)], ['Status after', after <= 0 ? 'Paid' : 'Part paid']] },
      };
    }

    case 'mark_invoice_unpaid': {
      const no = docNo(args.invoice_no, 'INV');
      const inv = d.byNo[no];
      if (!inv) throw new Error(`${no} does not exist.`);
      if (!(inv.paidAmt > 0)) throw new Error(`${no} has no payments recorded (status: ${inv.ds}), so it is already unpaid.`);
      const payments = inv.payments?.length ? inv.payments.map((p) => `${inr(p.amount)} ${p.method.toUpperCase()} ${fdate(p.date)}`).join(', ') : inr(inv.paidAmt);
      return {
        action: { type: name, no },
        card: {
          title: `Mark ${no} as unpaid`,
          rows: [['Invoice', `${no} · ${inv.c.name}`], ['Status', `${inv.ds} → unpaid (sent)`], ['Payments removed', payments], ['Balance after', inr(r2(inv.t.total - (inv.credit || 0))), true]],
          warning: 'The recorded payments will be deleted.',
        },
      };
    }

    case 'delete_invoice': {
      const no = docNo(args.invoice_no, 'INV');
      const inv = d.byNo[no];
      if (!inv) throw new Error(`${no} does not exist.`);
      return {
        action: { type: name, no },
        card: {
          title: `Delete ${no}`, rows: [['Customer', inv.c.name], ['Status', inv.ds], ['Total', inr(inv.t.total), true]],
          warning: inv.live ? 'This invoice was already sent. A credit note is usually better than deleting.' : 'This can’t be undone.',
        },
      };
    }

    case 'update_quotation': {
      const no = docNo(args.quote_no, 'QT');
      const q = d.quotes.find((x) => x.no === no);
      if (!q) throw new Error(`${no} does not exist.`);
      if (q.ds === 'converted') throw new Error(`${no} is already converted to ${q.invoiceNo}, so it can't change.`);
      const rows = [['Quotation', `${no} · ${q.c.name}`]];
      let items = q.items.map((it) => ({ ...it }));
      const asList = () => ({ products: items.map((it, i) => ({ ...it, id: `line${i}` })) });
      for (const sq of args.set_quantities || []) { const p = findProduct(asList(), sq.product); items = items.map((it) => (it.name === p.name ? { ...it, qty: Number(sq.qty) } : it)); rows.push([p.name, `${p.qty} → ${sq.qty} ${p.unit}`]); }
      for (const it of args.add_items || []) { const line = toLineItem(data, it); items.push(line); rows.push(['Add', `${line.name} × ${line.qty}`]); }
      for (const rp of args.remove_products || []) { const p = findProduct(asList(), rp); items = items.filter((it) => it.name !== p.name); rows.push(['Remove', p.name]); }
      if (args.valid_until) rows.push(['Valid until', `${fdate(q.valid)} → ${fdate(args.valid_until)}`]);
      if (args.status) rows.push(['Status', `${q.ds} → ${args.status}`]);
      if (args.notes) rows.push(['Note', args.notes]);
      if (rows.length === 1) throw new Error('What should change? Valid-until date, status, notes or item quantities.');
      const doc = check(quoteSchema, { custId: q.custId, date: q.date, valid: args.valid_until || q.valid, status: args.status || (q.status === 'converted' ? 'sent' : q.status), override: q.override, notes: args.notes ?? q.notes, items });
      const k = calc(doc);
      if (k.t.total !== q.t.total) rows.push(['Total', `${inr(q.t.total)} → ${inr(k.t.total)}`, true]);
      return { action: { type: name, no, doc }, card: { title: `Update ${no}`, rows } };
    }

    case 'delete_quotation': {
      const no = docNo(args.quote_no, 'QT');
      const q = d.quotes.find((x) => x.no === no);
      if (!q) throw new Error(`${no} does not exist.`);
      return { action: { type: name, no }, card: { title: `Delete ${no}`, rows: [['Customer', q.c.name], ['Status', q.ds], ['Total', inr(q.t.total), true]], warning: q.invoiceNo ? `Invoice ${q.invoiceNo} made from it stays.` : 'This can’t be undone.' } };
    }

    case 'create_credit_note': {
      const no = docNo(args.invoice_no, 'INV');
      const inv = d.byNo[no];
      if (!inv) throw new Error(`${no} does not exist.`);
      if (!inv.live) throw new Error(`${no} is ${inv.ds}, so it can't have a credit note.`);
      const line = findProduct({ products: inv.items.map((it, i) => ({ ...it, id: i })) }, args.product);
      const idx = line.id;
      const already = d.cns.filter((c) => c.invNo === no && c.item.name === line.name).reduce((s, c) => s + c.qty, 0);
      const max = Number(line.qty) - already;
      if (Number(args.qty) > max) throw new Error(`Only ${max} ${line.unit} of ${line.name} can still be credited on ${no}.`);
      const cn = check(creditNoteSchema, { invNo: no, idx, qty: args.qty, reason: args.reason || 'Goods returned' });
      const k = calc({ custId: inv.custId, override: inv.type, items: [{ ...inv.items[idx], qty: cn.qty, disc: 0 }] });
      return {
        action: { type: name, cn },
        card: { title: `Credit note on ${no}`, rows: [['Customer', inv.c.name], ['Item', `${line.name} × ${cn.qty} ${line.unit}`], ['Reason', cn.reason], ['Taxable', inr(k.t.taxable)], ...gstRows(k), ['Credit total', inr(k.t.total), true], ['Invoice balance after', inr(Math.max(0, r2(inv.balance - k.t.total)))]] },
      };
    }

    case 'update_credit_note': {
      const no = docNo(args.credit_note_no, 'CN');
      const c = d.cns.find((x) => x.no === no);
      if (!c) throw new Error(`${no} does not exist.`);
      const qty = args.qty != null ? Number(args.qty) : c.qty;
      const reason = args.reason || c.reason;
      if (qty === c.qty && reason === c.reason) throw new Error('Nothing would change. A new quantity or reason?');
      const inv = d.byNo[c.invNo];
      const k = calc({ custId: c.custId, override: c.type, items: [{ ...c.item, qty, disc: 0 }] });
      const rows = [['Credit note', `${no} · ${c.invNo} · ${c.c.name}`]];
      if (qty !== c.qty) rows.push([c.item.name, `${c.qty} → ${qty} ${c.item.unit}`], ['Credit total', `${inr(c.t.total)} → ${inr(k.t.total)}`, true]);
      if (reason !== c.reason) rows.push(['Reason', `${c.reason} → ${reason}`]);
      if (inv) rows.push(['Invoice balance after', inr(Math.max(0, r2(inv.balance + c.t.total - k.t.total)))]);
      return { action: { type: name, no, changes: { qty, reason } }, card: { title: `Update ${no}`, rows } };
    }

    case 'update_invoice_template': {
      const st = data.settings;
      const patch = {};
      const rows = [];
      if (args.colour) {
        const hit = TEMPLATE_COLOURS.find(([, n]) => n.toLowerCase() === String(args.colour).toLowerCase());
        if (!hit) throw new Error(`Colours available: ${TEMPLATE_COLOURS.map(([, n]) => n).join(', ')}.`);
        patch.accent = hit[0]; rows.push(['Brand colour', hit[1]]);
      }
      if (args.layout) { patch.layout = args.layout; rows.push(['Layout', `${st.layout} → ${args.layout}`]); }
      if (typeof args.show_hsn === 'boolean') { patch.showHsn = args.show_hsn; rows.push(['HSN/SAC column', args.show_hsn ? 'Shown' : 'Hidden']); }
      if (args.terms) { patch.terms = args.terms; rows.push(['Terms', args.terms]); }
      if (args.note) { patch.notes = args.note; rows.push(['Default note', args.note]); }
      if (args.bank) { patch.bank = args.bank; rows.push(['Bank details', args.bank]); }
      if (!rows.length) throw new Error('What should change? Colour, layout, HSN column, terms, note or bank details.');
      return { action: { type: name, patch }, card: { title: 'Update invoice template', rows, warning: 'Applies to every invoice, quotation and PDF.' } };
    }

    case 'delete_credit_note': {
      const no = docNo(args.credit_note_no, 'CN');
      const c = d.cns.find((x) => x.no === no);
      if (!c) throw new Error(`${no} does not exist.`);
      return { action: { type: name, no }, card: { title: `Delete ${no}`, rows: [['Invoice', `${c.invNo} · ${c.c.name}`], ['Item', `${c.item.name} × ${c.qty}`], ['Credit total', inr(c.t.total), true]], warning: `${c.invNo}'s balance goes back up by ${inr(c.t.total)}.` } };
    }

    case 'convert_quotation': {
      const no = docNo(args.quote_no, 'QT');
      const q = d.quotes.find((x) => x.no === no);
      if (!q) throw new Error(`${no} does not exist.`);
      if (q.ds === 'converted') throw new Error(`${no} was already converted to ${q.invoiceNo}.`);
      return {
        action: { type: name, no },
        card: { title: `Convert ${no} to an invoice`, rows: [['Customer', q.c.name], ['Items', String(q.items.length)], ...gstRows(q), ['Invoice total', inr(q.t.total), true]], warning: q.ds === 'expired' ? `This quotation expired on ${fdate(q.valid)}.` : undefined },
      };
    }

    case 'send_payment_reminders': {
      const list = args.invoice_nos?.length
        ? args.invoice_nos.map((n) => d.byNo[docNo(n, 'INV')]).filter(Boolean).filter((i) => i.balance > 0)
        : d.invs.filter((i) => i.ds === 'overdue');
      if (!list.length) throw new Error('No unpaid invoices to remind about.');
      return {
        action: { type: name, nos: list.map((i) => i.no) },
        card: { title: `Send ${list.length} reminder${list.length > 1 ? 's' : ''}`, rows: [...list.map((i) => [`${i.no} · ${i.c.name}`, inr(i.balance)]), ['Total due', inr(r2(list.reduce((s, i) => s + i.balance, 0))), true]] },
      };
    }

    case 'share_invoice_whatsapp': {
      const no = docNo(args.invoice_no, 'INV');
      const inv = d.byNo[no];
      if (!inv) throw new Error(`${no} does not exist.`);
      const phone = normalizePhone(args.phone || inv.c.phone);
      if (args.phone && !phone) throw new Error('That phone number does not look valid. Ask the user for a 10-digit mobile number.');
      const due = inv.live && inv.balance > 0;
      return {
        action: { type: name, no, phone: args.phone ? String(args.phone).trim() : null },
        card: {
          title: 'Send invoice on WhatsApp',
          rows: [
            ['Invoice', `${no} · ${inv.c.name}`],
            ['WhatsApp number', phone ? `+${phone}${args.phone && normalizePhone(inv.c.phone) !== phone ? ' (will be saved)' : ''}` : 'Not saved · pick the chat in WhatsApp'],
            [due ? 'Balance due' : 'Invoice total', inr(due ? inv.balance : inv.t.total), true],
            ['Message', 'Invoice details + link to view and download the PDF'],
          ],
        },
      };
    }

    case 'create_customer': {
      if (!args.phone && !args.no_phone) {
        throw new Error(`Ask the user for ${args.name || 'the customer'}'s mobile (WhatsApp) number, so invoices can be sent on WhatsApp. If they don't have it, call create_customer again with no_phone true.`);
      }
      const st = findState(args.state);
      const c = check(customerSchema, { name: args.name, state: st.code, gstin: args.gstin, city: args.city, email: args.email, phone: args.phone });
      if (data.customers.some((x) => x.name.toLowerCase() === c.name.toLowerCase())) throw new Error(`${c.name} already exists.`);
      return {
        action: { type: name, customer: c },
        card: { title: 'Add customer', rows: [['Name', c.name], ['State', `${st.name} (${st.code})`], ['GSTIN', c.gstin || 'Unregistered'], ['City', c.city || '—'], ['Mobile (WhatsApp)', c.phone || 'Not given'], ['GST on invoices', st.code === data.seller.state ? 'CGST + SGST' : 'IGST']] },
      };
    }

    case 'update_customer': {
      const cur = findCustomer(data, args.customer);
      const st = args.state ? findState(args.state) : null;
      const c = check(customerSchema, {
        name: args.name ?? cur.name, state: st ? st.code : cur.state, gstin: args.gstin ?? cur.gstin,
        city: args.city ?? cur.city, email: args.email ?? cur.email, phone: args.phone ?? cur.phone,
      });
      const rows = [['Customer', cur.name]];
      for (const [label, before, after] of [['Name', cur.name, c.name], ['State', cur.stateName, st?.name ?? cur.stateName], ['GSTIN', cur.gstin, c.gstin], ['City', cur.city, c.city], ['Email', cur.email, c.email], ['Mobile (WhatsApp)', cur.phone, c.phone]]) {
        if ((before || '') !== (after || '')) rows.push([label, `${before || '—'} → ${after || '—'}`]);
      }
      if (rows.length === 1) throw new Error('Nothing would change. What should be updated?');
      return { action: { type: name, id: cur.id, customer: c }, card: { title: `Update ${cur.name}`, rows } };
    }

    case 'delete_customer': {
      const c = findCustomer(data, args.customer);
      const used = data.invoices.filter((i) => i.custId === c.id).length + data.quotes.filter((q) => q.custId === c.id).length;
      if (used) throw new Error(`${c.name} has ${used} invoices/quotations, so they can't be deleted.`);
      return { action: { type: name, id: c.id }, card: { title: `Delete ${c.name}`, rows: [['State', c.stateName], ['Invoices', '0']], warning: 'This can’t be undone.' } };
    }

    case 'create_product': {
      const p = check(productSchema, { name: args.name, rate: args.price, gst: args.gst_rate, hsn: args.hsn, unit: args.unit || 'Nos' });
      return { action: { type: name, product: p }, card: { title: 'Add product', rows: [['Name', p.name], ['Price', `${inr(p.rate)} per ${p.unit}`], ['GST', `${p.gst}%`], ['HSN/SAC', p.hsn || '—']] } };
    }

    case 'update_product': {
      const cur = findProduct(data, args.product);
      const p = check(productSchema, { name: args.name ?? cur.name, rate: args.price ?? cur.rate, gst: args.gst_rate ?? cur.gst, hsn: args.hsn ?? cur.hsn, unit: args.unit ?? cur.unit, altUnit: cur.altUnit, altPer: cur.altPer, altRate: cur.altRate });
      const rows = [['Product', cur.name]];
      for (const [label, before, after] of [['Name', cur.name, p.name], ['Price', inr(cur.rate), inr(p.rate)], ['GST', `${cur.gst}%`, `${p.gst}%`], ['HSN/SAC', cur.hsn, p.hsn], ['Unit', cur.unit, p.unit]]) {
        if ((before || '') !== (after || '')) rows.push([label, `${before || '—'} → ${after || '—'}`]);
      }
      if (rows.length === 1) throw new Error('Nothing would change. What should be updated?');
      return { action: { type: name, id: cur.id, product: p }, card: { title: `Update ${cur.name}`, rows, warning: 'Existing invoices keep their old price.' } };
    }

    case 'delete_product': {
      const p = findProduct(data, args.product);
      return { action: { type: name, id: p.id }, card: { title: `Delete ${p.name}`, rows: [['Price', inr(p.rate)]], warning: 'Old invoices keep this item; it just won’t be available for new ones.' } };
    }

    case 'add_expense': {
      const e = check(expenseSchema, { date: args.date || today, category: args.category, vendor: args.vendor, amount: args.amount, gstRate: args.gst_rate ?? 0 });
      return { action: { type: name, expense: e }, card: { title: 'Add expense', rows: [['Paid to', e.vendor], ['Category', e.category], ['Date', fdate(e.date)], ['Amount', inr(e.amount), true], ['GST paid', e.gstRate ? `${inr((e.amount * e.gstRate) / 100)} (${e.gstRate}%)` : '—']] } };
    }

    case 'update_expense':
    case 'delete_expense': {
      const { e: cur, others } = findExpense(data, { expense_id: args.expense_id, expense: args.expense, date: args.on_date, amount: name === 'delete_expense' ? args.amount : undefined });
      const note = others ? `Most recent of ${others + 1} expenses to ${cur.vendor}. Give a date to pick another.` : undefined;
      if (name === 'delete_expense') {
        return { action: { type: name, id: cur.id }, card: { title: 'Delete expense', rows: [['Paid to', cur.vendor], ['Date', fdate(cur.date)], ['Category', cur.category], ['Amount', inr(cur.amount), true]], warning: note || 'This can’t be undone.' } };
      }
      const e = check(expenseSchema, { date: args.date ?? cur.date, category: args.category ?? cur.category, vendor: args.vendor ?? cur.vendor, amount: args.amount ?? cur.amount, gstRate: args.gst_rate ?? cur.gstRate });
      const rows = [['Expense', `${cur.vendor} · ${fdate(cur.date)}`]];
      for (const [label, before, after] of [['Paid to', cur.vendor, e.vendor], ['Date', fdate(cur.date), fdate(e.date)], ['Category', cur.category, e.category], ['Amount', inr(cur.amount), inr(e.amount)], ['GST', `${cur.gstRate}%`, `${e.gstRate}%`]]) {
        if (before !== after) rows.push([label, `${before} → ${after}`]);
      }
      if (rows.length === 1) throw new Error('Nothing would change. What should be updated?');
      return { action: { type: name, id: cur.id, expense: e }, card: { title: 'Update expense', rows, warning: note } };
    }

    default:
      throw new Error(`Unknown tool ${name}`);
  }
}

/** Runs a confirmed action. Returns the message shown in the chat. */
export async function executeWrite(userId, a) {
  switch (a.type) {
    case 'create_invoice': { const inv = await createInvoice(userId, a.doc); return { text: `Done. ${inv.no} is saved (${inv.status}).`, openNo: inv.no }; }
    case 'create_quotation': { const q = await createQuote(userId, a.doc); return { text: `Done. ${q.no} is saved under Quotations.` }; }
    case 'update_invoice': { await updateInvoice(userId, a.no, a.changes); return { text: `Done. ${a.no} is updated.`, openNo: a.no }; }
    case 'record_payment': { const inv = await addPayment(userId, a.no, a.payment); return { text: `Done. ${inr(a.payment.amount)} recorded on ${a.no}. Status: ${inv.status === 'paid' ? 'paid' : 'part paid'}.`, openNo: a.no }; }
    case 'mark_invoice_unpaid': await markUnpaid(userId, a.no); return { text: `Done. ${a.no} is unpaid again and its payments were removed.`, openNo: a.no };
    case 'delete_invoice': await deleteInvoice(userId, a.no); return { text: `Done. ${a.no} is deleted.` };
    case 'convert_quotation': { const inv = await convertQuote(userId, a.no); return { text: `Done. ${a.no} is now invoice ${inv.no}.`, openNo: inv.no }; }
    case 'share_invoice_whatsapp': {
      const r = await shareInvoice(userId, a.no, { phone: a.phone });
      return { text: r.phone ? `Done. Tap "Open WhatsApp" to send ${r.no} to ${r.customer}, then press Send in WhatsApp.` : `Done. Tap "Open WhatsApp", pick ${r.customer}’s chat and press Send. (No number is saved for them.)`, share: { no: r.no, code: r.code, phone: r.phone }, openNo: r.no };
    }
    case 'send_payment_reminders': await markReminded(userId, a.nos); return { text: `Done. Reminder recorded for ${a.nos.join(', ')}.` };
    case 'create_customer': { const c = await createCustomer(userId, a.customer); return { text: `Done. ${c.name} is added.` }; }
    case 'update_customer': { const c = await updateCustomer(userId, a.id, a.customer); return { text: `Done. ${c.name} is updated.` }; }
    case 'delete_customer': await deleteCustomer(userId, a.id); return { text: 'Done. The customer is deleted.' };
    case 'create_product': { const p = await createProduct(userId, a.product); return { text: `Done. ${p.name} is added.` }; }
    case 'update_product': { const p = await updateProduct(userId, a.id, a.product); return { text: `Done. ${p.name} is updated.` }; }
    case 'delete_product': await deleteProduct(userId, a.id); return { text: 'Done. The product is deleted.' };
    case 'update_quotation': await updateQuote(userId, a.no, a.doc); return { text: `Done. ${a.no} is updated.` };
    case 'delete_quotation': await deleteQuote(userId, a.no); return { text: `Done. ${a.no} is deleted.` };
    case 'create_credit_note': { const cn = await createCreditNote(userId, a.cn); return { text: `Done. Credit note ${cn.no} is issued against ${a.cn.invNo}.`, openNo: a.cn.invNo }; }
    case 'update_credit_note': await updateCreditNote(userId, a.no, a.changes); return { text: `Done. ${a.no} is updated.` };
    case 'update_invoice_template': await updateSettings(userId, a.patch); return { text: 'Done. The invoice template is updated. Open any invoice to see it.' };
    case 'delete_credit_note': await deleteCreditNote(userId, a.no); return { text: `Done. ${a.no} is deleted.` };
    case 'update_expense': await updateExpense(userId, a.id, a.expense); return { text: `Done. The expense to ${a.expense.vendor} is updated.` };
    case 'delete_expense': await deleteExpense(userId, a.id); return { text: 'Done. The expense is deleted.' };
    case 'add_expense': await createExpense(userId, a.expense); return { text: `Done. Expense of ${inr(a.expense.amount)} to ${a.expense.vendor} is added.` };
    default: throw new Error('Unknown action');
  }
}
