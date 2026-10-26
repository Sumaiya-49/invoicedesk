import { useState } from 'react';
import { useApp } from '../store.jsx';
import { Field, Icon, Segmented, inputCls, cx } from '../components/ui.jsx';
import { STATES } from '../data/seed.js';

const DEMO = { email: 'owner@sumaiyatraders.in', password: 'demo1234' };

const FEATURES = [
    ['rupee', 'GST worked out for you', 'CGST + SGST or IGST, picked from your customer’s state.'],
    ['sparkle', 'An assistant that knows your books', 'Ask who owes you, or tell it to create an invoice.'],
    ['chart', 'Profit and GST at a glance', 'Monthly P&L and GST payable, ready for your CA.'],
];

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
        <div className="grid min-h-screen bg-bg lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
            {/* Brand panel (large screens) */}
            <aside className="relative hidden flex-col overflow-hidden bg-side px-12 py-12 text-white lg:flex">
                <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-accent/25 blur-3xl" aria-hidden="true" />
                <div className="relative flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-accent-ink"><Icon name="rupee" size={22} stroke={2.4} /></div>
                    <span className="font-display text-2xl font-bold">InvoiceDesk</span>
                </div>

                <div className="relative my-auto flex max-w-md flex-col gap-10">
                    <h1 className="font-display text-[44px] font-semibold leading-[1.08] text-balance">GST invoicing that answers back.</h1>
                    <ul className="flex flex-col gap-6">
                        {FEATURES.map(([icon, title, body]) => (
                            <li key={title} className="flex gap-4">
                                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-[#9FD8BF]"><Icon name={icon} size={19} /></span>
                                <span>
                  <span className="block font-semibold">{title}</span>
                  <span className="mt-0.5 block text-sm leading-relaxed text-side-ink">{body}</span>
                </span>
                            </li>
                        ))}
                    </ul>
                </div>
            </aside>

            {/* Form */}
            <main className="gutter flex items-center justify-center py-10">
                <div className="flex w-full max-w-[420px] flex-col gap-7">
                    <div className="flex items-center gap-2.5 lg:hidden">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-accent-ink"><Icon name="rupee" size={20} stroke={2.4} /></div>
                        <span className="font-display text-xl font-bold">InvoiceDesk</span>
                    </div>

                    <div>
                        <h2 className="font-display text-3xl font-semibold text-balance">{signup ? 'Create your account' : 'Welcome back'}</h2>
                        <p className="mt-2 text-[15px] text-muted">{signup ? 'Set up your business once. Your state decides how GST is charged.' : 'Log in to see your invoices, payments and reports.'}</p>
                    </div>

                    <Segmented label="Log in or sign up" value={mode} onChange={setMode} options={[['login', 'Log in'], ['signup', 'Sign up']]} className="w-full" stretch />

                    <form className="flex flex-col gap-4" onSubmit={submit}>
                        {signup && (
                            <div className="grid gap-4 sm:grid-cols-2">
                                <Field label="Your name" id="su-name"><input id="su-name" className={inputCls} required autoComplete="name" value={f.ownerName} onChange={(e) => upd({ ownerName: e.target.value })} /></Field>
                                <Field label="Business name" id="su-biz"><input id="su-biz" className={inputCls} required autoComplete="organization" value={f.businessName} onChange={(e) => upd({ businessName: e.target.value })} /></Field>
                                <Field label="State" id="su-state">
                                    <select id="su-state" className={inputCls} value={f.state} onChange={(e) => upd({ state: e.target.value })}>
                                        {STATES.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
                                    </select>
                                </Field>
                                <Field label="GSTIN (optional)" id="su-gstin">
                                    <input id="su-gstin" className={cx(inputCls, 'uppercase tabular-nums')} maxLength={15} placeholder="33AAACS1111A1Z3" value={f.gstin} onChange={(e) => upd({ gstin: e.target.value.toUpperCase() })} />
                                </Field>
                            </div>
                        )}
                        <Field label="Email" id="login-email">
                            <input id="login-email" type="email" required autoComplete="email" placeholder="you@business.in" className={inputCls} value={f.email} onChange={(e) => upd({ email: e.target.value })} />
                        </Field>
                        <Field label="Password" id="login-pass" hint={signup ? 'At least 6 characters.' : undefined}>
                            <div className="relative">
                                <input id="login-pass" type={showPass ? 'text' : 'password'} required autoComplete={signup ? 'new-password' : 'current-password'}
                                       className={cx(inputCls, 'pr-16')} value={f.password} onChange={(e) => upd({ password: e.target.value })} />
                                <button type="button" onClick={() => setShowPass((v) => !v)} aria-pressed={showPass}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-xs font-semibold text-muted hover:text-ink cursor-pointer">
                                    {showPass ? 'Hide' : 'Show'}
                                </button>
                            </div>
                        </Field>
                        <button type="submit" disabled={busy}
                                className="mt-1 inline-flex h-12 items-center justify-center rounded-xl bg-accent px-4 text-[15px] font-semibold text-accent-ink shadow-sm hover:brightness-110 disabled:opacity-60 cursor-pointer">
                            {busy ? 'Please wait…' : signup ? 'Create account' : 'Log in'}
                        </button>
                    </form>

                    {!signup && (
                        <div className="flex items-center gap-3 rounded-xl border border-dashed border-line px-4 py-3">
                            <Icon name="lock" size={16} className="text-muted" />
                            <div className="min-w-0 flex-1 text-[13px] leading-snug">
                                <div className="font-semibold">Trying it out?</div>
                                <div className="truncate text-muted">{DEMO.email} · {DEMO.password}</div>
                            </div>
                            <button type="button" onClick={() => upd(DEMO)} className="shrink-0 rounded-lg px-2.5 py-1.5 text-[13px] font-semibold text-accent hover:bg-accent-soft cursor-pointer">Fill in</button>
                        </div>
                    )}

                    <p className="text-center text-sm text-muted">
                        {signup ? 'Already have an account? ' : 'New to InvoiceDesk? '}
                        <button type="button" onClick={() => setMode(signup ? 'login' : 'signup')} className="font-semibold text-accent hover:underline cursor-pointer">
                            {signup ? 'Log in' : 'Create an account'}
                        </button>
                    </p>
                </div>
            </main>
        </div>
    );
}