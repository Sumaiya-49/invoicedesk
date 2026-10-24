// Read tools: answer questions from the user's own records.
// They use the same derive() calculations as the dashboard, so the assistant and the screens always agree.
import { derive } from '../../src/lib/derive.js';
import { r2, todayIST, monthLabel } from '../../src/lib/format.js';
import { findCustomer, docNo, fuzzyFilter } from './lookup.js';

const STATUS_WORDS = { partially_paid: 'part paid' };
export const TEMPLATE_COLOURS = [['#0B6E4F', 'Emerald'], ['#3730A3', 'Indigo'], ['#9F1239', 'Maroon'], ['#334155', 'Slate'], ['#B45309', 'Saffron']];
const gstType = (t) => (t === 'INTRA' ? 'CGST + SGST' : 'IGST');
const sum = (list, f) => r2(list.reduce((s, x) => s + f(x), 0));

export function runReadTool(name, args, data) {
  const d = derive(data);
  switch (name) {
    case 'list_customers': {
      // Sorted by how much they owe, highest first, so "who owes me the most?" is the first row
      const found = fuzzyFilter(data.customers, args.search);
      if (!found) return { note: `No customer matches "${args.search}". All customers: ${data.customers.map((c) => c.name).join(', ')}` };
      return found.map((c) => {
        const mine = d.invs.filter((i) => i.custId === c.id);
        return {
          name: c.name, state: `${c.stateName} (${c.state})`, gstin: c.gstin || 'unregistered', city: c.city,
          gst_type: c.state === data.seller.state ? 'CGST + SGST' : 'IGST', invoices: mine.length,
          total_billed: sum(mine.filter((i) => i.live), (i) => i.t.total), owes: sum(mine, (i) => i.balance),
        };
      }).sort((x, y) => y.owes - x.owes || y.total_billed - x.total_billed);
    }

    case 'list_products': {
      const found = fuzzyFilter(data.products, args.search);
      if (!found) return { note: `No product matches "${args.search}". All products: ${data.products.map((p) => p.name).join(', ')}` };
      return found
        .map((p) => ({ name: p.name, hsn: p.hsn, unit: p.unit, price_before_gst: p.rate, gst_rate: `${p.gst}%` }));
    }

    case 'search_invoices': {
      let list = d.invs;
      if (args.customer) { const c = findCustomer(data, args.customer); list = list.filter((i) => i.custId === c.id); }
      const st = args.status || 'any';
      if (st === 'unpaid') list = list.filter((i) => i.balance > 0);
      else if (st !== 'any') list = list.filter((i) => i.ds === st);
      if (args.from) list = list.filter((i) => i.date >= args.from);
      if (args.to) list = list.filter((i) => i.date <= args.to);
      return {
        count: list.length,
        total_billed: sum(list, (i) => i.t.total),
        total_balance_due: sum(list, (i) => i.balance),
        invoices: list.slice(0, 30).map((i) => ({
          invoice_no: i.no, date: i.date, due_date: i.due, customer: i.c.name, status: STATUS_WORDS[i.ds] || i.ds,
          gst_type: gstType(i.type), taxable: i.t.taxable, gst: i.t.gst, total: i.t.total, balance_due: i.balance,
        })),
        note: list.length > 30 ? 'Only the first 30 are listed.' : undefined,
      };
    }

    case 'get_invoice': {
      const no = docNo(args.invoice_no, 'INV');
      const i = d.byNo[no];
      if (!i) throw new Error(`${no} does not exist.`);
      return {
        invoice_no: i.no, date: i.date, due_date: i.due, status: STATUS_WORDS[i.ds] || i.ds, customer: i.c.name,
        customer_gstin: i.c.gstin, place_of_supply: `${i.c.stateName} (${i.c.state})`, gst_type: gstType(i.type),
        items: i.lines.map((l) => ({ product: l.name, hsn: l.hsn, qty: l.qty, unit: l.unit, rate: l.rate, discount_pct: l.disc, gst_rate: l.gst, taxable: l.taxable, cgst: l.cgst, sgst: l.sgst, igst: l.igst, amount: l.amount })),
        totals: { taxable: i.t.taxable, cgst: i.t.cgst, sgst: i.t.sgst, igst: i.t.igst, total: i.t.total },
        paid: i.paidAmt, credit_notes: i.credit, balance_due: i.balance,
        payments: i.payments || [], last_reminder: i.reminded, created_from_quote: i.fromQuote || undefined,
        created_at_ist: i.createdAt, last_edited_at_ist: i.updatedAt || 'never edited',
      };
    }

    case 'sales_report': {
      let list = d.invs.filter((i) => i.live);
      if (args.customer) { const c = findCustomer(data, args.customer); list = list.filter((i) => i.custId === c.id); }
      if (args.month) list = list.filter((i) => i.date.startsWith(args.month));
      if (args.from) list = list.filter((i) => i.date >= args.from);
      if (args.to) list = list.filter((i) => i.date <= args.to);
      const groups = new Map();
      for (const inv of list) {
        for (const l of inv.lines) {
          const key = args.group_by === 'product' ? l.name : inv.c.name;
          const g = groups.get(key) || { name: key, invoices: new Set(), billed_incl_gst: 0, taxable: 0, items: new Map() };
          g.invoices.add(inv.no);
          g.billed_incl_gst += l.amount;
          g.taxable += l.taxable;
          const sub = args.group_by === 'product' ? inv.c.name : l.name;
          const it = g.items.get(sub) || { name: sub, qty: 0, unit: l.unit, taxable: 0 };
          it.qty += l.qty; it.taxable += l.taxable;
          g.items.set(sub, it);
          groups.set(key, g);
        }
      }
      const rows = [...groups.values()]
        .map((g) => ({
          [args.group_by]: g.name, invoices: g.invoices.size, billed_incl_gst: r2(g.billed_incl_gst), taxable_value: r2(g.taxable),
          [args.group_by === 'product' ? 'bought_by' : 'items_bought']: [...g.items.values()]
            .sort((x, y) => y.taxable - x.taxable)
            .map((it) => ({ name: it.name, qty: it.qty, unit: it.unit, taxable_value: r2(it.taxable) })),
        }))
        .sort((x, y) => y.billed_incl_gst - x.billed_incl_gst);
      const period = args.month ? monthLabel(args.month)
        : args.from || args.to ? `${args.from || 'start'} to ${args.to || 'today'}` : 'all time';
      return { period, invoices_counted: list.length, ranked: rows.slice(0, 15), note: 'Drafts and cancelled invoices are not counted. Credit notes are not subtracted.' };
    }

    case 'list_quotations': {
      const st = args.status || 'any';
      return d.quotes
        .filter((q) => st === 'any' || (st === 'open' ? ['draft', 'sent', 'accepted'].includes(q.ds) : q.ds === st))
        .map((q) => ({ quote_no: q.no, customer: q.c.name, date: q.date, valid_until: q.valid, status: q.ds, total: q.t.total, invoice_no: q.invoiceNo || undefined }));
    }

    case 'get_financial_summary': {
      const pick = (m) => {
        const invs = d.invs.filter((i) => i.live && i.date.startsWith(m.key));
        return {
          month: monthLabel(m.key), invoices: m.invoiceCount, billed_incl_gst: m.billed,
          taxable_sales: m.sales, credit_notes: m.creditTaxable, net_sales: m.netSales, expenses_before_gst: m.expenses, profit: m.profit,
          gst_collected: { cgst: sum(invs, (i) => i.t.cgst), sgst: sum(invs, (i) => i.t.sgst), igst: sum(invs, (i) => i.t.igst) },
          output_gst_after_credit_notes: m.outGst, input_gst_on_expenses: m.inGst, net_gst_payable: m.gstPayable,
        };
      };
      const outstanding = sum(d.invs, (i) => i.balance);
      const available = d.months.map((m) => m.key);
      if (args.all_months) {
        const months = d.months.map(pick);
        const total = (k) => r2(d.months.reduce((s, m) => s + m[k], 0));
        return {
          months,
          all_months_total: { net_sales: total('netSales'), expenses: total('expenses'), profit: total('profit'), net_gst_payable: total('gstPayable') },
          outstanding_now: outstanding,
        };
      }
      const key = /^\d{4}-\d{2}$/.test(args.month || '') ? args.month : todayIST().slice(0, 7);
      const m = d.months.find((x) => x.key === key);
      if (!m) return { month: monthLabel(key), note: 'No invoices or expenses in this month.', months_with_data: available.map(monthLabel), outstanding_now: outstanding };
      return { ...pick(m), outstanding_now: outstanding };
    }

    case 'get_invoice_template': {
      const st = data.settings;
      return { colour: TEMPLATE_COLOURS.find(([hex]) => hex.toLowerCase() === String(st.accent).toLowerCase())?.[1] || st.accent, layout: st.layout, show_hsn: st.showHsn, has_logo: Boolean(st.logo), terms: st.terms, note: st.notes, bank: st.bank };
    }

    case 'list_credit_notes': {
      const only = args.invoice_no ? docNo(args.invoice_no, 'INV') : null;
      return d.cns.filter((c) => !only || c.invNo === only).map((c) => ({
        credit_note_no: c.no, date: c.date, invoice_no: c.invNo, customer: c.c.name, item: c.item.name, qty: c.qty, reason: c.reason,
        taxable: c.t.taxable, gst: c.t.gst, total: c.t.total,
      }));
    }

    case 'list_expenses': {
      let list = data.expenses;
      if (args.month) list = list.filter((e) => e.date.startsWith(args.month));
      if (args.category) list = list.filter((e) => e.category.toLowerCase() === String(args.category).toLowerCase());
      return {
        count: list.length, total_before_gst: sum(list, (e) => e.amount), gst_paid: sum(list, (e) => (e.amount * e.gstRate) / 100),
        expenses: list.slice(0, 40).map((e) => ({ expense_id: e.id, date: e.date, category: e.category, vendor: e.vendor, amount: e.amount, gst_rate: e.gstRate })),
      };
    }

    default:
      throw new Error(`Unknown tool ${name}`);
  }
}
