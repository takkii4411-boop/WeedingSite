const db = require('../database/db');
try {
  db.exec("ALTER TABLE client_galleries ADD COLUMN storage_backend TEXT NOT NULL DEFAULT 'r2'");
  console.log('storage_backend column added!');
} catch (e) {
  if (e.message.includes('duplicate column')) {
    console.log('Column already exists — skipping.');
  } else {
    throw e;
  }
}
