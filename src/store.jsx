// App state for the whole frontend.
// Data (customers, invoices...) comes from the backend API. Every change is sent to the API,
// then the data is reloaded so the screen always shows what's in the database.
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { seed, itemFrom } from './data/seed.js';
import { derive, STATUS } from './lib/derive.js';
import { TODAY, addDays, inr, r2, monthLabel, todayIST } from './lib/format.js';
import { downloadCsv, downloadXlsx, downloadInvoicePdf } from './lib/downloads.js';
import { api, auth } from './api.js';
import { shareLink, shareMessage, whatsappUrl } from './lib/whatsapp.js';
import { rateFor } from './lib/units.js';
import { offlineReply, runOfflineAction, SUGGESTIONS } from './assistant/offlineAssistant.js';

const AppCtx = createContext(null);
export const useApp = () => useContext(AppCtx);

let uid = 1000;
const nid = () => ++uid;
/** Unique id for chat messages (also used as their id in the database). */
const msgId = () => (globalThis.crypto?.randomUUID ? crypto.randomUUID() : `m${Date.now()}${Math.random().toString(16).slice(2)}`);

const welcome = {
  id: 'welcome',
  from: 'bot',
  text: 'Hi! In Read mode I answer questions from your invoices, quotations and expenses. In Write mode I can create and change records for you, and you confirm every change first.',
};

const EMPTY_DATA = {
  seller: null, settings: seed().settings, customers: [], products: [], invoices: [], quotes: [], creditNotes: [], expenses: [],
};

export function AppProvider({ children }) {
  const [s, setS] = useState(() => ({
    ...EMPTY_DATA,
    screen: 'loading',
    viewNo: null,
    form: null,
    toast: null,
    modal: null,
    navOpen: false,
    invFilter: 'all',
    invSearch: '',
    busy: false,
    aiProviders: [],
    chat: { open: false, mode: 'read', text: '', messages: [welcome], thinking: false },
  }));
  const d = useMemo(() => derive(s), [s]);
  const ref = useRef({ s, d });
  ref.current = { s, d };

  const set = (patch) => setS((p) => ({ ...p, ...(typeof patch === 'function' ? patch(p) : patch) }));
  const toast = (text, tone = 'ok') => set({ toast: { text, tone, id: nid() } });

  // ---------------------------------------------------------------- loading data
  const applyData = (data) => set({
    seller: data.seller, settings: data.settings, customers: data.customers, products: data.products,
    invoices: data.invoices, quotes: data.quotes, creditNotes: data.creditNotes, expenses: data.expenses,
  });
  const reload = async () => applyData(await api.get('/data'));

  const afterLogin = (data) => {
    applyData(data);
    set({ screen: 'dashboard', chat: { open: false, mode: 'read', text: '', messages: [welcome], thinking: false } });
    loadChat();
    api.get('/chat/status').then((r) => set({ aiProviders: r.providers })).catch(() => {});
  };

  // On first load: if a login token is saved, use it; otherwise show the login page.
  useEffect(() => {
    if (!auth.get()) { set({ screen: 'login' }); return; }
    api.get('/data').then(afterLogin).catch(() => { auth.clear(); set({ screen: 'login' }); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Runs one change against the API: blocks double clicks, reloads data, shows a message.
   * Returns the API result, or null if it failed (the error is shown as a toast).
   */
  const run = async (fn, successText) => {
    if (ref.current.s.busy) return null;
    set({ busy: true });
    try {
      const result = await fn();
      await reload();
      if (successText) toast(typeof successText === 'function' ? successText(result) : successText);
      return result ?? true;
    } catch (err) {
      if (err.status === 401) { auth.clear(); set({ screen: 'login' }); }
      toast(err.message, 'error');
      return null;
    } finally {
      set({ busy: false });
    }
  };

  // ---------------------------------------------------------------- login
  const login = async (email, password) => {
    try {
      const { token } = await api.post('/auth/login', { email, password });
      auth.set(token);
      afterLogin(await api.get('/data'));
    } catch (err) { toast(err.message, 'error'); }
  };
  const signup = async (details) => {
    try {
      const { token } = await api.post('/auth/signup', details);
      auth.set(token);
      afterLogin(await api.get('/data'));
      toast('Account created. Welcome!');
    } catch (err) { toast(err.message, 'error'); }
  };
  const logout = () => { auth.clear(); setS((p) => ({ ...p, ...EMPTY_DATA, screen: 'login', modal: null, toast: null })); };
  const loadSample = () => run(() => api.post('/sample-data'), 'Sample data loaded.');

  // ---------------------------------------------------------------- navigation
  const go = (screen, extra = {}) => set({ screen, navOpen: false, modal: null, toast: null, ...extra });
  const viewInvoice = (no) => go('invoice', { viewNo: no });

  // ---------------------------------------------------------------- invoice & quotation form
  const blankForm = (kind) => {
    const { customers, products, settings } = ref.current.s;
    return {
      kind, editingNo: null, custId: customers[0]?.id || null, date: TODAY, due: addDays(TODAY, kind === 'quote' ? 30 : 15),
      override: null, items: products.length ? [itemFrom(products[0], 1)] : [], notes: settings.notes,
    };
  };
  const openForm = (kind) => {
    const { customers, products } = ref.current.s;
    if (!customers.length) return toast('Add a customer first.', 'error');
    if (!products.length) return toast('Add a product first.', 'error');
    go('form', { form: blankForm(kind) });
  };
  const newInvoice = () => openForm('invoice');
  const newQuote = () => openForm('quote');
  const docToForm = (doc, kind, editing) => ({
    kind, editingNo: editing ? doc.no : null, custId: doc.custId, date: editing ? doc.date : TODAY,
    due: editing ? (kind === 'quote' ? doc.valid : doc.due) : addDays(TODAY, kind === 'quote' ? 30 : 15),
    override: doc.override, items: doc.items.map((x) => ({ ...x })), notes: doc.notes || '', status: doc.status,
  });
  const editInvoice = (no) => {
    const inv = ref.current.s.invoices.find((i) => i.no === no);
    if (inv) go('form', { form: docToForm(inv, 'invoice', true) });
  };
  const duplicateInvoice = (no) => {
    const inv = ref.current.s.invoices.find((i) => i.no === no);
    if (!inv) return;
    go('form', { form: docToForm(inv, 'invoice', false) });
    toast(`Copied items from ${no}. Check the details and save.`, 'info');
  };
  const editQuote = (no) => {
    const q = ref.current.s.quotes.find((i) => i.no === no);
    if (q) go('form', { form: docToForm(q, 'quote', true) });
  };
  const setForm = (patch) => set((p) => ({ form: { ...p.form, ...patch } }));
  const setItem = (idx, patch) => set((p) => ({ form: { ...p.form, items: p.form.items.map((it, i) => (i === idx ? { ...it, ...patch } : it)) } }));
  const pickProduct = (idx, pid) => {
    const prod = ref.current.s.products.find((x) => x.id === Number(pid));
    if (prod) setItem(idx, { pid: prod.id, name: prod.name, hsn: prod.hsn, unit: prod.unit, rate: prod.rate, gst: prod.gst });
  };
  /** Unit dropdown on a line: switching Box <-> Piece also switches the rate (Unit of Measure conversion). */
  const setItemUnit = (idx, unit) => {
    const it = ref.current.s.form.items[idx];
    const prod = ref.current.s.products.find((x) => x.id === it.pid);
    setItem(idx, prod ? { unit, rate: rateFor(prod, unit) } : { unit });
  };
  const addItem = () => set((p) => ({ form: { ...p.form, items: [...p.form.items, itemFrom(p.products[0], 1)] } }));
  const removeItem = (idx) => set((p) => ({ form: { ...p.form, items: p.form.items.filter((_, i) => i !== idx) } }));

  const saveForm = async (status) => {
    const f = ref.current.s.form;
    if (!f.items.length) return toast('Add at least one item before saving.', 'error');
    if (f.items.some((it) => !(Number(it.qty) > 0))) return toast('Every item needs a quantity above 0.', 'error');
    const body = { custId: f.custId, date: f.date, override: f.override, notes: f.notes, items: f.items };

    if (f.kind === 'quote') {
      const quote = { ...body, valid: f.due, status: f.editingNo && f.status === 'accepted' ? 'accepted' : status };
      const r = await run(
        () => (f.editingNo ? api.put(`/quotes/${f.editingNo}`, quote) : api.post('/quotes', quote)),
        (q) => (f.editingNo ? `${q.no} updated.` : `${q.no} created.`)
      );
      if (r) go('quotes');
      return;
    }
    // Paid or part-paid invoices keep their status; only drafts/sent change with these buttons.
    const keepStatus = f.editingNo && !['draft', 'sent'].includes(f.status);
    const invoice = { ...body, due: f.due, ...(keepStatus ? {} : { status }) };
    const r = await run(
      () => (f.editingNo ? api.put(`/invoices/${f.editingNo}`, invoice) : api.post('/invoices', invoice)),
      (inv) => (f.editingNo ? `${inv.no} updated.` : `${inv.no} created.`)
    );
    if (r) go('invoice', { viewNo: r.no });
  };

  // ---------------------------------------------------------------- invoices
  const askDeleteInvoice = (no) => set({
    modal: {
      type: 'confirm', title: `Delete ${no}?`, confirmLabel: 'Delete invoice',
      body: 'This permanently removes the invoice and its payments. Use a credit note instead if goods were returned.',
      onConfirm: async () => {
        if (await run(() => api.del(`/invoices/${no}`), `${no} deleted.`)) set((p) => ({ modal: null, screen: p.screen === 'invoice' ? 'invoices' : p.screen }));
      },
    },
  });
  const openPayment = (no) => set({ modal: { type: 'payment', no } });
  const recordPayment = async (no, amount, method, date) => {
    if (!(Number(amount) > 0)) return toast('Enter an amount above ₹0.', 'error');
    if (await run(() => api.post(`/invoices/${no}/payments`, { amount: Number(amount), method, date }), `${inr(amount)} recorded on ${no}.`)) set({ modal: null });
  };
  const askMarkUnpaid = (no) => set({
    modal: {
      type: 'confirm', title: `Mark ${no} as unpaid?`, confirmLabel: 'Mark as unpaid',
      body: 'This removes the payments recorded on this invoice, so the full amount is due again. Use it for a payment entered by mistake or a bounced cheque.',
      onConfirm: async () => { if (await run(() => api.post(`/invoices/${no}/unpaid`), `${no} marked as unpaid.`)) set({ modal: null }); },
    },
  });
  const markSent = (no) => run(() => api.put(`/invoices/${no}`, { status: 'sent' }), `${no} marked as sent.`);

  // ---------------------------------------------------------------- reminders
  // Emails aren't sent in this version: the reminder date is saved and shown on the invoice.
  const openReminder = (nos) => set({ modal: { type: 'reminder', nos } });
  const sendReminders = async (nos) => {
    if (await run(() => api.post('/invoices/reminders', { nos }), nos.length === 1 ? `Reminder recorded for ${nos[0]}.` : `${nos.length} reminders recorded.`)) set({ modal: null });
  };

  // ---------------------------------------------------------------- quotations
  const convertQuoteAndOpen = async (no) => {
    const inv = await run(() => api.post(`/quotes/${no}/convert`), (i) => `${no} converted to ${i.no}.`);
    if (inv) go('invoice', { viewNo: inv.no });
  };
  const setQuoteStatus = (no, status) => run(() => api.patch(`/quotes/${no}/status`, { status }), `${no} marked as ${status}.`);
  const askDeleteQuote = (no) => set({
    modal: {
      type: 'confirm', title: `Delete ${no}?`, confirmLabel: 'Delete quotation',
      body: 'The quotation will be removed. Invoices already created from it are not affected.',
      onConfirm: async () => { if (await run(() => api.del(`/quotes/${no}`), `${no} deleted.`)) set({ modal: null }); },
    },
  });

  // ---------------------------------------------------------------- credit notes
  const issueCreditNote = (cn) => run(() => api.post('/credit-notes', cn), (r) => `${r.no} issued against ${cn.invNo}.`);
  const askDeleteCreditNote = (no) => set({
    modal: {
      type: 'confirm', title: `Delete ${no}?`, confirmLabel: 'Delete credit note',
      body: 'The credit note is removed and the invoice balance and GST go back to what they were before it.',
      onConfirm: async () => { if (await run(() => api.del(`/credit-notes/${no}`), `${no} deleted.`)) set({ modal: null }); },
    },
  });

  // ---------------------------------------------------------------- customers & products
  const saveCustomer = async (c) => {
    const body = { name: c.name, state: c.state, gstin: c.gstin, city: c.city, email: c.email, phone: c.phone };
    const r = await run(() => (c.id ? api.put(`/customers/${c.id}`, body) : api.post('/customers', body)), (x) => (c.id ? `${x.name} updated.` : `${x.name} added.`));
    if (r) set({ modal: null });
  };
  const askDeleteCustomer = (c) => {
    const used = ref.current.s.invoices.filter((i) => i.custId === c.id).length;
    if (used) return toast(`${c.name} has ${used} invoice${used > 1 ? 's' : ''}. Delete those first.`, 'error');
    set({
      modal: {
        type: 'confirm', title: `Delete ${c.name}?`, confirmLabel: 'Delete customer', body: 'This customer has no invoices, so it can be removed safely.',
        onConfirm: async () => { if (await run(() => api.del(`/customers/${c.id}`), `${c.name} deleted.`)) set({ modal: null }); },
      },
    });
  };
  const saveProduct = async (pr) => {
    const body = { name: pr.name, hsn: pr.hsn, unit: pr.unit, rate: pr.rate, gst: pr.gst, altUnit: pr.altUnit || null, altPer: pr.altPer ?? null, altRate: pr.altRate ?? null };
    const r = await run(() => (pr.id ? api.put(`/products/${pr.id}`, body) : api.post('/products', body)), (x) => (pr.id ? `${x.name} updated.` : `${x.name} added.`));
    if (r) set({ modal: null });
  };
  const askDeleteProduct = (pr) => set({
    modal: {
      type: 'confirm', title: `Delete ${pr.name}?`, confirmLabel: 'Delete product',
      body: 'Old invoices keep their line items. The product just won’t be available for new ones.',
      onConfirm: async () => { if (await run(() => api.del(`/products/${pr.id}`), `${pr.name} deleted.`)) set({ modal: null }); },
    },
  });

  // ---------------------------------------------------------------- expenses
  const addExpense = (e) => run(() => api.post('/expenses', { ...e, amount: Number(e.amount) }), `Expense of ${inr(e.amount)} added.`);
  const updateExpense = (id, e) => run(() => api.put(`/expenses/${id}`, { ...e, amount: Number(e.amount) }), 'Expense updated.');
  const deleteExpense = (id) => run(() => api.del(`/expenses/${id}`), 'Expense deleted.');

  // ---------------------------------------------------------------- invoice template settings
  // The screen updates instantly; saving waits until you stop typing for a moment.
  const saveTimer = useRef(null);
  const pending = useRef({});
  const updateSettings = (patch) => {
    set((p) => ({ settings: { ...p.settings, ...patch } }));
    pending.current = { ...pending.current, ...patch };
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const body = pending.current;
      pending.current = {};
      api.put('/settings', body).catch((err) => toast(`Template not saved: ${err.message}`, 'error'));
    }, 700);
  };

  // ---------------------------------------------------------------- export
  const exportData = async (what, format) => {
    const { d: dd, s: cur } = ref.current;
    let rows = [];
    let name = what;
    if (what === 'invoices') {
      rows = dd.invs.map((i) => ({
        'Invoice no': i.no, Date: i.date, 'Due date': i.due, Customer: i.c.name, 'Customer GSTIN': i.c.gstin || 'Unregistered',
        'Place of supply': `${i.c.stateName} (${i.c.state})`, 'GST type': i.type === 'INTRA' ? 'CGST + SGST' : 'IGST',
        'Taxable value': i.t.taxable, CGST: i.t.cgst, SGST: i.t.sgst, IGST: i.t.igst, Total: i.t.total, Paid: i.paidAmt, 'Balance due': i.balance,
        Status: STATUS[i.ds]?.[0] || i.ds,
      }));
    } else if (what === 'pnl') {
      name = 'profit-and-loss';
      rows = dd.months.map((m) => ({ Month: monthLabel(m.key), 'Sales (taxable)': m.sales, 'Credit notes': m.creditTaxable, 'Net sales': m.netSales, Expenses: m.expenses, 'Profit / loss': m.profit }));
    } else if (what === 'gst') {
      name = 'gst-summary';
      rows = dd.months.map((m) => ({ Month: monthLabel(m.key), 'Output GST': m.outGst, 'Input credit': m.inGst, 'Net GST payable': m.gstPayable }));
    } else if (what === 'expenses') {
      rows = cur.expenses.map((e) => ({ Date: e.date, Category: e.category, 'Paid to': e.vendor, 'Amount (before GST)': e.amount, 'GST rate %': e.gstRate, 'GST paid (input credit)': r2((e.amount * e.gstRate) / 100) }));
    }
    if (!rows.length) return toast('There is nothing to export yet.', 'error');
    // File name includes today's date, e.g. invoices-2026-10-24.xlsx
    const file = `${name}-${todayIST()}.${format === 'excel' ? 'xlsx' : 'csv'}`;
    try {
      if (format === 'excel') await downloadXlsx(file, name, rows);
      else downloadCsv(file, rows);
      toast(`Downloaded ${file} (${rows.length} rows). Check your Downloads folder.`);
    } catch (err) {
      console.error(err);
      toast('Could not create the file. Please try again.', 'error');
    }
  };

  /** Saves an invoice as a PDF file (made in the browser). */
  const downloadPdf = async (no) => {
    const { d: dd, s: cur } = ref.current;
    const inv = dd.byNo[no];
    if (!inv) return;
    try {
      await downloadInvoicePdf(inv, cur.seller, cur.settings);
      toast(`Downloaded ${no}.pdf. Check your Downloads folder.`);
    } catch (err) {
      console.error(err);
      toast('Could not create the PDF. Please try again.', 'error');
    }
  };

  // ---------------------------------------------------------------- WhatsApp
  /** wa.me link with the invoice message for this customer. */
  const whatsappFor = (no, code, phone) => {
    const { s: cur, d: dd } = ref.current;
    return whatsappUrl(phone, shareMessage(dd.byNo[no], cur.seller, shareLink(window.location.origin, code)));
  };
  /**
   * WhatsApp button: records the share in the database, then opens WhatsApp with the message typed in.
   * If the customer's number is saved, their chat opens directly; if not, WhatsApp lets you pick the contact.
   * The new tab is opened straight away, inside the click, because browsers block tabs that open later.
   */
  const shareWhatsApp = async (no, phone) => {
    const inv = ref.current.d.byNo[no];
    if (!inv) return false;
    const win = window.open('', '_blank');
    const r = await run(() => api.post(`/invoices/${no}/share`, phone ? { phone } : {}));
    if (!r) { win?.close(); return false; }
    const url = whatsappFor(no, r.code, r.phone);
    if (win) { win.opener = null; win.location.href = url; } else window.location.href = url;
    set({ modal: null });
    toast(r.phone
      ? `WhatsApp opened with ${no} for ${r.customer}. Press Send there.`
      : `WhatsApp opened with ${no}. Pick ${r.customer}’s chat there and press Send. (Save their number in Customers to skip this.)`);
    return true;
  };

  // ---------------------------------------------------------------- assistant
  // Every message is shown at once and saved to the database in the background,
  // so the conversation is still there after logging in again.
  const setChat = (patch) => set((p) => ({ chat: { ...p.chat, ...(typeof patch === 'function' ? patch(p.chat) : patch) } }));
  const addMessages = (...msgs) => {
    setChat((c) => ({ messages: [...c.messages, ...msgs] }));
    api.post('/chat/messages', { messages: msgs }).catch(() => { /* chat still works, it just isn't saved */ });
  };
  const setStatus = (id, status) => {
    setChat((c) => ({ messages: c.messages.map((m) => (m.id === id ? { ...m, status } : m)) }));
    api.patch(`/chat/messages/${id}`, { status }).catch(() => {});
  };
  /** Loads the saved conversation. Old previews can't be confirmed any more (their token expires after 10 minutes). */
  const loadChat = () => api.get('/chat/messages')
    .then((saved) => setChat({ messages: [welcome, ...saved.map((m) => (['pending', 'saving'].includes(m.status) ? { ...m, status: 'expired' } : m))] }))
    .catch(() => {});

  /** The last few messages as plain text, so the AI remembers the conversation. */
  const historyForAI = () => ref.current.s.chat.messages
    .filter((m) => m.id !== welcome.id)
    .slice(-8)
    .map((m) => ({ role: m.from === 'user' ? 'user' : 'assistant', content: m.card ? `${m.text} [Preview: ${m.card.title}, ${m.status}]` : m.text }));

  const ask = async (text) => {
    const q = text.trim();
    if (!q || ref.current.s.chat.thinking) return;
    const history = historyForAI();
    addMessages({ id: msgId(), from: 'user', text: q });
    setChat({ text: '', thinking: true });
    const { s: cur, d: dd } = ref.current;
    let msg;
    try {
      const r = await api.post('/chat', { mode: cur.chat.mode, message: q, history });
      if (r.fallback) {
        // No AI available: use the built-in simple assistant
        msg = { ...offlineReply(q, { ...cur, chat: { ...cur.chat } }, dd), engine: 'Simple mode' };
      } else {
        msg = { text: r.text, card: r.card, token: r.token, status: r.card ? 'pending' : undefined, openNo: r.openNo, engine: r.engine, source: r.sources?.join(' · ') };
      }
    } catch (err) {
      msg = { text: err.status === 429 ? err.message : `Sorry, something went wrong: ${err.message}` };
    }
    addMessages({ id: msgId(), from: 'bot', ...msg });
    setChat({ thinking: false });
  };

  const confirmMsg = async (id) => {
    const msg = ref.current.s.chat.messages.find((m) => m.id === id);
    if (!msg || msg.status !== 'pending') return;
    setStatus(id, 'saving');
    try {
      // AI previews carry a signed token; simple-mode previews carry the action itself.
      const result = msg.token ? await api.post('/chat/confirm', { token: msg.token }) : await runOfflineAction(msg.action);
      await reload();
      setStatus(id, 'done');
      const whatsapp = result.share ? whatsappFor(result.share.no, result.share.code, result.share.phone) : undefined;
      addMessages({ id: msgId(), from: 'bot', text: result.text, openNo: result.openNo, whatsapp });
    } catch (err) {
      setStatus(id, 'pending');
      addMessages({ id: msgId(), from: 'bot', text: `That didn’t work: ${err.message}` });
    }
  };
  const cancelMsg = (id) => {
    setStatus(id, 'cancelled');
    addMessages({ id: msgId(), from: 'bot', text: 'Okay, cancelled. Nothing was changed.' });
  };

  const chat = {
    toggle: () => setChat((c) => ({ open: !c.open })),
    setMode: (mode) => setChat({ mode }),
    setText: (text) => setChat({ text }),
    send: () => ask(ref.current.s.chat.text),
    suggestions: (mode) => SUGGESTIONS[mode === 'write' && !ref.current.s.aiProviders?.length ? 'simpleWrite' : mode].map((text) => [text, () => ask(text)]),
    confirm: confirmMsg,
    cancel: cancelMsg,
    clear: () => {
      setChat({ text: '', messages: [welcome] });
      api.del('/chat/messages').catch((err) => toast(`Chat not cleared: ${err.message}`, 'error'));
    },
  };

  const actions = {
    set, toast, go, viewInvoice, newInvoice, newQuote, editInvoice, duplicateInvoice, editQuote, setForm, setItem, setItemUnit, pickProduct,
    addItem, removeItem, saveForm, askDeleteInvoice, openPayment, recordPayment, askMarkUnpaid, markSent, shareWhatsApp, openReminder, sendReminders,
    convertQuoteAndOpen, setQuoteStatus, askDeleteQuote, issueCreditNote, askDeleteCreditNote, saveCustomer, askDeleteCustomer, saveProduct,
    askDeleteProduct, addExpense, updateExpense, deleteExpense, updateSettings, exportData, downloadPdf, chat, login, signup, logout, loadSample,
  };

  return <AppCtx.Provider value={{ s, d, a: actions, seller: s.seller }}>{children}</AppCtx.Provider>;
}
