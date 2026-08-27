/* ==========================================================================
   TELEGRAM STORAGE — free unlimited file storage via Telegram Bot API.
   Files are sent to a saved messages / channel and URLs are extracted.
   Max file size: 50MB (document mode, NO compression).
   Each gallery gets its own caption tag for organization.
   ========================================================================== */
const https = require('https');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';
const API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;

function isConfigured() {
  return !!(BOT_TOKEN && CHAT_ID);
}

/**
 * Get file path from Telegram using file_id.
 */
function getFilePath(fileId) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${API_BASE}/getFile`);
    url.searchParams.set('file_id', fileId);
    https.get(url.href, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (!json.ok) return reject(new Error(json.description || 'getFile failed'));
          resolve(json.result.file_path);
        } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

/**
 * Upload a file to Telegram (as document — no compression).
 * Caption includes gallery slug for organization.
 */
async function uploadAsset(filePath, originalName, resourceType, gallerySlug, clientName) {
  const type = resourceType === 'video' ? 'video' : 'image';

  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append('chat_id', CHAT_ID);
    form.append('document', fs.createReadStream(filePath), { filename: originalName });

    // Client name + gallery caption for organization
    const caption = `[${clientName || gallerySlug || 'uploads'}] ${type}: ${originalName}`;
    form.append('caption', caption);

    const url = new URL(`${API_BASE}/sendDocument`);
    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: form.getHeaders(),
      timeout: 120000
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', async () => {
        try {
          const json = JSON.parse(data);
          if (!json.ok) return reject(new Error(json.description || 'Telegram upload failed'));

          const doc = json.result.document;
          if (!doc) return reject(new Error('No document in response'));

          const fileId = doc.file_id;

          // Get actual file path from Telegram
          const filePath = await getFilePath(fileId);
          const fileUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`;

          resolve({
            storageId: fileId,
            url: fileUrl,
            resourceType: type,
            originalName,
            messageId: json.result.message_id
          });
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Upload timeout')); });

    form.pipe(req);
  });
}

/**
 * Delete a file from Telegram.
 * Telegram Bot API cannot delete messages, so we just log a warning.
 * Skip if storageId is not a valid Telegram file_id (e.g. "r2" from old data).
 */
async function deleteAsset(storageId) {
  if (!storageId) return;
  // Skip invalid file_ids (old R2 data, etc.)
  if (storageId === 'r2' || storageId === 'local' || storageId.length < 10) return;
  // Telegram Bot API doesn't support deleting sent documents
  // The file stays in the channel/chat but won't be served
  console.log(`[Telegram] Note: file ${storageId} cannot be deleted via Bot API (Telegram limitation)`);
}

module.exports = { uploadAsset, deleteAsset, isConfigured };
