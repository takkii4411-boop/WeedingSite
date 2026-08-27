/* ==========================================================================
   DATABASE — Turso (libSQL) for production, SQLite file for local dev.
   All queries are async. Routes call db.execute() / db.batch() etc.
   ========================================================================== */
const { createClient } = require('@libsql/client');
const bcrypt = require('bcryptjs');

const db = createClient({
  url: process.env.TURSO_DATABASE_URL || 'file:local.db',
  authToken: process.env.TURSO_AUTH_TOKEN || undefined,
});

async function init() {
  await db.batch([
    `CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT,
      event_type TEXT,
      event_date TEXT,
      location TEXT,
      budget TEXT,
      guests TEXT,
      message TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS site_content (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS site_media (
      slot TEXT PRIMARY KEY,
      cloudinary_id TEXT,
      url TEXT NOT NULL,
      resource_type TEXT NOT NULL DEFAULT 'image',
      original_name TEXT,
      storage_backend TEXT DEFAULT 'telegram',
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS client_galleries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_name TEXT NOT NULL,
      client_email TEXT,
      client_phone TEXT,
      event_type TEXT,
      event_date TEXT,
      location TEXT,
      slug TEXT UNIQUE NOT NULL,
      cover_url TEXT,
      description TEXT,
      is_public INTEGER NOT NULL DEFAULT 1,
      storage_backend TEXT NOT NULL DEFAULT 'telegram',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS client_gallery_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      gallery_id INTEGER NOT NULL,
      url TEXT NOT NULL,
      storage_id TEXT,
      storage_backend TEXT DEFAULT 'telegram',
      original_name TEXT,
      caption TEXT,
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (gallery_id) REFERENCES client_galleries(id) ON DELETE CASCADE
    )`,
  ]);

  /* Migrations (safe to run every time) */
  try { await db.execute('SELECT storage_backend FROM site_media LIMIT 1'); }
  catch { await db.execute("ALTER TABLE site_media ADD COLUMN storage_backend TEXT DEFAULT 'r2'"); }

  try { await db.execute('SELECT client_phone FROM client_galleries LIMIT 1'); }
  catch { await db.execute('ALTER TABLE client_galleries ADD COLUMN client_phone TEXT'); }

  /* Default admin */
  const { rows } = await db.execute('SELECT COUNT(*) as count FROM admins');
  if (rows[0].count === 0) {
    const hash = bcrypt.hashSync('admin123', 10);
    await db.execute({ sql: 'INSERT INTO admins (username, password) VALUES (?, ?)', args: ['admin', hash] });
    console.log('Default admin created: admin / admin123');
  }
}

module.exports = { db, init };
