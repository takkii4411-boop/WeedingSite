/* ==========================================================================
   CLIENT GALLERY — admin routes
   - List all galleries
   - Create new gallery
   - Upload images to gallery (with gallery-specific folder)
   - Delete images (with storage cleanup)
   - Delete entire gallery (all images from storage)
   - Toggle storage backend per gallery
   ========================================================================== */
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../database/db');
const store = require('../utils/storage');
const router = express.Router();

const uploadDir = path.join(__dirname, '..', 'uploads');
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, unique + path.extname(file.originalname));
  }
});
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const ok = /jpeg|jpg|png|gif|webp/i.test(path.extname(file.originalname)) ||
               /^image\//.test(file.mimetype);
    cb(null, ok);
  },
  limits: { fileSize: 120 * 1024 * 1024, files: 1000 }
});

function requireAdmin(req, res, next) {
  if (!req.session.admin) return res.redirect('/admin/auth/login');
  next();
}

const crypto = require('crypto');

function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Date.now().toString(36);
}

function generateToken() {
  return crypto.randomBytes(16).toString('hex'); // 32 char encrypted token
}

/* ---------- Save phone for existing gallery ---------- */
router.post('/save-phone', requireAdmin, (req, res) => {
  const { name, phone } = req.body;
  if (!name || !phone) return res.status(400).json({ error: 'Name and phone required' });
  const gallery = db.prepare('SELECT * FROM client_galleries WHERE client_name = ?').get(name);
  if (!gallery) return res.status(404).json({ error: 'Gallery not found for this name' });
  db.prepare('UPDATE client_galleries SET client_phone = ? WHERE id = ?').run(phone, gallery.id);
  res.json({ success: true });
});

/* ---------- List all galleries ---------- */
router.get('/', requireAdmin, (req, res) => {
  const galleries = db.prepare(`
    SELECT g.*, COUNT(i.id) as image_count
    FROM client_galleries g
    LEFT JOIN client_gallery_images i ON i.gallery_id = g.id
    GROUP BY g.id
    ORDER BY g.created_at DESC
  `).all();
  const backends = store.getBackend();
  const prefill = {
    client_name: req.query.client_name || '',
    client_email: req.query.client_email || '',
    client_phone: req.query.client_phone || '',
    event_type: req.query.event_type || '',
    event_date: req.query.event_date || '',
    location: req.query.location || ''
  };
  res.render('admin/galleries', { galleries, currentBackend: backends.name, prefill });
});

/* ---------- Create new gallery ---------- */
router.post('/create', requireAdmin, (req, res) => {
  const { client_name, client_email, client_phone, event_type, event_date, location, description, storage_backend } = req.body;
  if (!client_name) return res.redirect('/admin/galleries');
  const slug = generateToken(); // Encrypted random token — not guessable
  db.prepare(`
    INSERT INTO client_galleries (client_name, client_email, client_phone, event_type, event_date, location, slug, description, storage_backend)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(client_name, client_email || null, client_phone || null, event_type || null, event_date || null, location || null, slug, description || null, storage_backend || 'telegram');
  res.redirect('/admin/galleries/' + slug);
});

/* ---------- View gallery ---------- */
router.get('/:slug', requireAdmin, (req, res) => {
  const gallery = db.prepare('SELECT * FROM client_galleries WHERE slug = ?').get(req.params.slug);
  if (!gallery) return res.redirect('/admin/galleries');
  const images = db.prepare('SELECT * FROM client_gallery_images WHERE gallery_id = ? ORDER BY sort_order, id').all(gallery.id);
  const currentBackend = store.getBackend().name;
  res.render('admin/gallery-detail', { gallery, images, currentBackend });
});

/* ---------- Upload images to gallery ---------- */
router.post('/:slug/upload', requireAdmin, upload.array('images', 500), async (req, res) => {
  const gallery = db.prepare('SELECT * FROM client_galleries WHERE slug = ?').get(req.params.slug);
  if (!gallery) return res.status(404).json({ error: 'Gallery not found' });
  if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'No files' });

  const backend = gallery.storage_backend || 'r2';
  const insert = db.prepare(`
    INSERT INTO client_gallery_images (gallery_id, url, storage_id, storage_backend, original_name, sort_order)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const count = db.prepare('SELECT COUNT(*) as c FROM client_gallery_images WHERE gallery_id = ?').get(gallery.id).c;

  // Batch limits: Telegram 50, Cloudinary 50, R2 500
  const BATCH_SIZE = (backend === 'telegram' || backend === 'cloudinary') ? 50 : 500;
  let uploaded = 0;

  for (let batchStart = 0; batchStart < req.files.length; batchStart += BATCH_SIZE) {
    const batch = req.files.slice(batchStart, batchStart + BATCH_SIZE);
    console.log(`[Upload] Batch ${Math.floor(batchStart / BATCH_SIZE) + 1}: ${batch.length} files → ${backend}`);

    for (let idx = 0; idx < batch.length; idx++) {
      const file = batch[idx];
      try {
        const result = await store.uploadAsset(file.path, file.originalname, 'image', gallery.slug, gallery.storage_backend, gallery.client_name);
        insert.run(gallery.id, result.url, result.storageId || null, result.backend || gallery.storage_backend, file.originalname, count + uploaded);
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
        uploaded++;
      } catch (err) {
        console.error('Gallery upload failed:', err.message);
      }
    }
  }

  // Set cover if first image
  if (count === 0 && uploaded > 0) {
    const first = db.prepare('SELECT url FROM client_gallery_images WHERE gallery_id = ? ORDER BY id LIMIT 1').get(gallery.id);
    if (first) db.prepare('UPDATE client_galleries SET cover_url = ? WHERE id = ?').run(first.url, gallery.id);
  }

  res.json({ success: true, uploaded, total: req.files.length });
});

/* ---------- Delete single image ---------- */
router.post('/:slug/delete-image/:id', requireAdmin, async (req, res) => {
  const image = db.prepare('SELECT * FROM client_gallery_images WHERE id = ?').get(req.params.id);
  if (!image) return res.status(404).json({ error: 'Image not found' });

  // Delete from storage (use image's own backend)
  if (image.storage_id) {
    await store.deleteAsset(image.storage_id, image.storage_backend);
  }

  db.prepare('DELETE FROM client_gallery_images WHERE id = ?').run(image.id);

  // Update cover if needed
  const gallery = db.prepare('SELECT * FROM client_galleries WHERE slug = ?').get(req.params.slug);
  if (gallery && gallery.cover_url === image.url) {
    const next = db.prepare('SELECT url FROM client_gallery_images WHERE gallery_id = ? ORDER BY id LIMIT 1').get(gallery.id);
    db.prepare('UPDATE client_galleries SET cover_url = ? WHERE id = ?').run(next ? next.url : null, gallery.id);
  }

  res.json({ success: true });
});

/* ---------- Delete multiple images ---------- */
router.post('/:slug/delete-images', requireAdmin, async (req, res) => {
  const { ids } = req.body;
  if (!ids || !Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'No image IDs' });

  const gallery = db.prepare('SELECT * FROM client_galleries WHERE slug = ?').get(req.params.slug);
  const images = db.prepare(`SELECT * FROM client_gallery_images WHERE id IN (${ids.map(() => '?').join(',')})`).all(...ids);

  for (const img of images) {
    if (img.storage_id) await store.deleteAsset(img.storage_id, img.storage_backend);
  }

  db.prepare(`DELETE FROM client_gallery_images WHERE id IN (${ids.map(() => '?').join(',')})`).run(...ids);

  // Update cover if needed
  if (gallery) {
    const coverStill = db.prepare('SELECT url FROM client_gallery_images WHERE id = ?').get(gallery.cover_url);
    if (!coverStill) {
      const next = db.prepare('SELECT url FROM client_gallery_images WHERE gallery_id = ? ORDER BY id LIMIT 1').get(gallery.id);
      db.prepare('UPDATE client_galleries SET cover_url = ? WHERE id = ?').run(next ? next.url : null, gallery.id);
    }
  }

  res.json({ success: true, deleted: images.length });
});

/* ---------- Delete entire gallery ---------- */
router.post('/:slug/delete', requireAdmin, async (req, res) => {
  const gallery = db.prepare('SELECT * FROM client_galleries WHERE slug = ?').get(req.params.slug);
  if (!gallery) return res.redirect('/admin/galleries');

  // Delete all images from storage (R2 + Telegram dono se)
  const images = db.prepare('SELECT * FROM client_gallery_images WHERE gallery_id = ?').all(gallery.id);
  for (const img of images) {
    if (img.storage_id) {
      console.log(`[Delete] ${img.original_name} from ${img.storage_backend}`);
      await store.deleteAsset(img.storage_id, img.storage_backend);
    }
  }

  // Delete from DB (CASCADE will handle images table)
  db.prepare('DELETE FROM client_galleries WHERE id = ?').run(gallery.id);

  res.redirect('/admin/galleries');
});

/* ---------- Update gallery details ---------- */
router.post('/:slug/update', requireAdmin, (req, res) => {
  const { client_name, client_email, client_phone, event_type, event_date, location, description, is_public, storage_backend } = req.body;
  const gallery = db.prepare('SELECT * FROM client_galleries WHERE slug = ?').get(req.params.slug);
  if (!gallery) return res.redirect('/admin/galleries');

  db.prepare(`
    UPDATE client_galleries SET
      client_name = ?, client_email = ?, client_phone = ?, event_type = ?, event_date = ?,
      location = ?, description = ?, is_public = ?, storage_backend = ?
    WHERE id = ?
  `).run(
    client_name || gallery.client_name,
    client_email || gallery.client_email,
    client_phone || gallery.client_phone,
    event_type || gallery.event_type,
    event_date || gallery.event_date,
    location || gallery.location,
    description || gallery.description,
    is_public !== undefined ? (is_public ? 1 : 0) : gallery.is_public,
    storage_backend || gallery.storage_backend,
    gallery.id
  );
  res.redirect('/admin/galleries/' + req.params.slug);
});

module.exports = router;
