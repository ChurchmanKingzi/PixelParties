// ═══════════════════════════════════════════
//  DATABASE ABSTRACTION LAYER
//  Uses @libsql/client for both local SQLite
//  (development) and Turso (production).
//  
//  Environment variables:
//    TURSO_DATABASE_URL  — libsql://your-db.turso.io
//    TURSO_AUTH_TOKEN    — your Turso auth token
//  
//  If not set, falls back to local file:data/pixel-parties.db
// ═══════════════════════════════════════════

const { createClient } = require('@libsql/client');
const path = require('path');
const fs = require('fs');

const isRemote = !!(process.env.TURSO_DATABASE_URL && process.env.TURSO_AUTH_TOKEN);

let client;

if (isRemote) {
  console.log('[DB] Connecting to Turso remote database...');
  client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
} else {
  const dbDir = path.join(__dirname, 'data');
  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
  const dbPath = path.join(dbDir, 'pixel-parties.db');
  console.log(`[DB] Using local SQLite at: ${dbPath}`);
  client = createClient({ url: `file:${dbPath}` });
}

/**
 * Execute a SQL statement (INSERT/UPDATE/DELETE).
 * @param {string} sql - SQL query with ? placeholders
 * @param {Array} args - Parameter values
 * @returns {Promise<{rowsAffected: number, lastInsertRowid: number}>}
 */
async function run(sql, args = []) {
  const result = await client.execute({ sql, args });
  return { rowsAffected: result.rowsAffected, lastInsertRowid: result.lastInsertRowid };
}

/**
 * Query a single row.
 * @param {string} sql - SQL query with ? placeholders
 * @param {Array} args - Parameter values
 * @returns {Promise<Object|undefined>} Row object or undefined
 */
async function get(sql, args = []) {
  const result = await client.execute({ sql, args });
  return result.rows[0] || undefined;
}

/**
 * Query all matching rows.
 * @param {string} sql - SQL query with ? placeholders
 * @param {Array} args - Parameter values
 * @returns {Promise<Array<Object>>} Array of row objects
 */
async function all(sql, args = []) {
  const result = await client.execute({ sql, args });
  return result.rows;
}

/**
 * Execute raw SQL (DDL, multi-statement). For table creation etc.
 * Splits on semicolons and executes each statement.
 * @param {string} sql - One or more SQL statements separated by ;
 */
async function execute(sql) {
  // Split on semicolons, trim, filter empty
  const statements = sql.split(';').map(s => s.trim()).filter(s => s.length > 0);
  for (const stmt of statements) {
    await client.execute(stmt);
  }
}

/**
 * Execute a batch of operations in a transaction.
 * @param {Function} fn - async function receiving the db helpers
 */
async function transaction(fn) {
  const tx = await client.transaction('write');
  try {
    const txHelpers = {
      run: async (sql, args = []) => tx.execute({ sql, args }),
      get: async (sql, args = []) => { const r = await tx.execute({ sql, args }); return r.rows[0] || undefined; },
      all: async (sql, args = []) => { const r = await tx.execute({ sql, args }); return r.rows; },
    };
    await fn(txHelpers);
    await tx.commit();
  } catch (err) {
    await tx.rollback();
    throw err;
  }
}

module.exports = { run, get, all, execute, transaction, client, isRemote };
