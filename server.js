require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const { db, init } = require('./database/db');
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
app.use(express.static(path.join(__dirname, 'public')));
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
  if (req.path.startsWith('/admin')) {
    res.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
  }
  next();
});

app.use('/admin/auth', authRoutes);
app.use('/admin', adminRoutes);
app.use('/admin/galleries', adminGalleryRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api', apiRoutes);

app.get('/gallery/:slug', async (req, res) => {
  const { rows: gRows } = await db.execute({ sql: 'SELECT * FROM client_galleries WHERE slug = ? AND is_public = 1', args: [req.params.slug] });
  const gallery = gRows[0];
  if (!gallery) return res.status(404).send('Gallery not found');
  const { rows: images } = await db.execute({ sql: 'SELECT * FROM client_gallery_images WHERE gallery_id = ? ORDER BY sort_order, id', args: [gallery.id] });
  res.render('gallery', { gallery, images });
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/story.html', (req, res) => res.sendFile(path.join(__dirname, 'story.html')));
app.get('/health', (req, res) => res.json({ status: 'ok', uptime: process.uptime() }));

init().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Admin (hidden): http://localhost:${PORT}/admin/auth/login`);
  });
}).catch(err => {
  console.error('Failed to init database:', err);
  process.exit(1);
});
