/* ==========================================================================
   CLOUDFLARE R2 STORAGE — upload + delete via S3-compatible API.
   Each gallery gets its own folder: galleries/{clientName}/{filename}
   ========================================================================== */
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const fs = require('fs');
const path = require('path');

const BUCKET = process.env.R2_BUCKET || process.env.R2_BUCKET_NAME;
const PUBLIC_URL = (process.env.R2_PUBLIC_URL || '').replace(/\/+$/, '');

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || ''
  }
});

function isConfigured() {
  return !!(process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID &&
            process.env.R2_SECRET_ACCESS_KEY && (process.env.R2_BUCKET || process.env.R2_BUCKET_NAME) && process.env.R2_PUBLIC_URL);
}

/**
 * Sanitize client name for use as folder name
 */
function sanitizeFolderName(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50);
}

/**
 * Upload to R2 with client-specific folder
 * Path: galleries/{clientName}/{timestamp}-{filename}
 */
async function uploadAsset(filePath, originalName, resourceType, gallerySlug, clientName) {
  const type = resourceType === 'video' ? 'video' : 'image';
  const ext = path.extname(originalName).toLowerCase();
  const base = originalName.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9]/g, '_');

  // Client name se folder banao, fallback to 'uploads'
  const folderName = clientName ? sanitizeFolderName(clientName) : 'uploads';
  const folder = `galleries/${folderName}`;
  const key = `${folder}/${Date.now()}-${base}${ext}`;

  const contentType = type === 'video'
    ? { '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime' }[ext] || 'video/mp4'
    : { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp' }[ext] || 'image/jpeg';

  const fileStream = fs.createReadStream(filePath);
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: fileStream,
    ContentType: contentType,
    ACL: 'public-read'
  }));

  const url = `${PUBLIC_URL}/${key}`;
  return { storageId: key, url, resourceType: type, originalName };
}

async function deleteAsset(storageId) {
  if (!storageId) return;
  try {
    await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: storageId }));
  } catch (err) {
    console.error('R2 delete failed:', err.message);
  }
}

module.exports = { uploadAsset, deleteAsset, isConfigured };
