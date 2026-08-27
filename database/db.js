/* ==========================================================================
   DATABASE — SQLite for now (temporary/testing). The queries are kept
   simple so the layer can be swapped to Turso (libSQL) later without
   touching the routes: every statement lives in this file or in the
   routes as plain SQL strings.
   ========================================================================== */
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, '..', 'data', 'wedding.db');
const dir = path.dirname(dbPath);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS contacts (
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
  );

  /* Landing-page CMS: editable text slots (key -> text/html value) */
  CREATE TABLE IF NOT EXISTS site_content (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  /* Landing-page CMS: media slots (hero video, gallery, wall, stories...) */
  CREATE TABLE IF NOT EXISTS site_media (
    slot TEXT PRIMARY KEY,
    cloudinary_id TEXT,
    url TEXT NOT NULL,
    resource_type TEXT NOT NULL DEFAULT 'image',
    original_name TEXT,
    storage_backend TEXT DEFAULT 'telegram',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  /* Client Galleries — like Google Photos for each event */
  CREATE TABLE IF NOT EXISTS client_galleries (
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
  );

  /* Images inside a client gallery */
  CREATE TABLE IF NOT EXISTS client_gallery_images (
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
  );
`);

/* Migration: add storage_backend to site_media if missing */
try {
  db.prepare("SELECT storage_backend FROM site_media LIMIT 1").get();
} catch {
  db.exec("ALTER TABLE site_media ADD COLUMN storage_backend TEXT DEFAULT 'r2'");
  console.log('Migration: added storage_backend to site_media');
}

/* Migration: add client_phone to client_galleries if missing */
try {
  db.prepare("SELECT client_phone FROM client_galleries LIMIT 1").get();
} catch {
  db.exec("ALTER TABLE client_galleries ADD COLUMN client_phone TEXT");
  console.log('Migration: added client_phone to client_galleries');
}

/* default admin — change the password after first login (admin/admin123) */
const adminCount = db.prepare('SELECT COUNT(*) as count FROM admins').get();
if (adminCount.count === 0) {
  const hash = bcrypt.hashSync('admin123', 10);
  db.prepare('INSERT INTO admins (username, password) VALUES (?, ?)').run('admin', hash);
  console.log('Default admin created: admin / admin123');
}

module.exports = db;
