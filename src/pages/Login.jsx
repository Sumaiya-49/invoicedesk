import { useState } from 'react';
import { useApp } from '../store.jsx';
import { Icon } from '../components/ui.jsx';
import { STATES } from '../data/seed.js';

const DEMO = { email: 'owner@sumaiyatraders.in', password: 'demo1234' };

/** A rounded input with a hidden label (the placeholder shows what to type). */
function NeonInput({ id, label, className = '', ...props }) {
  return (
    <div className={className}>
      <label htmlFor={id} className="sr-only">{label}</label>
      <input id={id} placeholder={label} className="neon-input" {...props} />
    </div>
  );
}

/** Animated GST graphics on both sides of the login (large screens only, decorative). */
function SideGraphics() {
  return (
    <>
      <div className="neon-side neon-side-left" aria-hidden="true">
        {['₹', '₹', '₹', '₹', '₹', '₹'].map((r, i) => <span key={i} className={`neon-rupee neon-rupee-${i + 1}`}>{r}</span>)}
        <div className="neon-invoice">
          <div className="neon-invoice-head"><span>TAX INVOICE</span><b>INV-0014</b></div>
          <div className="neon-invoice-meta">Chennai (33) → Chennai (33)</div>
          {[['Steel Rod 12mm × 20', '₹13,000'], ['PVC Pipe × 10', '₹3,100'], ['Installation × 2', '₹3,000']].map(([k, v]) => (
            <div key={k} className="neon-invoice-row"><span>{k}</span><span>{v}</span></div>
          ))}
          <div className="neon-invoice-line" />
          <div className="neon-invoice-row neon-green"><span>CGST 9%</span><span>₹1,719</span></div>
          <div className="neon-invoice-row neon-green"><span>SGST 9%</span><span>₹1,719</span></div>
          <div className="neon-invoice-total"><span>Total</span><span>₹22,538</span></div>
          <div className="neon-invoice-stamp">PAID</div>
        </div>
      </div>

      <div className="neon-side neon-side-right" aria-hidden="true">
        <span className="neon-tag neon-tag-1">IGST 18%</span>
        <span className="neon-tag neon-tag-2">HSN 7214</span>
        <span className="neon-tag neon-tag-3">CGST + SGST</span>
        <svg className="neon-donut" viewBox="0 0 160 160">
          <circle cx="80" cy="80" r="58" className="neon-donut-track" />
          <circle cx="80" cy="80" r="58" className="neon-arc neon-arc-1" />
          <circle cx="80" cy="80" r="58" className="neon-arc neon-arc-2" />
          <circle cx="80" cy="80" r="58" className="neon-arc neon-arc-3" />
          <text x="80" y="76" textAnchor="middle" className="neon-donut-label">GST</text>
          <text x="80" y="98" textAnchor="middle" className="neon-donut-value">18%</text>
        </svg>
        <div className="neon-bars">
          {[['Aug', 62], ['Sep', 88], ['Oct', 74], ['Nov', 96]].map(([m, h], i) => (
            <div key={m} className="neon-bar-col">
              <div className={`neon-bar neon-bar-${i + 1}`} style={{ height: `${h}%` }} />
              <span>{m}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

export function Login() {
  const { a } = useApp();
  const [mode, setMode] = useState('login');
  const [busy, setBusy] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [f, setF] = useState({ email: '', password: '', ownerName: '', businessName: '', state: '33', gstin: '' });
  const upd = (patch) => setF((x) => ({ ...x, ...patch }));
  const signup = mode === 'signup';

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    if (signup) await a.signup({ ownerName: f.ownerName, businessName: f.businessName, email: f.email, password: f.password, state: f.state, gstin: f.gstin });
    else await a.login(f.email, f.password);
    setBusy(false);
  };

  return (
    <div className="neon-page">
      <SideGraphics />
      <div className={`neon-stage ${signup ? 'neon-stage-wide' : ''}`}>
        {/* Three glowing rings rotating at different speeds */}
        <i className="neon-ring" style={{ '--c': '#ff3d7f' }} aria-hidden="true" />
        <i className="neon-ring" style={{ '--c': '#3dff6e' }} aria-hidden="true" />
        <i className="neon-ring" style={{ '--c': '#fff15c' }} aria-hidden="true" />

        <form className="neon-form" onSubmit={submit}>
          <div className="neon-brand">
            <span className="neon-brand-icon"><Icon name="rupee" size={20} stroke={2.4} /></span>
            InvoiceDesk
          </div>
          <div className="text-center">
            <h1 className="font-display text-3xl font-medium text-white">{signup ? 'Sign up' : 'Login'}</h1>
            <p className="mt-1.5 text-sm text-white/55">GST invoicing with an AI assistant</p>
          </div>

          {signup && (
            <div className="grid gap-3.5 sm:grid-cols-2">
              <NeonInput id="su-name" label="Your name" required autoComplete="name" value={f.ownerName} onChange={(e) => upd({ ownerName: e.target.value })} />
              <NeonInput id="su-biz" label="Business name" required autoComplete="organization" value={f.businessName} onChange={(e) => upd({ businessName: e.target.value })} />
              <div>
                <label htmlFor="su-state" className="sr-only">State</label>
                <select id="su-state" className="neon-input" value={f.state} onChange={(e) => upd({ state: e.target.value })}>
                  {STATES.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
                </select>
              </div>
              <NeonInput id="su-gstin" label="GSTIN (optional)" maxLength={15} value={f.gstin} onChange={(e) => upd({ gstin: e.target.value.toUpperCase() })} />
            </div>
          )}

          <NeonInput id="login-email" label="Email" type="email" required autoComplete="email" value={f.email} onChange={(e) => upd({ email: e.target.value })} />
          <div className="relative">
            <NeonInput id="login-pass" label={signup ? 'Password (6+ characters)' : 'Password'} type={showPass ? 'text' : 'password'} required
              autoComplete={signup ? 'new-password' : 'current-password'} value={f.password} onChange={(e) => upd({ password: e.target.value })} />
            <button type="button" onClick={() => setShowPass((v) => !v)} aria-pressed={showPass}
              className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full px-2 py-1 text-xs font-semibold text-white/60 hover:text-white cursor-pointer">
              {showPass ? 'Hide' : 'Show'}
            </button>
          </div>

          <button type="submit" disabled={busy} className="neon-button">
            {busy ? 'Please wait…' : signup ? 'Create account' : 'Sign in'}
          </button>

          <div className="flex items-center justify-between gap-3 px-1 text-sm">
            {!signup
              ? <button type="button" onClick={() => upd(DEMO)} className="text-white/75 hover:text-white cursor-pointer">Use demo account</button>
              : <span className="text-white/60">Have an account?</span>}
            <button type="button" onClick={() => setMode(signup ? 'login' : 'signup')} className="font-semibold text-white/90 hover:text-[#3dff6e] cursor-pointer">
              {signup ? 'Login' : 'Signup'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
