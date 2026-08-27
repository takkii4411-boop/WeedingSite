const express = require('express');
const bcrypt = require('bcryptjs');
const { db } = require('../database/db');
const router = express.Router();

router.get('/login', (req, res) => {
  if (req.session.admin) return res.redirect('/admin/dashboard');
  res.render('admin/login', { error: null, passwordChanged: false });
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const { rows } = await db.execute({ sql: 'SELECT * FROM admins WHERE username = ?', args: [username] });
  const admin = rows[0];
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

router.get('/change-password', async (req, res) => {
  if (!req.session.admin) return res.redirect('/admin/auth/login');
  const { rows } = await db.execute({ sql: 'SELECT * FROM admins WHERE id = ?', args: [req.session.admin.id] });
  res.render('admin/change-password', { error: null, success: null, admin: rows[0] });
});

router.post('/change-password', async (req, res) => {
  if (!req.session.admin) return res.redirect('/admin/auth/login');
  const { username, currentPassword, newPassword, confirmPassword } = req.body;
  const { rows } = await db.execute({ sql: 'SELECT * FROM admins WHERE id = ?', args: [req.session.admin.id] });
  const admin = rows[0];

  if (!currentPassword) {
    return res.render('admin/change-password', { error: 'Current password is required', success: null, admin });
  }
  if (!bcrypt.compareSync(currentPassword, admin.password)) {
    return res.render('admin/change-password', { error: 'Current password is incorrect', success: null, admin });
  }

  let updated = false;
  let msg = '';

  if (username && username !== admin.username) {
    if (username.length < 3) {
      return res.render('admin/change-password', { error: 'Username must be at least 3 characters', success: null, admin });
    }
    const { rows: exists } = await db.execute({ sql: 'SELECT id FROM admins WHERE username = ? AND id != ?', args: [username, admin.id] });
    if (exists.length > 0) {
      return res.render('admin/change-password', { error: 'Username already taken', success: null, admin });
    }
    await db.execute({ sql: 'UPDATE admins SET username = ? WHERE id = ?', args: [username, admin.id] });
    req.session.admin.username = username;
    updated = true;
  }

  if (newPassword) {
    if (newPassword !== confirmPassword) {
      return res.render('admin/change-password', { error: 'New passwords do not match', success: null, admin });
    }
    if (newPassword.length < 6) {
      return res.render('admin/change-password', { error: 'New password must be at least 6 characters', success: null, admin });
    }
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await db.execute({ sql: 'UPDATE admins SET password = ? WHERE id = ?', args: [hashedPassword, admin.id] });
    updated = true;
  }

  if (updated) {
    const { rows: fresh } = await db.execute({ sql: 'SELECT * FROM admins WHERE id = ?', args: [admin.id] });
    res.render('admin/change-password', { error: null, success: 'Account updated successfully', admin: fresh[0] });
  } else {
    res.render('admin/change-password', { error: 'No changes made', success: null, admin });
  }
});

module.exports = router;
