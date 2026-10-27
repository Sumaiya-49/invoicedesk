import './index.css';
import { createRoot } from 'react-dom/client';
import { AppProvider } from './store.jsx';
import App from './App.jsx';
import { SharedInvoice } from './pages/SharedInvoice.jsx';

// A customer opening the WhatsApp link (/?invoice=<code>) sees only that invoice, without logging in.
const shareCode = new URLSearchParams(window.location.search).get('invoice');

createRoot(document.getElementById('root')).render(
  shareCode
    ? <SharedInvoice code={shareCode} />
    : (
      <AppProvider>
        <App />
      </AppProvider>
    )
);
