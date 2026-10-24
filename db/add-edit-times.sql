-- The app now adds these columns by itself when it starts (server/db.js), so you normally don't need this file.
-- Run this ONCE on a database created before "last edited" times were added.
-- (A fresh `npm run db:setup` already has these columns, so it doesn't need this.)
-- In MySQL Workbench: open a new query tab, choose the invoicedesk database, paste this, and run it.
ALTER TABLE customers ADD COLUMN updated_at TIMESTAMP NULL;
ALTER TABLE products ADD COLUMN updated_at TIMESTAMP NULL;
ALTER TABLE invoices ADD COLUMN updated_at TIMESTAMP NULL;
ALTER TABLE quotes ADD COLUMN updated_at TIMESTAMP NULL;
ALTER TABLE expenses ADD COLUMN updated_at TIMESTAMP NULL;
ALTER TABLE credit_notes ADD COLUMN updated_at TIMESTAMP NULL;
