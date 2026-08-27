const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../database/db');
const router = express.Router();

/* Hidden admin entrance — never linked from the landing page. */
router.get('/login', (req, res) => {
  if (req.session.admin) return res.redirect('/admin/dashboard');
  res.render('admin/login', { error: null, passwordChanged: false });
});

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  const admin = db.prepare('SELECT * FROM admins WHERE username = ?').get(username);
  if (!admin || !bcrypt.compareSync(password, admin.password)) {
    return res.render('admin/login', { error: 'Invalid username or password', passwordChanged: false });
  }
  req.session.admin = { id: admin.id, username: admin.username };
  res.redirect('/admin/dashboard');
});

router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/admin/auth/login');
});

/* Account settings — username + password */
router.get('/change-password', (req, res) => {
  if (!req.session.admin) return res.redirect('/admin/auth/login');
  const admin = db.prepare('SELECT * FROM admins WHERE id = ?').get(req.session.admin.id);
  res.render('admin/change-password', { error: null, success: null, admin });
});

router.post('/change-password', async (req, res) => {
  if (!req.session.admin) return res.redirect('/admin/auth/login');
  const { username, currentPassword, newPassword, confirmPassword } = req.body;
  const admin = db.prepare('SELECT * FROM admins WHERE id = ?').get(req.session.admin.id);

  if (!currentPassword) {
    return res.render('admin/change-password', { error: 'Current password is required', success: null, admin });
  }
  if (!bcrypt.compareSync(currentPassword, admin.password)) {
    return res.render('admin/change-password', { error: 'Current password is incorrect', success: null, admin });
  }

  let updated = false;
  let msg = '';

  /* Update username if changed */
  if (username && username !== admin.username) {
    if (username.length < 3) {
      return res.render('admin/change-password', { error: 'Username must be at least 3 characters', success: null, admin });
    }
    const exists = db.prepare('SELECT id FROM admins WHERE username = ? AND id != ?').get(username, admin.id);
    if (exists) {
      return res.render('admin/change-password', { error: 'Username already taken', success: null, admin });
    }
    db.prepare('UPDATE admins SET username = ? WHERE id = ?').run(username, admin.id);
    req.session.admin.username = username;
    updated = true;
  }

  /* Update password if provided */
  if (newPassword) {
    if (newPassword !== confirmPassword) {
      return res.render('admin/change-password', { error: 'New passwords do not match', success: null, admin });
    }
    if (newPassword.length < 6) {
      return res.render('admin/change-password', { error: 'New password must be at least 6 characters', success: null, admin });
    }
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    db.prepare('UPDATE admins SET password = ? WHERE id = ?').run(hashedPassword, admin.id);
    updated = true;
  }

  if (updated) {
    const freshAdmin = db.prepare('SELECT * FROM admins WHERE id = ?').get(admin.id);
    res.render('admin/change-password', { error: null, success: 'Account updated successfully', admin: freshAdmin });
  } else {
    res.render('admin/change-password', { error: 'No changes made', success: null, admin });
  }
});

module.exports = router;
