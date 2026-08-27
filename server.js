require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const db = require('./database/db');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const adminGalleryRoutes = require('./routes/admin-gallery');
const apiRoutes = require('./routes/api');
const contactRoutes = require('./routes/contact');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
/* admin panel assets */
app.use(express.static(path.join(__dirname, 'public')));
/* landing page assets (root stays non-listed so .env/server code are never exposed) */
app.use('/css', express.static(path.join(__dirname, 'css')));
app.use('/js', express.static(path.join(__dirname, 'js')));

app.use(session({
  secret: process.env.SESSION_SECRET || 'wedding-portfolio-dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

app.use((req, res, next) => {
  res.locals.session = req.session;
  res.locals.currentPath = req.path;
  /* keep the admin panel out of search engines entirely */
  if (req.path.startsWith('/admin')) {
    res.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
  }
  next();
});

/* hidden admin (no links from the landing page) */
app.use('/admin/auth', authRoutes);
app.use('/admin', adminRoutes);
app.use('/admin/galleries', adminGalleryRoutes);

/* public + inline-editor APIs */
app.use('/api/contact', contactRoutes);
app.use('/api', apiRoutes);

/* public client gallery */
app.get('/gallery/:slug', (req, res) => {
  const gallery = db.prepare('SELECT * FROM client_galleries WHERE slug = ? AND is_public = 1').get(req.params.slug);
  if (!gallery) return res.status(404).send('Gallery not found');
  const images = db.prepare('SELECT * FROM client_gallery_images WHERE gallery_id = ? ORDER BY sort_order, id').all(gallery.id);
  res.render('gallery', { gallery, images });
});

/* landing page */
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/story.html', (req, res) => res.sendFile(path.join(__dirname, 'story.html')));

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Admin (hidden): http://localhost:${PORT}/admin/auth/login`);
});
