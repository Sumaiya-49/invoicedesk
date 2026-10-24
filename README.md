# InvoiceDesk

GST invoicing web app with an AI assistant.

- **Invoices with GST**: CGST + SGST when the customer is in your state, IGST when they're in another state (auto-detected, can be overridden)
- **Full CRUD** for customers, products, invoices, quotations, credit notes and expenses
- **Payments** (full or partial), payment reminders, quotation → invoice conversion
- **Reports**: monthly profit & loss and GST summary (output GST − input credit), CSV export
- **Invoice template**: logo, brand colour, layout, terms
- **AI assistant** with two modes:
  - **Read**: answers questions from your own records ("who owes me money?", "GST in August?")
  - **Write**: creates, updates and deletes records for you. Every change shows a preview and is saved only after you click **Confirm**

## Tech stack

| Part | Tech |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS |
| Backend | Node.js, Express (runs as a Vercel serverless function) |
| Database | MySQL (TiDB Cloud free tier works) |
| Auth | bcrypt password hashing, JWT login tokens |
| Validation | Zod |
| AI | Groq (`openai/gpt-oss-120b`) with Google Gemini as backup, using tool calling |

## Project structure

```
api/index.js              Vercel entry point for /api/*
server/
  app.js                  Express app: routes + error handling
  db.js                   MySQL connection pool and transactions
  auth.js                 Password hashing, login tokens, assistant confirm tokens
  validation.js           Zod schemas for every request
  routes/                 One file per feature (URLs)
  services/               One file per feature (database logic)
  ai/
    assistant.js          The assistant loop (AI -> tools -> answer or preview)
    llm.js                Calls Groq, falls back to Gemini
    tools.js              Tools the AI may call (read + write)
    readTools.js          Runs read tools on the user's data
    writeTools.js         Builds previews; runs changes after Confirm
    lookup.js             Turns names like "kaveri" into real records
    prompt.js             Instructions given to the AI
db/
  schema.sql              Tables
  setup.js                Creates tables and loads the sample business
src/
  lib/gst.js              GST engine (used by frontend AND backend)
  lib/derive.js           Balances, statuses, monthly P&L and GST (frontend AND backend)
  api.js                  Frontend -> backend calls
  store.jsx               App state and actions
  assistant/offlineAssistant.js   Keyword assistant used when no AI key is set
  pages/, components/     Screens and UI pieces
```

## How the AI assistant works

1. The user's message and a list of **tools** (functions) are sent to the AI.
2. The AI picks a tool, e.g. `search_invoices({ status: "unpaid" })`. It never touches the database itself.
3. The backend runs that tool **only on the logged-in user's data** and sends the result back.
4. The AI writes the answer from that result.
5. For changes (Write mode), the backend builds a **preview card** and a signed token instead of saving. The change runs only when the user clicks **Confirm**.

In Read mode the AI isn't given any write tools at all. If no AI key is set, or the AI is unavailable, the app uses a built-in keyword assistant, so the chat keeps working.

## Run it locally

You need **Node.js 20.6+** and a MySQL database.

1. **Database**: create a free cluster at [tidbcloud.com](https://tidbcloud.com) (MySQL-compatible). Click **Connect**, create a password and copy the connection details. In the SQL editor, run `CREATE DATABASE invoicedesk;`
2. **Settings**: copy `.env.example` to `.env` (Windows: `copy .env.example .env`) and fill in:
   - `DATABASE_URL=mysql://USER:PASSWORD@HOST:4000/invoicedesk`
   - `JWT_SECRET`: any long random text. Generate one with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
   - `GROQ_API_KEY` from [console.groq.com](https://console.groq.com) (free), and optionally `GEMINI_API_KEY` from [aistudio.google.com](https://aistudio.google.com)
3. Install and create the tables with sample data:
   ```bash
   npm install
   npm run db:setup
   ```
4. Start the backend and the frontend in **two terminals**:
   ```bash
   npm run dev:api     # backend on http://localhost:3001
   npm run dev         # frontend on http://localhost:5173
   ```
5. Open http://localhost:5173 and log in with the demo account: **owner@sumaiyatraders.in / demo1234**

## Deploy to Vercel

1. Push to GitHub and import the repository in Vercel (framework: Vite).
2. In **Settings → Environment Variables**, add `DATABASE_URL`, `JWT_SECRET`, `GROQ_API_KEY` and `GEMINI_API_KEY`.
3. Deploy. The React app and the `/api` backend are served from the same domain.

## Notes

- Payment reminder emails are not sent yet; the reminder date is recorded on the invoice.
- Free AI tiers have daily limits and may use prompts to improve their models. Use sample data, or a paid tier for real business data.
- The assistant is limited to 40 messages per user per hour to protect the free AI quota.
