/* ==========================================================================
   HOLIDAYS — fetches public holidays from free APIs (no key needed).
   Primary: Indian Holiday Calendar API (calendar-api-d7a8.onrender.com)
   Fallback: date.nager.at (for India or other countries)
   Caches to file + memory for instant reload.
   ========================================================================== */
const https = require('https');
const fs = require('fs');
const path = require('path');

const cache = new Map();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour memory
const CACHE_FILE = path.join(__dirname, '..', 'data', 'holidays-cache.json');

// Load file cache on startup
let fileCache = {};
try {
  if (fs.existsSync(CACHE_FILE)) {
    fileCache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
  }
} catch {}

function saveFileCache() {
  try {
    const dir = path.dirname(CACHE_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(CACHE_FILE, JSON.stringify(fileCache, null, 2));
  } catch {}
}

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timeout')), 5000);
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        clearTimeout(timer);
        if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    }).on('error', (e) => { clearTimeout(timer); reject(e); });
  });
}

/**
 * Get public holidays for a given year and country.
 * @param {number} year - e.g. 2026
 * @param {string} countryCode - ISO 3166-1 alpha-2 (default: 'IN')
 * @returns {Object} { 'YYYY-MM-DD': { name, localName } }
 */
async function getHolidays(year, countryCode) {
  const cc = (countryCode || 'IN').toUpperCase();
  const key = `${year}-${cc}`;

  // Memory cache check
  if (cache.has(key)) {
    const entry = cache.get(key);
    if (Date.now() - entry.ts < CACHE_TTL) return entry.data;
  }

  // File cache check (instant)
  if (fileCache[key]) {
    cache.set(key, { data: fileCache[key], ts: Date.now() - CACHE_TTL + 60000 });
    return fileCache[key];
  }

  let map = {};

  /* --- Try primary API (Indian Holiday Calendar) for India --- */
  if (cc === 'IN') {
    try {
      const url = `https://calendar-api-d7a8.onrender.com/v1/holidays?country=IN&year=${year}`;
      const raw = await fetchJSON(url);
      (raw.data || []).forEach(h => {
        map[h.date] = { name: h.name, localName: h.localName || h.name };
      });
    } catch (err) {
      console.log('Primary holiday API failed, trying fallback...');
    }
  }

  /* --- Fallback: date.nager.at --- */
  if (Object.keys(map).length === 0) {
    try {
      const url = `https://date.nager.at/api/v3/PublicHolidays/${year}/${cc}`;
      const raw = await fetchJSON(url);
      raw.forEach(h => {
        map[h.date] = { name: h.name, localName: h.localName || h.name };
      });
    } catch (err) {
      console.error('Holiday fetch failed (both APIs):', err.message);
    }
  }

  if (Object.keys(map).length > 0) {
    cache.set(key, { data: map, ts: Date.now() });
    fileCache[key] = map;
    saveFileCache();
  }

  return map;
}

/**
 * Get holidays synchronously from cache (for fast page load)
 */
function getHolidaysSync(year, countryCode) {
  const cc = (countryCode || 'IN').toUpperCase();
  const key = `${year}-${cc}`;
  return fileCache[key] || {};
}

module.exports = { getHolidays, getHolidaysSync };
