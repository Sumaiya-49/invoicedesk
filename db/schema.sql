-- InvoiceDesk database schema (MySQL 8 / TiDB Cloud)
-- Run with: npm run db:setup   (creates the tables and loads the sample data)
-- Times (created_at, updated_at) are saved by the app in Indian time (IST).

DROP TABLE IF EXISTS chat_messages;
DROP TABLE IF EXISTS expenses;
DROP TABLE IF EXISTS credit_notes;
DROP TABLE IF EXISTS quotes;
DROP TABLE IF EXISTS payments;
DROP TABLE IF EXISTS invoice_items;
DROP TABLE IF EXISTS invoices;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS customers;
DROP TABLE IF EXISTS users;

-- One user = one business. Every other table has user_id so each business only sees its own data.
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  owner_name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(100) NOT NULL,
  business_name VARCHAR(150) NOT NULL,
  gstin VARCHAR(15),
  state_code CHAR(2) NOT NULL,
  address VARCHAR(255),
  settings JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE customers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  name VARCHAR(150) NOT NULL,
  email VARCHAR(150),
  phone VARCHAR(20),
  gstin VARCHAR(15),
  state_code CHAR(2) NOT NULL,
  city VARCHAR(80),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL,                  -- when it was last edited (empty = never edited)
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  name VARCHAR(150) NOT NULL,
  hsn_sac VARCHAR(10),
  unit VARCHAR(20) NOT NULL DEFAULT 'Nos',
  price DECIMAL(12,2) NOT NULL,
  gst_rate DECIMAL(5,2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Totals are stored so lists and reports are fast; they are always calculated by the GST engine (src/lib/gst.js).
CREATE TABLE invoices (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  invoice_no VARCHAR(20) NOT NULL,
  customer_id INT NOT NULL,
  invoice_date DATE NOT NULL,
  due_date DATE,
  supply_type VARCHAR(5) NOT NULL,            -- INTRA (CGST + SGST) or INTER (IGST)
  supply_type_override VARCHAR(5),            -- set only when the user overrides auto-detection
  taxable_total DECIMAL(14,2) NOT NULL DEFAULT 0,
  cgst_total DECIMAL(14,2) NOT NULL DEFAULT 0,
  sgst_total DECIMAL(14,2) NOT NULL DEFAULT 0,
  igst_total DECIMAL(14,2) NOT NULL DEFAULT 0,
  grand_total DECIMAL(14,2) NOT NULL DEFAULT 0,
  amount_paid DECIMAL(14,2) NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'draft', -- draft, sent, partially_paid, paid, cancelled
  notes VARCHAR(500),
  from_quote VARCHAR(20),
  last_reminder_on DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL,
  UNIQUE (user_id, invoice_no),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);

-- Each line keeps a copy of the product details, so old invoices don't change if a product is edited later.
CREATE TABLE invoice_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  invoice_id INT NOT NULL,
  product_id INT,
  description VARCHAR(255) NOT NULL,
  hsn_sac VARCHAR(10),
  unit VARCHAR(20) NOT NULL DEFAULT 'Nos',
  qty DECIMAL(12,3) NOT NULL,
  rate DECIMAL(12,2) NOT NULL,
  discount_pct DECIMAL(5,2) NOT NULL DEFAULT 0,
  gst_rate DECIMAL(5,2) NOT NULL,
  taxable_value DECIMAL(14,2) NOT NULL,
  cgst DECIMAL(14,2) NOT NULL DEFAULT 0,
  sgst DECIMAL(14,2) NOT NULL DEFAULT 0,
  igst DECIMAL(14,2) NOT NULL DEFAULT 0,
  amount DECIMAL(14,2) NOT NULL,
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
);

CREATE TABLE payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  invoice_id INT NOT NULL,
  amount DECIMAL(14,2) NOT NULL,
  method VARCHAR(10) NOT NULL DEFAULT 'upi',
  paid_on DATE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
);

-- Quotation line items are stored as JSON: a quote is only a proposal and is never used in tax totals.
CREATE TABLE quotes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  quote_no VARCHAR(20) NOT NULL,
  customer_id INT NOT NULL,
  quote_date DATE NOT NULL,
  valid_until DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'draft', -- draft, sent, accepted, converted
  supply_type_override VARCHAR(5),
  items JSON NOT NULL,
  notes VARCHAR(500),
  invoice_no VARCHAR(20),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL,
  UNIQUE (user_id, quote_no),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);

CREATE TABLE credit_notes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  cn_no VARCHAR(20) NOT NULL,
  cn_date DATE NOT NULL,
  invoice_no VARCHAR(20) NOT NULL,
  customer_id INT NOT NULL,
  supply_type VARCHAR(5) NOT NULL,
  item JSON NOT NULL,
  qty DECIMAL(12,3) NOT NULL,
  reason VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL,
  UNIQUE (user_id, cn_no),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE expenses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  expense_date DATE NOT NULL,
  category VARCHAR(40) NOT NULL,
  vendor VARCHAR(150) NOT NULL,
  amount DECIMAL(14,2) NOT NULL,
  gst_rate DECIMAL(5,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Assistant conversation, so earlier chats are still there after logging in again.
-- Extra details (preview card, table, which AI answered) are kept as JSON in "meta".
CREATE TABLE chat_messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  msg_id VARCHAR(40) NOT NULL,
  sender VARCHAR(10) NOT NULL,                -- user or bot
  text TEXT NOT NULL,
  meta JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, msg_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_customers_user ON customers(user_id);
CREATE INDEX idx_products_user ON products(user_id);
CREATE INDEX idx_invoices_user ON invoices(user_id, invoice_date);
CREATE INDEX idx_items_invoice ON invoice_items(invoice_id);
CREATE INDEX idx_payments_invoice ON payments(invoice_id);
CREATE INDEX idx_quotes_user ON quotes(user_id);
CREATE INDEX idx_expenses_user ON expenses(user_id, expense_date);
CREATE INDEX idx_chat_user ON chat_messages(user_id, id);
