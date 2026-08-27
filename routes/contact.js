const express = require('express');
const { db } = require('../database/db');
const { sendContactEmail } = require('../utils/mail');
const router = express.Router();

router.post('/', async (req, res) => {
  const { name, email, phone, date, event_date, state, location, eventType, event_type,
          budget, message } = req.body;
  if (!name || !email || !message) {
    return res.status(400).json({ error: 'Name, email and message are required' });
  }
  const fullLocation = [state, location].filter(Boolean).join(', ') || location || null;
  try {
    await db.execute({
      sql: `INSERT INTO contacts (name, email, phone, event_type, event_date, location, budget, message, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      args: [
        name, email, phone || null,
        event_type || eventType || null,
        event_date || date || null,
        fullLocation, budget || null,
        message
      ]
    });
    await sendContactEmail({ name, email, phone, event_type, event_date, message });
    res.json({ success: true, message: 'Thank you! We will get back to you soon.' });
  } catch (err) {
    console.error('contact save failed:', err.message);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

module.exports = router;
