import express from 'express';
import { requireLogin } from './auth.js';
import authRoutes from './routes/auth.js';
import accountRoutes from './routes/account.js';
import customerRoutes from './routes/customers.js';
import productRoutes from './routes/products.js';
import invoiceRoutes from './routes/invoices.js';
import quoteRoutes from './routes/quotes.js';
import creditNoteRoutes from './routes/creditNotes.js';
import expenseRoutes from './routes/expenses.js';
import chatRoutes from './routes/chat.js';
import { handle } from './errors.js';
import { getSharedInvoice } from './services/sharing.js';

const app = express();
app.use(express.json({ limit: '2mb' })); // 2 MB so a logo image fits in the template settings

app.get('/api/health', (_req, res) => res.json({ ok: true }));

// Public routes
app.use('/api/auth', authRoutes);
// The invoice link sent to a customer on WhatsApp. No login: the long random code is the key, and it shows only that invoice.
app.get('/api/public/invoice/:code', handle(async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json(await getSharedInvoice(req.params.code));
}));

// Everything below needs a logged-in user (sets req.userId)
app.use('/api/customers', requireLogin, customerRoutes);
app.use('/api/products', requireLogin, productRoutes);
app.use('/api/invoices', requireLogin, invoiceRoutes);
app.use('/api/quotes', requireLogin, quoteRoutes);
app.use('/api/credit-notes', requireLogin, creditNoteRoutes);
app.use('/api/expenses', requireLogin, expenseRoutes);
app.use('/api/chat', requireLogin, chatRoutes);
app.use('/api', requireLogin, accountRoutes);

app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

// One place that turns errors into JSON responses.
// Expected errors (wrong input, not found) show their message; unexpected ones are logged and hidden.
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'That upload is too large' });
  if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'That number already exists. Please try again.' });
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: status >= 500 ? 'Something went wrong on the server. Please try again.' : err.message });
});

export default app;
