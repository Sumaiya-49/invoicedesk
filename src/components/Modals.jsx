import { useState } from 'react';
import { useApp } from '../store.jsx';
import { Modal, Button, Field, inputCls, cx } from './ui.jsx';
import { inr, fdate, TODAY } from '../lib/format.js';
import { normalizePhone } from '../lib/whatsapp.js';
import { STATES, stateName } from '../data/seed.js';
import { GST_RATES } from '../lib/gst.js';

export function Modals() {
  const { s, a } = useApp();
  const m = s.modal;
  if (!m) return null;
  const close = () => a.set({ modal: null });
  const C = { confirm: ConfirmModal, payment: PaymentModal, reminder: ReminderModal, customer: CustomerModal, product: ProductModal }[m.type];
  return C ? <C m={m} close={close} /> : null;
}

function ConfirmModal({ m, close }) {
  return (
    <Modal title={m.title} onClose={close} footer={<><Button onClick={close}>Keep it</Button><Button variant="danger" icon="trash" onClick={m.onConfirm}>{m.confirmLabel}</Button></>}>
      <p className="text-sm text-muted">{m.body}</p>
    </Modal>
  );
}

function PaymentModal({ m, close }) {
  const { d, a } = useApp();
  const inv = d.byNo[m.no];
  const [amount, setAmount] = useState(inv?.balance || 0);
  const [method, setMethod] = useState('upi');
  const [date, setDate] = useState(TODAY);
  if (!inv) return null;
  return (
    <Modal title={`Record payment on ${inv.no}`} onClose={close}
      footer={<><Button onClick={close}>Cancel</Button><Button variant="primary" onClick={() => a.recordPayment(inv.no, amount, method, date)}>Save payment</Button></>}>
      <div className="flex flex-col gap-4">
        <div className="flex justify-between rounded-xl bg-sunken p-3 text-sm"><span className="text-muted">{inv.c.name} · balance due</span><span className="font-semibold tabular-nums">{inr(inv.balance)}</span></div>
        <Field label="Amount received (₹)" id="pay-amt" hint={Number(amount) < inv.balance ? 'Less than the balance: the invoice becomes part paid.' : 'Full payment: the invoice becomes paid.'}>
          <input id="pay-amt" type="number" min="0" max={inv.balance} className={cx(inputCls, 'tabular-nums')} value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Method" id="pay-method">
            <select id="pay-method" className={inputCls} value={method} onChange={(e) => setMethod(e.target.value)}>
              {[['upi', 'UPI'], ['bank', 'Bank transfer'], ['cash', 'Cash'], ['cheque', 'Cheque'], ['card', 'Card']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </Field>
          <Field label="Received on" id="pay-date"><input id="pay-date" type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        </div>
      </div>
    </Modal>
  );
}

function ReminderModal({ m, close }) {
  const { d, a, seller } = useApp();
  const invs = m.nos.map((n) => d.byNo[n]).filter(Boolean);
  const first = invs[0];
  if (!first) return null;
  return (
    <Modal wide title={invs.length > 1 ? `Send ${invs.length} payment reminders` : `Send reminder for ${first.no}`} onClose={close}
      footer={<><Button onClick={close}>Cancel</Button><Button variant="primary" icon="send" onClick={() => a.sendReminders(invs.map((i) => i.no))}>{invs.length > 1 ? `Send ${invs.length} reminders` : 'Send reminder'}</Button></>}>
      <div className="flex flex-col gap-4">
        {invs.length > 1 && (
          <ul className="divide-y divide-line rounded-xl border border-line text-sm">
            {invs.map((i) => <li key={i.no} className="flex justify-between gap-3 px-3 py-2"><span><b className="tabular-nums">{i.no}</b> · {i.c.email}</span><span className="tabular-nums">{inr(i.balance)}</span></li>)}
          </ul>
        )}
        <div className="rounded-xl border border-line text-sm">
          <div className="border-b border-line px-4 py-3">
            <div><span className="text-muted">To </span>{first.c.email}</div>
            <div><span className="text-muted">Subject </span>Payment reminder: {first.no} for {inr(first.balance)}</div>
          </div>
          <div className="flex flex-col gap-3 px-4 py-3 leading-relaxed">
            <p>Dear {first.c.name},</p>
            <p>This is a friendly reminder that invoice {first.no} dated {fdate(first.date)} for {inr(first.t.total)} was due on {fdate(first.due)}. The balance of <b>{inr(first.balance)}</b> is still outstanding.</p>
            <p>The invoice PDF is attached. Please ignore this message if you have already paid.</p>
            <p>Regards,<br />{seller.name}</p>
          </div>
        </div>
        <p className="text-xs text-muted">{invs.length > 1 ? 'Each customer gets the same message with their own invoice details. ' : ''}In the full app this is sent by your backend email service.</p>
      </div>
    </Modal>
  );
}

function CustomerModal({ m, close }) {
  const { a, seller } = useApp();
  const [c, setC] = useState({ ...m.data, phone: m.data.phone || '' });
  const [phoneError, setPhoneError] = useState('');
  const upd = (patch) => setC((x) => ({ ...x, ...patch }));
  const save = () => {
    // The mobile number is optional, but if one is typed it must work on WhatsApp
    if (c.phone.trim() && !normalizePhone(c.phone)) { setPhoneError('Enter a 10-digit mobile number, or the full number with country code.'); return; }
    a.saveCustomer({ ...c, phone: c.phone.trim(), gstin: c.gstin.trim().toUpperCase(), stateName: stateName(c.state) });
  };
  return (
    <Modal title={c.id ? `Edit ${m.data.name}` : 'Add customer'} onClose={close}
      footer={<><Button onClick={close}>Cancel</Button><Button variant="primary" onClick={save}>{c.id ? 'Save changes' : 'Add customer'}</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Business name" id="c-name" className="sm:col-span-2"><input id="c-name" className={inputCls} value={c.name} onChange={(e) => upd({ name: e.target.value })} /></Field>
        <Field label="GSTIN" id="c-gstin" hint="Leave empty for unregistered buyers." className="sm:col-span-2">
          <input id="c-gstin" className={cx(inputCls, 'uppercase tabular-nums')} maxLength={15} placeholder="33AABCR1234K1Z5" value={c.gstin}
            onChange={(e) => { const v = e.target.value.toUpperCase(); upd({ gstin: v, ...(STATES.some((s) => s[0] === v.slice(0, 2)) ? { state: v.slice(0, 2) } : {}) }); }} />
        </Field>
        <Field label="State" id="c-state">
          <select id="c-state" className={inputCls} value={c.state} onChange={(e) => upd({ state: e.target.value })}>
            {STATES.map(([code, name]) => <option key={code} value={code}>{name} ({code})</option>)}
          </select>
        </Field>
        <Field label="City" id="c-city"><input id="c-city" className={inputCls} value={c.city} onChange={(e) => upd({ city: e.target.value })} /></Field>
        <Field label="Email" id="c-email"><input id="c-email" type="email" className={inputCls} value={c.email} onChange={(e) => upd({ email: e.target.value })} /></Field>
        <Field label="Mobile (WhatsApp)" id="c-phone"
          hint={phoneError ? <span className="font-medium text-danger">{phoneError}</span> : 'Invoices are sent to this number on WhatsApp.'}>
          <input id="c-phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="98400 12345" className={cx(inputCls, 'tabular-nums', phoneError && 'border-danger')}
            value={c.phone} onChange={(e) => { upd({ phone: e.target.value }); setPhoneError(''); }} />
        </Field>
        <p className="text-xs text-muted sm:col-span-2">{c.state === seller.state ? 'Same state as you, so invoices will charge CGST + SGST.' : 'Different state from you, so invoices will charge IGST.'}</p>
      </div>
    </Modal>
  );
}

function ProductModal({ m, close }) {
  const { a } = useApp();
  const [p, setP] = useState(m.data);
  const upd = (patch) => setP((x) => ({ ...x, ...patch }));
  return (
    <Modal title={p.id ? `Edit ${m.data.name}` : 'Add product or service'} onClose={close}
      footer={<><Button onClick={close}>Cancel</Button><Button variant="primary" onClick={() => a.saveProduct(p)}>{p.id ? 'Save changes' : 'Add product'}</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" id="p-name" className="sm:col-span-2"><input id="p-name" className={inputCls} value={p.name} onChange={(e) => upd({ name: e.target.value })} /></Field>
        <Field label="HSN/SAC code" id="p-hsn"><input id="p-hsn" className={cx(inputCls, 'tabular-nums')} value={p.hsn} onChange={(e) => upd({ hsn: e.target.value })} /></Field>
        <Field label="Unit" id="p-unit">
          <select id="p-unit" className={inputCls} value={p.unit} onChange={(e) => upd({ unit: e.target.value })}>{['Nos', 'Bag', 'Kg', 'Can', 'Hrs', 'Box', 'Mtr'].map((u) => <option key={u}>{u}</option>)}</select>
        </Field>
        <Field label="Price before GST (₹)" id="p-rate"><input id="p-rate" type="number" min="0" className={cx(inputCls, 'tabular-nums')} value={p.rate} onChange={(e) => upd({ rate: e.target.value })} /></Field>
        <Field label="GST rate" id="p-gst">
          <select id="p-gst" className={inputCls} value={p.gst} onChange={(e) => upd({ gst: Number(e.target.value) })}>{GST_RATES.map((r) => <option key={r} value={r}>{r}%</option>)}</select>
        </Field>
      </div>
    </Modal>
  );
}
