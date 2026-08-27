/* ==========================================================================
   HOLIDAYS — fetches public holidays from free APIs (no key needed).
   Primary: tallyfy.com/national-holidays (static JSON, reliable)
   Fallback: date.nager.at (for India or other countries)
   Caches to file + memory for instant reload.
   ========================================================================== */
const https = require('https');
const fs = require('fs');
const path = require('path');

const cache = new Map();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour memory
const CACHE_FILE = path.join(__dirname, '..', 'data', 'holidays-cache.json');

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
    const timer = setTimeout(() => reject(new Error('Timeout')), 8000);
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

async function getHolidays(year, countryCode) {
  const cc = (countryCode || 'IN').toUpperCase();
  const key = `${year}-${cc}`;

  if (cache.has(key)) {
    const entry = cache.get(key);
    if (Date.now() - entry.ts < CACHE_TTL) return entry.data;
  }

  if (fileCache[key]) {
    cache.set(key, { data: fileCache[key], ts: Date.now() - CACHE_TTL + 60000 });
    return fileCache[key];
  }

  let map = {};

  /* --- Primary: tallyfy.com (India only, static JSON, reliable) --- */
  if (cc === 'IN') {
    try {
      const url = `https://tallyfy.com/national-holidays/api/IN/${year}.json`;
      const raw = await fetchJSON(url);
      (raw.holidays || []).forEach(h => {
        const d = h.observed_date || h.date;
        map[d] = { name: h.name, localName: h.local_name || h.name };
      });
    } catch (err) {
      // Primary down, try fallback
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
      // Both failed — holidays will be empty, schedule still works
    }
  }

  if (Object.keys(map).length > 0) {
    cache.set(key, { data: map, ts: Date.now() });
    fileCache[key] = map;
    saveFileCache();
  }

  return map;
}

function getHolidaysSync(year, countryCode) {
  const cc = (countryCode || 'IN').toUpperCase();
  const key = `${year}-${cc}`;
  return fileCache[key] || {};
}

module.exports = { getHolidays, getHolidaysSync };
