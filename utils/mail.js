/* Optional inquiry email notification — silently skipped when SMTP is not
   configured in .env. The inquiry is always saved to the database first. */
const nodemailer = require('nodemailer');

function smtpReady() {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

async function sendContactEmail(lead) {
  if (!smtpReady()) return { skipped: true };
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: String(process.env.SMTP_SECURE) === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    });
    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: process.env.NOTIFY_EMAIL || process.env.SMTP_USER,
      subject: 'New inquiry — ' + (lead.name || 'website'),
      text:
        'Name: ' + lead.name + '\n' +
        'Email: ' + lead.email + '\n' +
        'Phone: ' + (lead.phone || '-') + '\n' +
        'Event: ' + (lead.event_type || '-') + '\n' +
        'Date: ' + (lead.event_date || '-') + '\n\n' +
        lead.message
    });
    return { sent: true };
  } catch (err) {
    console.error('Inquiry email failed:', err.message);
    return { sent: false };
  }
}

module.exports = { sendContactEmail };
