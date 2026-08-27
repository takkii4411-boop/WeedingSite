/* ==========================================================================
   CLOUDINARY — upload + delete with auto-compress.
   Each gallery gets its own folder: galleries/{clientName}/{filename}
   ========================================================================== */
const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

function isConfigured() {
  return !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);
}

function sanitizeFolderName(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50);
}

/**
 * Upload to Cloudinary with auto-compress + client folder
 * Path: galleries/{clientName}/{filename}
 */
async function uploadAsset(filePath, originalName, resourceType, gallerySlug, clientName) {
  const type = resourceType === 'video' ? 'video' : 'image';
  const folderName = clientName ? sanitizeFolderName(clientName) : 'uploads';
  const folder = `galleries/${folderName}`;
  const publicId = Date.now() + '-' + originalName.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9]/g, '_');

  const result = await cloudinary.uploader.upload(filePath, {
    folder,
    public_id: publicId,
    resource_type: type,
    quality: 'auto',
    fetch_format: 'auto'
  });

  return {
    storageId: result.public_id,
    url: result.secure_url,
    resourceType: type,
    originalName
  };
}

/**
 * Delete from Cloudinary
 */
async function deleteAsset(storageId) {
  if (!storageId) return;
  try {
    await cloudinary.uploader.destroy(storageId);
  } catch (err) {
    console.error('Cloudinary delete failed:', err.message);
  }
}

module.exports = { uploadAsset, deleteAsset, isConfigured };
