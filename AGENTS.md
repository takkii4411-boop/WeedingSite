# Wedding Portfolio — Project State (standalone)

Cinematic wedding filmmaker site (landing + story pages) with a **separate, self-contained backend** in this folder. Nothing is used from `D:\wedding-site` — that folder is NOT part of this project.

## Tech Stack
- **Frontend:** Static landing (`index.html`) + story pages (`story.html`), vanilla JS, GSAP (local `js/gsap.min.js`)
- **Backend:** Node.js + Express 5 (`server.js`, port 3000)
- **Database:** SQLite via better-sqlite3 (`data/wedding.db`, auto-created) — *temporary for testing; Turso (libSQL) planned later*
- **Media storage:** Cloudinary (upload + delete services in `utils/cloudinary.js`), local `uploads/` fallback when Cloudinary is not configured
- **Admin:** Session-based login (bcrypt), EJS views

## Project Structure
```
server.js                  ← entry point (port 3000); serves landing at /, /story.html
package.json               ← npm start
.env                       ← Cloudinary creds, session secret (SMTP optional)
.env.example
database/db.js             ← SQLite schema: admins, contacts(+status), site_content, site_media
utils/
├── cloudinary.js          ← SERVICE 1: upload (image+video) · SERVICE 2: delete
├── siteSlots.js           ← registry of every editable text/media slot + validation
└── mail.js                ← optional SMTP inquiry email (skipped when not configured)
routes/
├── auth.js                ← hidden admin login/logout
├── admin.js               ← dashboard, inquiries (accept/deny), schedule, site editor
├── api.js                 ← GET /api/site/content · inline editor endpoints (admin)
└── contact.js             ← POST /api/contact (saves inquiry, status=pending)
views/admin/               ← login, sidebar, dashboard, inquiries, schedule, site-editor (.ejs)
public/css/admin.css       ← admin panel styles
index.html / story.html    ← landing (data-cms attributes = editable slots)
css/styles.css, js/*       ← landing assets (camera transition, cms.js, form.js…)
data/wedding.db            ← SQLite (auto-created, gitignore)
uploads/                   ← local media fallback
```

## Built So Far (working)
1. **Cinematic landing** — video hero (Pexels, poster fallback), curtain reveal, film grain, iris
   zoom-out scroll transition (hero → circle → cine-camera → reel zoom → photo splits into
   frames → frames wind up → About). GSAP ScrollTrigger, reduced-motion fallback.
2. **Contact form → DB** — landing form posts to `/api/contact`; saved with `status='pending'`
   (name, email, phone, date, location, event type, budget, guests, message).
3. **Admin panel (hidden)** — `/admin/auth/login` (default `admin` / `admin123`), noindex headers,
   zero links from the landing page.
   - **Dashboard** — pending/accepted counts, recent inquiries
   - **Inquiries** — filter tabs (all/pending/accepted/denied), full lead details,
     **Accept / Deny / Reset** buttons (live, no reload), delete
   - **Schedule** — every inquiry with an event date, soonest first, countdown days
4. **CMS (landing editing)** — two ways:
   - **Inline editor (primary):** when logged in as admin, the landing page shows a floating
     toolbar (Edit: On/Off · Panel · Logout). Click any text → edit in place (saved on
     blur/Enter). Click any photo/video → file picker → uploads to Cloudinary → swaps live.
     Covers: hero text/buttons, about, section headings, services (text+image), stories
     (title/couple/location/date/excerpt + cover), testimonials, gallery (12), photo wall (9),
     CTA, contact info, footer — plus story detail pages (`story.html?id=slug`: title, couple,
     location, date, 2 paragraphs, cover, 3 gallery images).
   - **Site Editor page (bulk fallback):** grouped text fields + media upload cards.
5. **Cloudinary services** — `uploadAsset()` / `deleteAsset()` with image+video support;
   per-slot replace deletes the previous file. Local `uploads/` fallback if unconfigured.
6. **DB schema** — `admins`, `contacts` (with `status`, `location`, `budget`, `guests`),
   `site_content` (text slots), `site_media` (media slots). Simple SQL everywhere so the
   layer can be swapped to Turso later.

## Running
```bash
npm start        # http://localhost:3000
```
Admin (hidden): `http://localhost:3000/admin/auth/login` — admin / admin123
Landing CMS check: `GET /api/site/content` · admin check: `GET /api/admin/status`

## Known Issues / Notes
1. **`index.html` is missing the cms.js script tag** — inline editing will not activate until
   this line is added after the form.js script tag:
   `<script src="js/cms.js?v=6" defer></script>`
2. Default admin password should be changed (admin/admin123).
3. `.env` currently holds the user's real Cloudinary credentials (account `lkv3wcmw`).
4. SQLite file is local — for deployment use a persistent disk or migrate to Turso.
5. Landing hero video is from Pexels CDN; admin can replace it via inline editor (hero_video slot).
6. `story.html` script tags have `?v=6` cache-busting params; index.html has them on some tags —
   bump versions (or hard-refresh) when editing JS/CSS.

## NEXT STEPS (in order)
1. **Add the missing cms.js script tag to `index.html`** (see Known Issues #1) — without it the
   inline editor never activates. Then verify: toolbar appears when logged in.
2. **End-to-end testing:**
   - Submit landing contact form → check it appears under Admin → Inquiries (pending)
   - Accept / Deny / Reset buttons → status changes persist
   - Schedule page shows the accepted wedding date with countdown
   - Inline edit: change hero headline + upload a gallery image → reload → persists
   - Story page: edit title/paragraphs, replace cover image
3. **Change default admin password** (add a "change password" screen in the admin panel).
4. **Turso migration** (later): swap `better-sqlite3` for `@libsql/client` — queries are plain
   SQL and centralised, so routes need only the async/await wrapper. Keep `site_content` /
   `site_media` / `contacts` schemas identical.
5. **Optional SMTP** — uncomment SMTP_* in `.env` with a Gmail App Password for inquiry emails.
6. **Deployment** (Render/host): set env vars, persistent disk for `data/` + `uploads/`
   (or Turso + Cloudinary only), and force HTTPS cookies (`cookie.secure`).
7. **Polish backlog:** language switcher (EN/IT) real translation, story detail "related"
   covers using slug slots, admin pagination if inquiries grow.
