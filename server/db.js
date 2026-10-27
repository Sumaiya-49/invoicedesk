import mysql from 'mysql2/promise';

// One small connection pool per server instance (Vercel reuses warm instances).
let pool;

function getPool() {
  if (!pool) {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set. Copy .env.example to .env and fill it in.');
    const url = new URL(process.env.DATABASE_URL);
    pool = mysql.createPool({
      host: url.hostname,
      port: Number(url.port || 3306),
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database: url.pathname.slice(1),
      // TiDB Cloud and most hosted MySQL need TLS. Set DB_SSL=false for MySQL on your own computer.
      ssl: process.env.DB_SSL === 'false' ? undefined : { minVersion: 'TLSv1.2', rejectUnauthorized: true },
      connectionLimit: 3,
      decimalNumbers: true, // DECIMAL columns come back as numbers, not strings
      dateStrings: true,    // DATE columns come back as 'YYYY-MM-DD'
      multipleStatements: process.env.DB_MULTI === 'true', // only the setup script needs this
    });
  }
  return pool;
}

// Columns added after the first version. On startup they are added to an older database automatically,
// so nobody has to run ALTER TABLE by hand. (A column that already exists is simply skipped.)
const LATER_COLUMNS = [
  ['customers', 'updated_at', 'TIMESTAMP NULL'],
  ['products', 'updated_at', 'TIMESTAMP NULL'],
  ['invoices', 'updated_at', 'TIMESTAMP NULL'],
  ['quotes', 'updated_at', 'TIMESTAMP NULL'],
  ['expenses', 'updated_at', 'TIMESTAMP NULL'],
  ['credit_notes', 'updated_at', 'TIMESTAMP NULL'],
  // WhatsApp sharing: the secret code in the customer's link, and when it was last shared
  ['invoices', 'share_code', 'VARCHAR(40) NULL'],
  ['invoices', 'shared_on', 'TIMESTAMP NULL'],
];
let upgraded;
function upgradeOnce() {
  upgraded ??= (async () => {
    for (const [table, column, type] of LATER_COLUMNS) {
      try {
        await getPool().query(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
        console.log(`Database upgraded: added ${table}.${column}`);
      } catch (err) {
        // 1060 = column already exists; 1146 = table not created yet (db:setup creates it with the column)
        if (![1060, 1146].includes(err.errno) && !/duplicate column|no such table/i.test(err.message)) throw err;
      }
    }
  })().catch((err) => { upgraded = undefined; throw err; });
  return upgraded;
}

/** Run one SQL statement. Values go in as ? placeholders, never pasted into the SQL (prevents SQL injection). */
export async function query(sql, params = []) {
  await upgradeOnce();
  const [rows] = await getPool().query(sql, params);
  return rows;
}

/** Run several statements so they all succeed or all fail together. */
export async function transaction(fn) {
  await upgradeOnce();
  const conn = await getPool().getConnection();
  const q = async (sql, params = []) => (await conn.query(sql, params))[0];
  try {
    await conn.beginTransaction();
    const result = await fn(q);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function closePool() {
  if (pool) await pool.end();
  pool = undefined;
}

/** JSON columns come back as objects from MySQL; this also accepts text. */
export const fromJson = (v, fallback = null) => {
  if (v == null) return fallback;
  if (typeof v === 'string') {
    try { return JSON.parse(v); } catch { return fallback; }
  }
  return v;
};
