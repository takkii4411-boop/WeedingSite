/* ==========================================================================
   HOLIDAYS — Indian festivals & government holidays.
   Primary: calendar-bharat (GitHub Pages JSON — 50+ festivals, no key)
   Fallback: indian-festival-api.vercel.app (40+ festivals)
   Fallback 2: tallyfy.com (10 national holidays)
   Caches to file + memory for instant reload.
   ========================================================================== */
const https = require('https');
const fs = require('fs');
const path = require('path');

const cache = new Map();
const CACHE_TTL = 60 * 60 * 1000;
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
    const timer = setTimeout(() => reject(new Error('Timeout')), 10000);
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

function parseCalendarBharatDate(dateStr) {
  const match = dateStr.match(/^(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d+),\s+(\d{4})/);
  if (!match) return null;
  const months = { January:'01', February:'02', March:'03', April:'04', May:'05', June:'06', July:'07', August:'08', September:'09', October:'10', November:'11', December:'12' };
  return `${match[3]}-${months[match[1]]}-${match[2].padStart(2, '0')}`;
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

  /* --- Primary: calendar-bharat (50+ festivals + govt holidays, keyless) --- */
  if (cc === 'IN') {
    try {
      const raw = await fetchJSON(`https://jayantur13.github.io/calendar-bharat/calendar/${year}.json`);
      const yearData = raw[String(year)] || {};
      Object.values(yearData).forEach(monthData => {
        Object.entries(monthData).forEach(([dateStr, info]) => {
          const type = (info.type || '').toLowerCase();
          if (type.includes('festival') || type.includes('government')) {
            const date = parseCalendarBharatDate(dateStr);
            if (date) {
              map[date] = { name: info.event, localName: info.event };
            }
          }
        });
      });
    } catch (err) {}
  }

  /* --- Fallback 1: indian-festival-api (40+ festivals) --- */
  if (Object.keys(map).length === 0 && cc === 'IN') {
    try {
      const raw = await fetchJSON('https://indian-festival-api.vercel.app/api/festivals');
      (raw.data || []).forEach(h => {
        const dateKey = 'date_' + year;
        const date = h[dateKey];
        if (date && !map[date]) {
          map[date] = { name: h.name, localName: h.name };
        }
      });
    } catch (err) {}
  }

  /* --- Fallback 2: tallyfy.com (10 national holidays) --- */
  if (Object.keys(map).length === 0 && cc === 'IN') {
    try {
      const raw = await fetchJSON(`https://tallyfy.com/national-holidays/api/IN/${year}.json`);
      (raw.holidays || []).forEach(h => {
        const d = h.observed_date || h.date;
        if (d && !map[d]) {
          map[d] = { name: h.name, localName: h.name };
        }
      });
    } catch (err) {}
  }

  /* --- Fallback 3: date.nager.at --- */
  if (Object.keys(map).length === 0) {
    try {
      const raw = await fetchJSON(`https://date.nager.at/api/v3/PublicHolidays/${year}/${cc}`);
      raw.forEach(h => {
        map[h.date] = { name: h.name, localName: h.localName || h.name };
      });
    } catch (err) {}
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
