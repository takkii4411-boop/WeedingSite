const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../database/db');
const { TEXT_SLOTS, MEDIA_SLOTS } = require('../utils/siteSlots');
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

function requireAdmin(req, res, next) {
  if (!req.session.admin) return res.redirect('/admin/auth/login');
  next();
}

/* ---------------- Dashboard ---------------- */
router.get('/dashboard', requireAdmin, (req, res) => {
  const contactCount = db.prepare('SELECT COUNT(*) as count FROM contacts').get().count;
  const pendingCount = db.prepare("SELECT COUNT(*) as count FROM contacts WHERE status='pending'").get().count;
  const acceptedCount = db.prepare("SELECT COUNT(*) as count FROM contacts WHERE status='accepted'").get().count;
  const deniedCount = db.prepare("SELECT COUNT(*) as count FROM contacts WHERE status='denied'").get().count;
  const galleryCount = db.prepare('SELECT COUNT(*) as count FROM client_galleries').get().count;
  const recentContacts = db.prepare('SELECT * FROM contacts ORDER BY created_at DESC LIMIT 5').all();
  const upcomingEvents = db.prepare("SELECT * FROM contacts WHERE status='accepted' AND event_date >= date('now') ORDER BY event_date ASC LIMIT 3").all();
  const recentGalleries = db.prepare('SELECT * FROM client_galleries ORDER BY created_at DESC LIMIT 3').all();
  res.render('admin/dashboard', {
    contactCount, pendingCount, acceptedCount, deniedCount,
    galleryCount, recentContacts, upcomingEvents, recentGalleries
  });
});

/* ---------------- Inquiries (contact form) ---------------- */
router.get('/inquiries', requireAdmin, (req, res) => {
  const filter = req.query.status;
  const valid = ['pending', 'accepted', 'denied'];
  const rows = valid.includes(filter)
    ? db.prepare('SELECT * FROM contacts WHERE status = ? ORDER BY created_at DESC').all(filter)
    : db.prepare('SELECT * FROM contacts ORDER BY created_at DESC').all();
  const counts = {
    all: db.prepare('SELECT COUNT(*) c FROM contacts').get().c,
    pending: db.prepare("SELECT COUNT(*) c FROM contacts WHERE status='pending'").get().c,
    accepted: db.prepare("SELECT COUNT(*) c FROM contacts WHERE status='accepted'").get().c,
    denied: db.prepare("SELECT COUNT(*) c FROM contacts WHERE status='denied'").get().c
  };
  res.render('admin/inquiries', { inquiries: rows, counts, filter: valid.includes(filter) ? filter : 'all' });
});

router.post('/inquiry/status/:id', requireAdmin, (req, res) => {
  const status = req.body.status;
  if (!['pending', 'accepted', 'denied'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  db.prepare('UPDATE contacts SET status = ? WHERE id = ?').run(status, req.params.id);
  res.json({ success: true, status });
});

router.post('/inquiry/delete/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM contacts WHERE id = ?').run(req.params.id);
  res.redirect('/admin/inquiries');
});

/* ---------------- Schedule (wedding dates) — FAST ---------------- */
router.get('/schedule', requireAdmin, (req, res) => {
  const rows = db.prepare(`
    SELECT id, name, email, phone, event_type, event_date, location, status, created_at
    FROM contacts
    WHERE event_date IS NOT NULL AND event_date != ''
    ORDER BY event_date ASC
  `).all();
  const today = new Date().toISOString().slice(0, 10);
  const schedule = rows.map(r => {
    const days = Math.ceil((new Date(r.event_date) - new Date(today)) / 86400000);
    return Object.assign({}, r, { days_until: days });
  });

  /* Calendar data: group dates by status */
  const calendarDates = {};
  rows.forEach(r => {
    if (r.event_date) {
      calendarDates[r.event_date] = { status: r.status, name: r.name, event_type: r.event_type };
    }
  });

  /* Holidays — sync from file cache (instant, no API wait) */
  const { getHolidaysSync } = require('../utils/holidays');
  const thisYear = new Date().getFullYear();
  const cc = 'IN';
  const holidays = Object.assign({}, getHolidaysSync(thisYear, cc), getHolidaysSync(thisYear + 1, cc));

  res.render('admin/schedule', { schedule, today, calendarDates, holidays });

  /* Background: refresh cache for next year if stale */
  const { getHolidays } = require('../utils/holidays');
  getHolidays(thisYear, cc).catch(() => {});
  getHolidays(thisYear + 1, cc).catch(() => {});
});

/* ---------------- Site editor (bulk view; inline editing on landing) --- */
router.get('/site-editor', requireAdmin, (req, res) => {
  const text = {};
  db.prepare('SELECT key, value FROM site_content').all()
    .forEach(row => { text[row.key] = row.value; });
  const media = {};
  db.prepare('SELECT slot, url, resource_type FROM site_media').all()
    .forEach(row => { media[row.slot] = row; });
  res.render('admin/site-editor', { TEXT_SLOTS, MEDIA_SLOTS, text, media, saved: req.query.saved });
});

router.post('/site/text', requireAdmin, (req, res) => {
  const upsert = db.prepare(
    `INSERT INTO site_content (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`
  );
  const apply = db.transaction(() => {
    for (const slot of TEXT_SLOTS) {
      const v = (req.body[slot.key] || '').trim();
      if (v) upsert.run(slot.key, v);
    }
  });
  apply();
  res.redirect('/admin/site-editor?saved=1');
});

router.post('/site/media/:slot', requireAdmin, mediaUpload.single('media'), async (req, res) => {
  const slot = req.params.slot;
  const meta = MEDIA_SLOTS.find(m => m.slot === slot);
  if (!meta) return res.status(400).json({ error: 'Unknown slot' });
  if (!req.file) return res.status(400).json({ error: 'No file received' });

  const store = require('../utils/storage');
  const previous = db.prepare('SELECT * FROM site_media WHERE slot = ?').get(slot);

  try {
    if (!store.isConfigured()) {
      return res.status(500).json({ error: 'No storage backend configured (R2/Telegram)' });
    }
    const result = await store.uploadAsset(req.file.path, req.file.originalname, meta.resourceType);
    const row = { slot, cloudinary_id: result.storageId, url: result.url,
            resource_type: result.resourceType, original_name: result.originalName,
            storage_backend: result.backend || 'r2' };
    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    db.prepare(
      `INSERT INTO site_media (slot, cloudinary_id, url, resource_type, original_name, storage_backend, updated_at)
       VALUES (@slot, @cloudinary_id, @url, @resource_type, @original_name, @storage_backend, CURRENT_TIMESTAMP)
       ON CONFLICT(slot) DO UPDATE SET
         cloudinary_id = excluded.cloudinary_id,
         url = excluded.url,
         resource_type = excluded.resource_type,
         original_name = excluded.original_name,
         storage_backend = excluded.storage_backend,
         updated_at = CURRENT_TIMESTAMP`
    ).run(row);
    if (previous) await store.deleteAsset(previous.cloudinary_id, previous.storage_backend);
    res.json({ success: true, url: row.url, resource_type: row.resource_type });
  } catch (err) {
    console.error('Site media upload failed:', err.message);
    res.status(500).json({ error: 'Upload failed: ' + err.message });
  }
});

router.post('/site/media/:slot/reset', requireAdmin, async (req, res) => {
  const previous = db.prepare('SELECT * FROM site_media WHERE slot = ?').get(req.params.slot);
  if (previous) {
    const store = require('../utils/storage');
    await store.deleteAsset(previous.cloudinary_id, previous.storage_backend);
    db.prepare('DELETE FROM site_media WHERE slot = ?').run(req.params.slot);
  }
  res.json({ success: true });
});

module.exports = router;
