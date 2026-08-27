/* ==========================================================================
   STORAGE SERVICE — per-gallery backend selection.
   R2, Cloudinary (compress), Telegram. No local fallback.
   Default: Cloudinary (configured in .env)
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
  // If specific backend requested (from gallery toggle)
  if (name === 'r2') {
    const impl = loadBackend('r2');
    if (impl && impl.isConfigured()) return { name: 'r2', impl };
  }
  if (name === 'cloudinary') {
    const impl = loadBackend('cloudinary');
    if (impl && impl.isConfigured()) return { name: 'cloudinary', impl };
  }
  if (name === 'telegram') {
    const impl = loadBackend('telegram');
    if (impl && impl.isConfigured()) return { name: 'telegram', impl };
  }

  // Default: Cloudinary first, then R2, then Telegram
  const cld = loadBackend('cloudinary');
  if (cld && cld.isConfigured()) return { name: 'cloudinary', impl: cld };

  const r2 = loadBackend('r2');
  if (r2 && r2.isConfigured()) return { name: 'r2', impl: r2 };

  const tg = loadBackend('telegram');
  if (tg && tg.isConfigured()) return { name: 'telegram', impl: tg };

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
  const { name, impl } = getBackend(backendHint || 'cloudinary');

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
  // Skip invalid file_ids
  if (storageId === 'local' || storageId.length < 10) return;
  const { impl } = getBackend(backendHint || 'cloudinary');
  if (impl) return impl.deleteAsset(storageId);
}

module.exports = { uploadAsset, deleteAsset, isConfigured, getBackend };
