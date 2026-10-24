// Creates all tables and loads the sample business.  Run: npm run db:setup
// WARNING: this deletes existing data in these tables.
import fs from 'node:fs';
import { query, closePool } from '../server/db.js';
import { hashPassword } from '../server/auth.js';
import { loadSampleData } from '../server/services/account.js';
import { seed, SELLER } from '../src/data/seed.js';

export const DEMO_LOGIN = { email: 'owner@sumaiyatraders.in', password: 'demo1234' };

async function main() {
  // Run schema.sql one statement at a time
  const sql = fs.readFileSync(new URL('./schema.sql', import.meta.url), 'utf8')
    .split('\n').filter((line) => !line.trim().startsWith('--')).join('\n');
  for (const statement of sql.split(';').map((s) => s.trim()).filter(Boolean)) {
    await query(statement);
  }
  console.log('Tables created');

  const r = await query(
    'INSERT INTO users (owner_name, email, password_hash, business_name, gstin, state_code, address, settings) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    ['Sumaiya', DEMO_LOGIN.email, await hashPassword(DEMO_LOGIN.password), SELLER.name, SELLER.gstin, SELLER.state, SELLER.address,
      JSON.stringify(seed().settings)]
  );
  await loadSampleData(r.insertId);
  console.log(`Sample data loaded. Log in with ${DEMO_LOGIN.email} / ${DEMO_LOGIN.password}`);
}

main()
  .catch((err) => { console.error('Setup failed:', err.message); process.exitCode = 1; })
  .finally(closePool);
