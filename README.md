# Isabella Marchetti — Fine-Art Wedding Photography

A premium, cinematic, editorial wedding-photography portfolio website.
Static, dependency-light, and fast — the only external libraries are Google
Fonts and GSAP/ScrollTrigger (both optional; the site degrades gracefully).

## Run it

Any static server works:

```bash
cd wedding-portfolio
python -m http.server 8080
# → http://localhost:8080
```

Opening `index.html` directly in a browser also works (no build step).

## Structure

```
wedding-portfolio/
├── index.html          # one-page experience
├── story.html          # wedding-story template (?id=<slug>)
├── css/styles.css      # full design system
└── js/
    ├── content.js      # ★ ALL editable content lives here
    ├── render.js       # builds services / stories / gallery / wall / testimonials
    ├── camera.js       # signature hero → camera scroll transition
    ├── lightbox.js     # shared full-screen viewer
    ├── main.js         # nav, mobile menu, reveals, parallax
    ├── story.js        # renders the story page
    └── form.js         # inquiry form validation + submission
```

## Editing content (no code knowledge needed)

Open **`js/content.js`** — every section is commented:

| What | Where |
|---|---|
| Name / logo / tagline | `brand` |
| Hero image | `hero.image` |
| Bio, portrait, specialties | `about` |
| Services cards | `services[]` |
| Wedding stories + their pages | `stories[]` |
| Best-work gallery | `gallery[]` |
| Studio photo wall | `wall[]` |
| Testimonials | `testimonials[]` |
| Final CTA text/background | `cta` |
| Contact details | `contactInfo`, `contactHeading` |
| Form endpoint | `formEndpoint` |
| Social links | `socials` |

### Replacing placeholder photographs

Placeholders point to Unsplash. To use your own photos:

1. Put files in an `assets/` folder (e.g. `assets/hero.jpg`).
2. Replace the `img("…", w)` call with a plain path:
   ```js
   image: "assets/hero.jpg",
   ```
3. For gallery items keep the `ratio` value (`"4 / 3"`, `"3 / 4"`, `"16 / 9"`),
   or change it to match your photograph's shape — this prevents layout shift.

The hero also supports video: replace the `<img id="heroImg">` in
`index.html` with a muted, looping, `playsinline` `<video>`.

### Adding a wedding story

Copy any object inside `stories[]`, give it a unique `slug`
(e.g. `"tuscany-autumn"`), edit the fields. It automatically appears in the
Stories section, gets its own page at `story.html?id=tuscany-autumn`,
and shows up under "More stories" on other pages.

## Connecting the inquiry form

By default the form validates locally and simulates success so you can test.
To receive real inquiries, set an endpoint in `js/content.js`:

```js
formEndpoint: "https://formspree.io/f/yourid",
```

Works with Formspree, Basin, Netlify Functions, or your own backend —
the form POSTs JSON: name, email, phone, date, location, eventType,
budget, guests, message.

## Accessibility & performance notes

- Semantic landmarks, skip-link, keyboard-operable menu/lightbox/carousel
- `prefers-reduced-motion`: the camera animation is replaced by a static
  divider; reveals and parallax are disabled
- Lazy-loaded imagery with fixed aspect ratios to avoid layout shift
- Transform/opacity-only animations (GPU-friendly, mobile-safe)
- The camera transition needs ~290% of viewport scroll on desktop,
  230% on small screens; if GSAP fails to load the site still fully works
