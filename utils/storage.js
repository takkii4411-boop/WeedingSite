/* ==========================================================================
   STORAGE SERVICE — per-gallery backend selection.
   R2, Cloudinary (compress), Telegram. No local fallback.
   Default: Telegram (free, unlimited)
   ========================================================================== */
const fs = require('fs');
const path = require('path');

let loaded = {};

function loadBackend(name) {
  if (loaded[name]) return loaded[name];
  try {
    if (name === 'r2') loaded[name] = require('./storage-r2');
    if (name === 'cloudinary') loaded[name] = require('./cloudinary');
    if (name === 'telegram') loaded[name] = require('./telegram-storage');
  } catch (e) { /* not installed */ }
  return loaded[name] || null;
}

function getBackend(name) {
  const requested = name || '(none)';
  console.log(`[Storage] getBackend called: requested="${requested}", STORAGE_BACKEND="${process.env.STORAGE_BACKEND || ''}"`);

  // If specific backend requested (from gallery toggle)
  if (name === 'r2') {
    const impl = loadBackend('r2');
    const configured = impl && impl.isConfigured();
    console.log(`[Storage] R2 check: loaded=${!!impl}, configured=${configured}`);
    if (configured) return { name: 'r2', impl };
  }
  if (name === 'cloudinary') {
    const impl = loadBackend('cloudinary');
    const configured = impl && impl.isConfigured();
    console.log(`[Storage] Cloudinary check: loaded=${!!impl}, configured=${configured}`);
    if (configured) return { name: 'cloudinary', impl };
  }
  if (name === 'telegram') {
    const impl = loadBackend('telegram');
    const configured = impl && impl.isConfigured();
    console.log(`[Storage] Telegram check: loaded=${!!impl}, configured=${configured}`);
    if (configured) return { name: 'telegram', impl };
  }

  // Default: STORAGE_BACKEND env var ke hisaab se, phir Telegram, then R2, then Cloudinary
  const envBackend = process.env.STORAGE_BACKEND;
  if (envBackend) {
    const impl = loadBackend(envBackend);
    const configured = impl && impl.isConfigured();
    console.log(`[Storage] ENV fallback "${envBackend}": loaded=${!!impl}, configured=${configured}`);
    if (configured) return { name: envBackend, impl };
  }

  const tg = loadBackend('telegram');
  const tgOk = tg && tg.isConfigured();
  console.log(`[Storage] Fallback telegram: loaded=${!!tg}, configured=${tgOk}`);
  if (tgOk) return { name: 'telegram', impl: tg };

  const r2 = loadBackend('r2');
  const r2Ok = r2 && r2.isConfigured();
  console.log(`[Storage] Fallback r2: loaded=${!!r2}, configured=${r2Ok}`);
  if (r2Ok) return { name: 'r2', impl: r2 };

  const cld = loadBackend('cloudinary');
  const cldOk = cld && cld.isConfigured();
  console.log(`[Storage] Fallback cloudinary: loaded=${!!cld}, configured=${cldOk}`);
  if (cldOk) return { name: 'cloudinary', impl: cld };

  console.error(`[Storage] NO BACKEND CONFIGURED! STORAGE_BACKEND="${process.env.STORAGE_BACKEND || ''}" R2_ACCOUNT_ID="${process.env.R2_ACCOUNT_ID || ''}" R2_BUCKET="${process.env.R2_BUCKET || ''}"`);
  throw new Error('No storage configured! Set up R2, Cloudinary, or Telegram in .env');
}

function isConfigured() {
  try {
    getBackend();
    return true;
  } catch {
    return false;
  }
}

/**
 * Upload with gallery-specific folder structure
 * @param {string} filePath - local temp file path
 * @param {string} originalName - original filename
 * @param {string} resourceType - "image" or "video"
 * @param {string} gallerySlug - gallery identifier
 * @param {string} backendHint - 'r2', 'cloudinary', or 'telegram'
 * @param {string} clientName - client name for folder
 */
async function uploadAsset(filePath, originalName, resourceType, gallerySlug, backendHint, clientName) {
  const { name, impl } = getBackend(backendHint || process.env.STORAGE_BACKEND || 'telegram');

  // Telegram 50MB limit — if oversized, try R2
  const fileSize = fs.statSync(filePath).size;
  if (name === 'telegram' && fileSize > 50 * 1024 * 1024) {
    const r2 = loadBackend('r2');
    if (r2 && r2.isConfigured()) {
      console.log(`[Storage] ${(fileSize / 1024 / 1024).toFixed(1)}MB > 50MB Telegram limit → R2`);
      return r2.uploadAsset(filePath, originalName, resourceType, gallerySlug, clientName);
    }
  }

  console.log(`[Storage] Uploading to ${name}: ${originalName}`);
  const result = await impl.uploadAsset(filePath, originalName, resourceType, gallerySlug, clientName);
  result.backend = name;
  return result;
}

async function deleteAsset(storageId, backendHint) {
  if (!storageId) return;
  if (storageId === 'local' || storageId.length < 10) return;

  if (backendHint) {
    const { impl } = getBackend(backendHint);
    if (impl) {
      try { await impl.deleteAsset(storageId); } catch (e) { console.error(`[Storage] Delete from ${backendHint} failed:`, e.message); }
      return;
    }
  }

  const backends = ['telegram', 'r2', 'cloudinary'];
  for (const name of backends) {
    const impl = loadBackend(name);
    if (impl && impl.isConfigured()) {
      try { await impl.deleteAsset(storageId); console.log(`[Storage] Deleted from ${name}`); return; }
      catch (e) { /* try next */ }
    }
  }
}

async function deleteFolder(folderPath, backendHint) {
  if (!folderPath) return;
  const backend = backendHint || process.env.STORAGE_BACKEND || 'telegram';
  const impl = loadBackend(backend);
  if (impl && impl.deleteFolder) await impl.deleteFolder(folderPath);
}

module.exports = { uploadAsset, deleteAsset, deleteFolder, isConfigured, getBackend };
