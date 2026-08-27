const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { db } = require('../database/db');
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
  return crypto.randomBytes(16).toString('hex');
}

router.post('/save-phone', requireAdmin, async (req, res) => {
  const { name, phone } = req.body;
  if (!name || !phone) return res.status(400).json({ error: 'Name and phone required' });
  const { rows } = await db.execute({ sql: 'SELECT * FROM client_galleries WHERE client_name = ?', args: [name] });
  const gallery = rows[0];
  if (!gallery) return res.status(404).json({ error: 'Gallery not found for this name' });
  await db.execute({ sql: 'UPDATE client_galleries SET client_phone = ? WHERE id = ?', args: [phone, gallery.id] });
  res.json({ success: true });
});

router.get('/', requireAdmin, async (req, res) => {
  const { rows: galleries } = await db.execute(`
    SELECT g.*, COUNT(i.id) as image_count
    FROM client_galleries g
    LEFT JOIN client_gallery_images i ON i.gallery_id = g.id
    GROUP BY g.id
    ORDER BY g.created_at DESC
  `);
  const backends = store.getBackend();
  const prefill = {
    client_name: req.query.client_name || '',
    client_email: req.query.client_email || '',
    client_phone: req.query.client_phone || '',
    event_type: req.query.event_type || '',
    event_date: req.query.event_date || '',
    location: req.query.location || '',
    contact_id: req.query.contact_id || ''
  };
  res.render('admin/galleries', { galleries, currentBackend: 'telegram', prefill });
});

router.post('/create', requireAdmin, async (req, res) => {
  const { client_name, client_email, client_phone, event_type, event_date, location, description, storage_backend, contact_id } = req.body;
  if (!client_name) return res.redirect('/admin/galleries');
  const slug = generateToken();
  await db.execute({
    sql: `INSERT INTO client_galleries (client_name, client_email, client_phone, event_type, event_date, location, slug, description, storage_backend, contact_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [client_name, client_email || null, client_phone || null, event_type || null, event_date || null, location || null, slug, description || null, storage_backend || 'telegram', contact_id || null]
  });
  if (contact_id) {
    await db.execute({ sql: `UPDATE contacts SET status = 'accepted' WHERE id = ?`, args: [contact_id] });
  }
  res.redirect('/admin/galleries/' + slug);
});

router.get('/:slug', requireAdmin, async (req, res) => {
  const { rows } = await db.execute({ sql: 'SELECT * FROM client_galleries WHERE slug = ?', args: [req.params.slug] });
  const gallery = rows[0];
  if (!gallery) return res.redirect('/admin/galleries');
  const { rows: images } = await db.execute({ sql: 'SELECT * FROM client_gallery_images WHERE gallery_id = ? ORDER BY sort_order, id', args: [gallery.id] });
  let inquiry = null;
  if (gallery.contact_id) {
    const { rows: inqRows } = await db.execute({ sql: 'SELECT * FROM contacts WHERE id = ?', args: [gallery.contact_id] });
    inquiry = inqRows[0] || null;
  }
  const currentBackend = store.getBackend().name;
  res.render('admin/gallery-detail', { gallery, images, currentBackend, inquiry });
});

router.post('/:slug/upload', requireAdmin, upload.array('images', 500), async (req, res) => {
  const { rows } = await db.execute({ sql: 'SELECT * FROM client_galleries WHERE slug = ?', args: [req.params.slug] });
  const gallery = rows[0];
  if (!gallery) return res.status(404).json({ error: 'Gallery not found' });
  if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'No files' });

  const backend = gallery.storage_backend || process.env.STORAGE_BACKEND || 'r2';
  const countResult = await db.execute({ sql: 'SELECT COUNT(*) as c FROM client_gallery_images WHERE gallery_id = ?', args: [gallery.id] });
  const count = countResult.rows[0].c;

  const BATCH_SIZE = (backend === 'telegram' || backend === 'cloudinary') ? 50 : 500;
  let uploaded = 0;

  for (let batchStart = 0; batchStart < req.files.length; batchStart += BATCH_SIZE) {
    const batch = req.files.slice(batchStart, batchStart + BATCH_SIZE);
    console.log(`[Upload] Batch ${Math.floor(batchStart / BATCH_SIZE) + 1}: ${batch.length} files → ${backend}`);

    for (let idx = 0; idx < batch.length; idx++) {
      const file = batch[idx];
      try {
        const result = await store.uploadAsset(file.path, file.originalname, 'image', gallery.slug, gallery.storage_backend, gallery.client_name);
        await db.execute({
          sql: `INSERT INTO client_gallery_images (gallery_id, url, storage_id, storage_backend, original_name, sort_order)
                VALUES (?, ?, ?, ?, ?, ?)`,
          args: [gallery.id, result.url, result.storageId || null, result.backend || gallery.storage_backend, file.originalname, count + uploaded]
        });
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
        uploaded++;
      } catch (err) {
        console.error('Gallery upload failed:', err.message);
      }
    }
  }

  if (count === 0 && uploaded > 0) {
    const { rows: firstRows } = await db.execute({ sql: 'SELECT url FROM client_gallery_images WHERE gallery_id = ? ORDER BY id LIMIT 1', args: [gallery.id] });
    const first = firstRows[0];
    if (first) await db.execute({ sql: 'UPDATE client_galleries SET cover_url = ? WHERE id = ?', args: [first.url, gallery.id] });
  }

  res.json({ success: true, uploaded, total: req.files.length });
});

router.post('/:slug/delete-image/:id', requireAdmin, async (req, res) => {
  const { rows } = await db.execute({ sql: 'SELECT * FROM client_gallery_images WHERE id = ?', args: [req.params.id] });
  const image = rows[0];
  if (!image) return res.status(404).json({ error: 'Image not found' });

  if (image.storage_id) {
    await store.deleteAsset(image.storage_id, image.storage_backend);
  }

  await db.execute({ sql: 'DELETE FROM client_gallery_images WHERE id = ?', args: [image.id] });

  const { rows: gRows } = await db.execute({ sql: 'SELECT * FROM client_galleries WHERE slug = ?', args: [req.params.slug] });
  const gallery = gRows[0];
  if (gallery && gallery.cover_url === image.url) {
    const { rows: nextRows } = await db.execute({ sql: 'SELECT url FROM client_gallery_images WHERE gallery_id = ? ORDER BY id LIMIT 1', args: [gallery.id] });
    const next = nextRows[0];
    await db.execute({ sql: 'UPDATE client_galleries SET cover_url = ? WHERE id = ?', args: [next ? next.url : null, gallery.id] });
  }

  res.json({ success: true });
});

router.post('/:slug/delete-images', requireAdmin, async (req, res) => {
  const { ids } = req.body;
  if (!ids || !Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'No image IDs' });

  const { rows: gRows } = await db.execute({ sql: 'SELECT * FROM client_galleries WHERE slug = ?', args: [req.params.slug] });
  const gallery = gRows[0];
  const placeholders = ids.map(() => '?').join(',');
  const { rows: images } = await db.execute({ sql: `SELECT * FROM client_gallery_images WHERE id IN (${placeholders})`, args: ids });

  for (const img of images) {
    if (img.storage_id) await store.deleteAsset(img.storage_id, img.storage_backend);
  }

  await db.execute({ sql: `DELETE FROM client_gallery_images WHERE id IN (${placeholders})`, args: ids });

  if (gallery) {
    const { rows: coverRows } = await db.execute({ sql: 'SELECT url FROM client_gallery_images WHERE id = ?', args: [gallery.cover_url] });
    if (coverRows.length === 0) {
      const { rows: nextRows } = await db.execute({ sql: 'SELECT url FROM client_gallery_images WHERE gallery_id = ? ORDER BY id LIMIT 1', args: [gallery.id] });
      const next = nextRows[0];
      await db.execute({ sql: 'UPDATE client_galleries SET cover_url = ? WHERE id = ?', args: [next ? next.url : null, gallery.id] });
    }
  }

  res.json({ success: true, deleted: images.length });
});

router.post('/:slug/delete', requireAdmin, async (req, res) => {
  const { rows } = await db.execute({ sql: 'SELECT * FROM client_galleries WHERE slug = ?', args: [req.params.slug] });
  const gallery = rows[0];
  if (!gallery) return res.redirect('/admin/galleries');

  const { rows: images } = await db.execute({ sql: 'SELECT * FROM client_gallery_images WHERE gallery_id = ?', args: [gallery.id] });
  for (const img of images) {
    if (img.storage_id) {
      console.log(`[Delete] ${img.original_name} from ${img.storage_backend}`);
      await store.deleteAsset(img.storage_id, img.storage_backend);
    }
  }

  const folderName = gallery.client_name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').substring(0, 50);
  const folderPath = `galleries/${folderName}`;
  const backend = gallery.storage_backend || 'telegram';
  await store.deleteFolder(folderPath, backend);

  await db.execute({ sql: 'DELETE FROM client_galleries WHERE id = ?', args: [gallery.id] });

  res.redirect('/admin/galleries');
});

router.post('/:slug/update', requireAdmin, async (req, res) => {
  const { client_name, client_email, client_phone, event_type, event_date, location, description, is_public, storage_backend } = req.body;
  const { rows } = await db.execute({ sql: 'SELECT * FROM client_galleries WHERE slug = ?', args: [req.params.slug] });
  const gallery = rows[0];
  if (!gallery) return res.redirect('/admin/galleries');

  await db.execute({
    sql: `UPDATE client_galleries SET
            client_name = ?, client_email = ?, client_phone = ?, event_type = ?, event_date = ?,
            location = ?, description = ?, is_public = ?, storage_backend = ?
          WHERE id = ?`,
    args: [
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
    ]
  });
  res.redirect('/admin/galleries/' + req.params.slug);
});

module.exports = router;
