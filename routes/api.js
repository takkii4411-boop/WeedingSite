const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { db } = require('../database/db');
const { isValidTextKey, isValidMediaSlot } = require('../utils/siteSlots');
const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '..', 'uploads')),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, unique + path.extname(file.originalname));
  }
});
const mediaUpload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const ok = /jpeg|jpg|png|gif|webp|mp4|webm|mov/.test(path.extname(file.originalname).toLowerCase()) ||
               /^image\//.test(file.mimetype) || /^video\//.test(file.mimetype);
    if (ok) return cb(null, true);
    cb(new Error('Only image or video files are allowed'));
  },
  limits: { fileSize: 120 * 1024 * 1024 }
});

function requireAdminJson(req, res, next) {
  if (!req.session.admin) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

router.get('/site/content', async (req, res) => {
  try {
    const { rows: textRows } = await db.execute('SELECT key, value FROM site_content');
    const text = {};
    textRows.forEach(row => { text[row.key] = row.value; });

    const { rows: mediaRows } = await db.execute('SELECT slot, url, resource_type FROM site_media');
    const media = {};
    mediaRows.forEach(row => { media[row.slot] = { url: row.url, type: row.resource_type }; });

    res.set('Cache-Control', 'no-cache');
    res.json({ ok: true, text, media });
  } catch (err) {
    console.error('site/content failed:', err.message);
    res.json({ ok: true, text: {}, media: {} });
  }
});

router.get('/admin/status', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({ admin: !!req.session.admin });
});

router.get('/inquiries/list', requireAdminJson, async (req, res) => {
  const { rows } = await db.execute(`
    SELECT name, email, phone, event_type, event_date, location
    FROM contacts
    WHERE status = 'accepted' AND event_date IS NOT NULL AND event_date != ''
    ORDER BY event_date DESC
    LIMIT 50
  `);
  res.json({ inquiries: rows });
});

router.post('/admin/text', requireAdminJson, async (req, res) => {
  const { key, value } = req.body || {};
  if (!key || typeof value !== 'string') return res.status(400).json({ error: 'key and value required' });
  if (!isValidTextKey(key)) return res.status(400).json({ error: 'Unknown text slot' });
  await db.execute({
    sql: `INSERT INTO site_content (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
    args: [key, value.trim()]
  });
  res.json({ success: true });
});

router.post('/admin/media/:slot', requireAdminJson, mediaUpload.single('media'), async (req, res) => {
  const slot = req.params.slot;
  if (!isValidMediaSlot(slot)) return res.status(400).json({ error: 'Unknown slot' });
  if (!req.file) return res.status(400).json({ error: 'No file received' });

  const store = require('../utils/storage');
  const { rows: prevRows } = await db.execute({ sql: 'SELECT * FROM site_media WHERE slot = ?', args: [slot] });
  const previous = prevRows[0];
  const isVideo = /^video\//.test(req.file.mimetype) || /\.mp4|\.webm|\.mov$/i.test(req.file.originalname);

  try {
    if (!store.isConfigured()) {
      return res.status(500).json({ error: 'No storage backend configured (R2/Telegram)' });
    }
    const result = await store.uploadAsset(req.file.path, req.file.originalname, isVideo ? 'video' : 'image');
    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    await db.execute({
      sql: `INSERT INTO site_media (slot, cloudinary_id, url, resource_type, original_name, storage_backend, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(slot) DO UPDATE SET
              cloudinary_id = excluded.cloudinary_id,
              url = excluded.url,
              resource_type = excluded.resource_type,
              original_name = excluded.original_name,
              storage_backend = excluded.storage_backend,
              updated_at = CURRENT_TIMESTAMP`,
      args: [slot, result.storageId, result.url, result.resourceType, result.originalName, result.backend || 'r2']
    });
    if (previous) await store.deleteAsset(previous.cloudinary_id, previous.storage_backend);
    res.json({ success: true, url: result.url, resource_type: result.resourceType });
  } catch (err) {
    console.error('Inline media upload failed:', err.message);
    res.status(500).json({ error: 'Upload failed: ' + err.message });
  }
});

router.post('/admin/media/:slot/reset', requireAdminJson, async (req, res) => {
  const { rows: prevRows } = await db.execute({ sql: 'SELECT * FROM site_media WHERE slot = ?', args: [req.params.slot] });
  const previous = prevRows[0];
  if (previous) {
    const store = require('../utils/storage');
    await store.deleteAsset(previous.cloudinary_id, previous.storage_backend);
    await db.execute({ sql: 'DELETE FROM site_media WHERE slot = ?', args: [req.params.slot] });
  }
  res.json({ success: true });
});

module.exports = router;
