const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { db } = require('../database/db');
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

router.get('/dashboard', requireAdmin, async (req, res) => {
  const [cCount, pCount, aCount, dCount, gCount, recent, upcoming, recentG] = await Promise.all([
    db.execute('SELECT COUNT(*) as count FROM contacts'),
    db.execute("SELECT COUNT(*) as count FROM contacts WHERE status='pending'"),
    db.execute("SELECT COUNT(*) as count FROM contacts WHERE status='accepted'"),
    db.execute("SELECT COUNT(*) as count FROM contacts WHERE status='denied'"),
    db.execute('SELECT COUNT(*) as count FROM client_galleries'),
    db.execute('SELECT * FROM contacts ORDER BY created_at DESC LIMIT 5'),
    db.execute("SELECT * FROM contacts WHERE status='accepted' AND event_date >= date('now') ORDER BY event_date ASC LIMIT 3"),
    db.execute('SELECT * FROM client_galleries ORDER BY created_at DESC LIMIT 3'),
  ]);
  res.render('admin/dashboard', {
    contactCount: cCount.rows[0].count,
    pendingCount: pCount.rows[0].count,
    acceptedCount: aCount.rows[0].count,
    deniedCount: dCount.rows[0].count,
    galleryCount: gCount.rows[0].count,
    recentContacts: recent.rows,
    upcomingEvents: upcoming.rows,
    recentGalleries: recentG.rows
  });
});

router.get('/inquiries', requireAdmin, async (req, res) => {
  const filter = req.query.status;
  const valid = ['pending', 'accepted', 'denied'];
  const rowsResult = valid.includes(filter)
    ? await db.execute({ sql: 'SELECT * FROM contacts WHERE status = ? ORDER BY created_at DESC', args: [filter] })
    : await db.execute('SELECT * FROM contacts ORDER BY created_at DESC');
  const [all, pending, accepted, denied] = await Promise.all([
    db.execute('SELECT COUNT(*) c FROM contacts'),
    db.execute("SELECT COUNT(*) c FROM contacts WHERE status='pending'"),
    db.execute("SELECT COUNT(*) c FROM contacts WHERE status='accepted'"),
    db.execute("SELECT COUNT(*) c FROM contacts WHERE status='denied'"),
  ]);
  const counts = {
    all: all.rows[0].c,
    pending: pending.rows[0].c,
    accepted: accepted.rows[0].c,
    denied: denied.rows[0].c
  };
  res.render('admin/inquiries', { inquiries: rowsResult.rows, counts, filter: valid.includes(filter) ? filter : 'all' });
});

router.post('/inquiry/status/:id', requireAdmin, async (req, res) => {
  const status = req.body.status;
  if (!['pending', 'accepted', 'denied'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  await db.execute({ sql: 'UPDATE contacts SET status = ? WHERE id = ?', args: [status, req.params.id] });
  res.json({ success: true, status });
});

router.post('/inquiry/delete/:id', requireAdmin, async (req, res) => {
  await db.execute({ sql: 'DELETE FROM contacts WHERE id = ?', args: [req.params.id] });
  res.redirect('/admin/inquiries');
});

router.get('/schedule', requireAdmin, async (req, res) => {
  const { rows } = await db.execute(`
    SELECT id, name, email, phone, event_type, event_date, location, status, created_at
    FROM contacts
    WHERE event_date IS NOT NULL AND event_date != ''
    ORDER BY event_date ASC
  `);
  const today = new Date().toISOString().slice(0, 10);
  const schedule = rows.map(r => {
    const days = Math.ceil((new Date(r.event_date) - new Date(today)) / 86400000);
    return Object.assign({}, r, { days_until: days });
  });

  const calendarDates = {};
  rows.forEach(r => {
    if (r.event_date) {
      calendarDates[r.event_date] = { status: r.status, name: r.name, event_type: r.event_type };
    }
  });

  const { getHolidaysSync } = require('../utils/holidays');
  const thisYear = new Date().getFullYear();
  const cc = 'IN';
  const holidays = Object.assign({}, getHolidaysSync(thisYear, cc), getHolidaysSync(thisYear + 1, cc));

  res.render('admin/schedule', { schedule, today, calendarDates, holidays });

  const { getHolidays } = require('../utils/holidays');
  getHolidays(thisYear, cc).catch(() => {});
  getHolidays(thisYear + 1, cc).catch(() => {});
});

router.get('/site-editor', requireAdmin, async (req, res) => {
  const { rows: textRows } = await db.execute('SELECT key, value FROM site_content');
  const text = {};
  textRows.forEach(row => { text[row.key] = row.value; });
  const { rows: mediaRows } = await db.execute('SELECT slot, url, resource_type FROM site_media');
  const media = {};
  mediaRows.forEach(row => { media[row.slot] = row; });
  res.render('admin/site-editor', { TEXT_SLOTS, MEDIA_SLOTS, text, media, saved: req.query.saved });
});

router.post('/site/text', requireAdmin, async (req, res) => {
  const stmts = [];
  for (const slot of TEXT_SLOTS) {
    const v = (req.body[slot.key] || '').trim();
    if (v) stmts.push({
      sql: `INSERT INTO site_content (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
      args: [slot.key, v]
    });
  }
  if (stmts.length) await db.batch(stmts);
  res.redirect('/admin/site-editor?saved=1');
});

router.post('/site/media/:slot', requireAdmin, mediaUpload.single('media'), async (req, res) => {
  const slot = req.params.slot;
  const meta = MEDIA_SLOTS.find(m => m.slot === slot);
  if (!meta) return res.status(400).json({ error: 'Unknown slot' });
  if (!req.file) return res.status(400).json({ error: 'No file received' });

  const store = require('../utils/storage');
  const { rows: prevRows } = await db.execute({ sql: 'SELECT * FROM site_media WHERE slot = ?', args: [slot] });
  const previous = prevRows[0];

  try {
    if (!store.isConfigured()) {
      return res.status(500).json({ error: 'No storage backend configured (R2/Telegram)' });
    }
    const result = await store.uploadAsset(req.file.path, req.file.originalname, meta.resourceType);
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
    console.error('Site media upload failed:', err.message);
    res.status(500).json({ error: 'Upload failed: ' + err.message });
  }
});

router.post('/site/media/:slot/reset', requireAdmin, async (req, res) => {
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
