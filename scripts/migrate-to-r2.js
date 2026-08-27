/* ==========================================================================
   MIGRATION SCRIPT — Downloads all Unsplash/Pexels assets and uploads to R2.
   Run:   node scripts/migrate-to-r2.js           (upload only)
          node scripts/migrate-to-r2.js --apply    (upload + update content.js & index.html)
   ========================================================================== */
require('dotenv').config();
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const BUCKET = process.env.R2_BUCKET;
const PUBLIC_URL = (process.env.R2_PUBLIC_URL || '').replace(/\/+$/, '');

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || ''
  }
});

/* ---- All assets to migrate ---- */
const IMAGES = [
  { id: '1519741497674-611481863552', sizes: [2000, 1800, 1100], name: 'hero' },
  { id: '1554080353-a576cf803bda', sizes: [1000], name: 'about-portrait' },
  { id: '1511285560929-80b456fea0bc', sizes: [900, 1000], name: 'service-1' },
  { id: '1532712938310-34cb3982ef74', sizes: [900], name: 'service-2' },
  { id: '1529634806980-85c3dd6d34ac', sizes: [900], name: 'service-3' },
  { id: '1508214751196-bcfd4ca60f91', sizes: [900], name: 'service-4' },
  { id: '1502920917128-1aa500764cbd', sizes: [900], name: 'service-5' },
  { id: '1544078751-58fee2d8a03b', sizes: [900], name: 'service-6' },
  { id: '1591604466107-ec97de577aff', sizes: [900], name: 'service-7' },
  { id: '1494955870715-979ca4f13bf0', sizes: [900], name: 'service-8' },
  { id: '1583939003579-730e3918a45a', sizes: [1400], name: 'story-1-cover' },
  { id: '1522673607200-164d1b6ce486', sizes: [1400], name: 'story-1-1' },
  { id: '1519011985187-444d62641929', sizes: [1200], name: 'story-1-2' },
  { id: '1525258946800-98cfd641d0de', sizes: [1200], name: 'story-1-3' },
  { id: '1469371670807-013ccf25f16a', sizes: [1400, 1300], name: 'story-2-cover' },
  { id: '1519225421980-715cb0215aed', sizes: [1400, 1300], name: 'story-2-1' },
  { id: '1520854221256-17451cc331bf', sizes: [1200], name: 'story-2-2' },
  { id: '1546032996-6dfacbacbf3f', sizes: [1200], name: 'story-2-3' },
  { id: '1522413452208-996ff3f3e740', sizes: [1400, 1000], name: 'story-3-cover' },
  { id: '1550005809-91ad75fb315f', sizes: [1200], name: 'story-3-1' },
  { id: '1606216794074-735e91aa2c92', sizes: [1200], name: 'story-3-2' },
  { id: '1595407753234-0882f1e77954', sizes: [1200], name: 'story-3-3' },
  { id: '1537633552985-df8429e8048b', sizes: [1400], name: 'story-4-cover' },
  { id: '1509927083803-4bd519298ac4', sizes: [1400, 1100], name: 'story-4-1' },
  { id: '1520390138845-fd2d229dd553', sizes: [1200], name: 'story-4-2' },
  { id: '1543946207-39bd91e70ca7', sizes: [1200], name: 'story-4-3' },
  { id: '1515934751635-c81c6bc9a2d8', sizes: [1400], name: 'story-5-cover' },
  { id: '1494774157365-9e04c6720e47', sizes: [1200], name: 'story-5-1' },
  { id: '1519671482749-fd09be7ccebf', sizes: [1200, 900], name: 'story-5-2' },
  { id: '1521543832500-49e69fb2bea2', sizes: [1200], name: 'story-5-3' },
  { id: '1465495976277-4387d4b0b4c6', sizes: [2000, 1400], name: 'cta-bg' },
];

const VIDEOS = [
  { url: 'https://videos.pexels.com/video-files/8247011/8247011-hd_1280_720_25fps.mp4', name: 'hero-video-mobile', key: 'wedding/video/hero-video-mobile.mp4' },
  { url: 'https://videos.pexels.com/video-files/8247011/8247011-hd_1920_1080_25fps.mp4', name: 'hero-video-desktop', key: 'wedding/video/hero-video-desktop.mp4' },
];

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(dest);
    mod.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close();
        fs.unlinkSync(dest);
        return download(res.headers.location, dest).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        file.close();
        fs.unlinkSync(dest);
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
    }).on('error', (err) => { file.close(); fs.unlinkSync(dest); reject(err); });
  });
}

async function uploadToR2(filePath, key, contentType) {
  const body = fs.readFileSync(filePath);
  await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: body, ContentType: contentType, ACL: 'public-read' }));
  return `${PUBLIC_URL}/${key}`;
}

async function main() {
  if (!process.env.R2_ACCOUNT_ID) {
    console.error('ERROR: R2 env vars not set. Fill in .env first.');
    process.exit(1);
  }

  const tmpDir = path.join(__dirname, '..', 'uploads', '_migration_tmp');
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

  const urlMap = {};
  let total = IMAGES.length * 2 + VIDEOS.length; // rough count
  let done = 0;

  console.log(`\n migration: ${IMAGES.length} unique images, ${VIDEOS.length} videos\n`);

  /* --- Images --- */
  for (const img of IMAGES) {
    for (const w of img.sizes) {
      const srcUrl = `https://images.unsplash.com/photo-${img.id}?q=78&w=${w}&auto=format&fit=crop`;
      const tmpFile = path.join(tmpDir, `${img.id}-${w}.jpg`);
      const r2Key = `wedding/images/${img.id}-${w}.jpg`;
      const r2Url = `${PUBLIC_URL}/${r2Key}`;

      process.stdout.write(`  [${++done}/${total}] ${img.name} @${w}w ... `);
      try {
        await download(srcUrl, tmpFile);
        await uploadToR2(tmpFile, r2Key, 'image/jpeg');
        urlMap[`unsplash-${img.id}-${w}`] = r2Url;
        console.log('OK');
      } catch (err) {
        console.log('FAILED: ' + err.message);
      }
    }
  }

  /* --- Videos --- */
  for (const vid of VIDEOS) {
    const tmpFile = path.join(tmpDir, `${vid.name}.mp4`);
    process.stdout.write(`  [${++done}/${total}] ${vid.name} ... `);
    try {
      await download(vid.url, tmpFile);
      await uploadToR2(tmpFile, vid.key, 'video/mp4');
      urlMap[vid.name] = `${PUBLIC_URL}/${vid.key}`;
      console.log('OK');
    } catch (err) {
      console.log('FAILED: ' + err.message);
    }
  }

  /* Cleanup temp files */
  fs.rmSync(tmpDir, { recursive: true, force: true });

  /* Write URL map */
  const mapPath = path.join(__dirname, '..', 'r2-url-map.json');
  fs.writeFileSync(mapPath, JSON.stringify(urlMap, null, 2));
  console.log(`\n migration complete. URL map saved to r2-url-map.json`);
  console.log(` total uploaded: ${Object.keys(urlMap).length} assets\n`);

  /* --apply: auto-update content.js and index.html */
  if (process.argv.includes('--apply')) {
    console.log(' applying R2 URLs to content.js and index.html ...');

    /* --- Update content.js: replace img() helper with direct R2 URLs --- */
    const contentPath = path.join(__dirname, '..', 'js', 'content.js');
    let content = fs.readFileSync(contentPath, 'utf8');

    // Replace the img() helper function to return R2 URLs
    content = content.replace(
      /function img\(id, w, q, h\) \{[\s\S]*?\n\}/,
      `function img(id, w, q, h) {
  var key = "unsplash-" + id + "-" + w;
  var r2 = window.__R2_MAP && window.__R2_MAP[key];
  if (r2) return r2;
  var url = "https://images.unsplash.com/photo-" + id +
    "?q=" + (q || 78) + "&w=" + w + "&auto=format&fit=crop";
  if (h) url += "&h=" + h;
  return url;
}`
    );

    // Add R2 map injection at the top of the file
    const r2MapScript = `\n/* Auto-injected R2 URL map — generated by migrate-to-r2.js */\nwindow.__R2_MAP = ${JSON.stringify(urlMap)};\n\n`;
    content = r2MapScript + content;

    fs.writeFileSync(contentPath, content);
    console.log('  content.js updated');

    /* --- Update index.html: replace hero image, video, poster, OG, preload --- */
    const htmlPath = path.join(__dirname, '..', 'index.html');
    let html = fs.readFileSync(htmlPath, 'utf8');

    // Hero image (heroImg src)
    const heroImgR2 = urlMap['unsplash-1519741497674-611481863552-2000'];
    if (heroImgR2) {
      html = html.replace(
        /(<img id="heroImg" src=")[^"]*(")/,
        `$1${heroImgR2}$2`
      );
    }

    // Hero video poster
    const heroPosterR2 = urlMap['unsplash-1519741497674-611481863552-2000'];
    if (heroPosterR2) {
      html = html.replace(
        /(poster=")[^"]*(")/,
        `$1${heroPosterR2}$2`
      );
    }

    // Hero video sources
    const heroVideoMobileR2 = urlMap['hero-video-mobile'];
    const heroVideoDesktopR2 = urlMap['hero-video-desktop'];
    if (heroVideoMobileR2) {
      html = html.replace(
        /(<source media="\(max-width: 768px\)" src=")[^"]*(")/,
        `$1${heroVideoMobileR2}$2`
      );
    }
    if (heroVideoDesktopR2) {
      html = html.replace(
        /(<source src=")[^"]*(" type="video\/mp4")/,
        `$1${heroVideoDesktopR2}$2`
      );
    }

    // OG image
    const ogR2 = urlMap['unsplash-1519741497674-611481863552-1800'] || heroImgR2;
    if (ogR2) {
      html = html.replace(
        /(og:image" content=")[^"]*(")/,
        `$1${ogR2}$2`
      );
    }

    // Preload
    if (heroImgR2) {
      html = html.replace(
        /(rel="preload" as="image" href=")[^"]*(")/,
        `$1${heroImgR2}$2`
      );
    }

    // About portrait
    const aboutR2 = urlMap['unsplash-1554080353-a576cf803bda-1000'];
    if (aboutR2) {
      html = html.replace(
        /(<img src=")[^"]*(")\s*\n\s*alt="Portrait of Isabella/,
        `$1${aboutR2}$2\n               alt="Portrait of Isabella`
      );
    }

    // CTA background
    const ctaR2 = urlMap['unsplash-1465495976277-4387d4b0b4c6-2000'];
    if (ctaR2) {
      html = html.replace(
        /(background-image:url\(')[^']*('\))/,
        `$1${ctaR2}$2`
      );
    }

    fs.writeFileSync(htmlPath, html);
    console.log('  index.html updated');
    console.log('\n done! Restart the server to see changes.\n');
  }
}

main().catch(err => { console.error('Migration failed:', err); process.exit(1); });
