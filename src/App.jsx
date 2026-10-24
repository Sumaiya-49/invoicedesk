import { useEffect } from 'react';
import { useApp } from './store.jsx';
import { installEffects } from './lib/effects.js';
import { Sidebar, Topbar, Toast, Backdrop } from './components/Shell.jsx';
import { Assistant } from './components/Assistant.jsx';
import { Modals } from './components/Modals.jsx';
import { Dashboard } from './pages/Dashboard.jsx';
import { Invoices, Quotes } from './pages/Invoices.jsx';
import { DocForm } from './pages/DocForm.jsx';
import { InvoiceView } from './pages/InvoiceView.jsx';
import { CreditNotes, Customers, Products, Expenses } from './pages/Records.jsx';
import { Reports, Settings } from './pages/Insights.jsx';
import { Login } from './pages/Login.jsx';

const PAGES = {
  dashboard: Dashboard, invoices: Invoices, quotes: Quotes, form: DocForm, invoice: InvoiceView, credits: CreditNotes,
  customers: Customers, products: Products, expenses: Expenses, reports: Reports, settings: Settings,
};

export default function App() {
  const { s } = useApp();
  useEffect(installEffects, []);
  if (s.screen === 'loading') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 text-muted" role="status">
        <span className="fx-typing flex gap-1.5" aria-hidden="true"><i /><i /><i /></span>Loading your books…
      </div>
    );
  }
  if (s.screen === 'login' || !s.seller) return <><Login /><Toast /></>;
  const Page = PAGES[s.screen] || Dashboard;
  return (
    <div className="flex min-h-screen bg-bg text-ink">
      <Backdrop />
      <Sidebar />
      <div className="relative z-[1] flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="gutter flex-1 pb-28 pt-6">
          <div className="mx-auto w-full max-w-[1320px]" key={s.screen + (s.viewNo || '')}><Page /></div>
        </main>
      </div>
      <Assistant />
      <Modals />
      <Toast />
    </div>
  );
}
