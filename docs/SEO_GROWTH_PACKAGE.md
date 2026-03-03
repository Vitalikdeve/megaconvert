# MegaConvert SEO Growth Package

Production SEO package for engineering and content teams.

## 1. SEO Page Map

### A. High-intent converter pages

Priority pages:
- `/pdf-to-word`
- `/pdf-to-docx`
- `/pdf-to-excel`
- `/pdf-to-ppt`
- `/word-to-pdf`
- `/docx-to-pdf`
- `/png-to-jpg`
- `/jpg-to-png`
- `/heic-to-jpg`
- `/image-compressor`
- `/resize-image`
- `/mp4-to-mp3`
- `/video-compressor`
- `/mov-to-mp4`
- `/file-converter`
- `/compress-file`
- `/merge-pdf`
- `/split-pdf`

### B. Programmatic SEO

- Canonical converter pattern: `/convert/{from}-to-{to}`
- Source of truth: `frontend/src/seo/conversions.js`
- Generated static pages: `frontend/public/convert/*`

### C. Content hub

- Hub route: `/guides`
- Guide routes:
  - `/guides/how-to-convert-pdf-to-word`
  - `/guides/best-file-formats-explained`
  - `/guides/how-to-compress-video`
  - `/guides/what-is-pdf-vs-docx`
  - `/guides/reduce-image-size`

### D. Trust and credibility routes

- `/about`
- `/team`
- `/security`
- `/privacy`
- `/how-it-works`
- `/api/docs`

## 2. URL Strategy

Rules:
- Keep URLs short and keyword-focused.
- Use lowercase + hyphen delimiters.
- One canonical URL per intent.

Primary patterns:
- `/`
- `/tools`
- `/{tool-name}`
- `/convert/{from}-to-{to}`
- `/guides/{article}`
- `/team/{slug}`
- `/api/docs`

Multilingual alternates:
- `/en/...`
- `/es/...`
- `/de/...`

## 3. Converter SEO Template

Required blocks:
- Hero:
  - H1 with exact intent phrase.
  - Supporting sentence with speed/security value.
  - Primary CTA (`Upload file`).
- Converter block:
  - Real working conversion control.
- How it works:
  - Upload -> Convert -> Download.
- Feature list:
  - Fast processing.
  - Secure conversion.
  - No signup required.
- FAQ:
  - Safety.
  - Free usage.
  - Supported formats.
- Related tools:
  - 4-8 internal links.
- SEO text:
  - Why convert A to B.
  - Benefits.
  - Supported formats and edge cases.

## 4. Engineering Requirements

### Routing

- Support:
  - `/convert/:slug`
  - `/:slug` alias for core landing pages.
  - `/guides` and `/guides/:slug`.

### Meta generation

For every SEO page:
- `title`
- `meta description`
- `og:title`
- `og:description`
- `og:url`
- `meta robots`
- `canonical`
- `hreflang alternates`

### Structured data

Add JSON-LD:
- `SoftwareApplication`
- `HowTo`
- `FAQPage`

### Sitemap and robots

- Generate sitemap from source routes (not manually edited list).
- Include alternate language links.
- Exclude admin area in `robots.txt`.

### Performance

- SSG/prerender for SEO routes.
- Keep converter pages lightweight.
- Serve via CDN.

### Internal linking

- Related tools engine from same category.
- Link from hub pages to high-intent pages.

### Indexing controls

- Canonical set on every SEO route.
- `index,follow` for SEO pages.
- Noindex only for non-public/utility routes if needed.

## 5. Implementation in this repository

Implemented artifacts:
- `frontend/scripts/prerender.js`:
  - Generates programmatic `/convert/*` pages.
  - Generates high-intent `/{tool}` landing pages.
  - Generates `/guides` hub and guide pages.
  - Generates locale-prefixed static copies (`/en`, `/es`, `/de`).
  - Regenerates `frontend/public/sitemap.xml` and `frontend/public/robots.txt`.
- `frontend/src/SeoPage.jsx`:
  - Canonical + hreflang + robots tags.
  - `SoftwareApplication`, `HowTo`, and `FAQPage` JSON-LD.
- `frontend/src/App.jsx`:
  - Adds `/guides` alias routing.
  - Adds `/{conversion-slug}` direct route handling.
  - Adds guides link in nav/footer.

## 6. Release checklist (SEO)

- Run: `npm --prefix frontend run prerender`
- Run SEO smoke tests: `npm --prefix frontend run test:seo`
- Verify generated routes exist:
  - `frontend/public/convert/*`
  - `frontend/public/guides/*`
  - `frontend/public/{core-page}/index.html`
- Validate:
  - `frontend/public/sitemap.xml` contains target routes.
  - `frontend/public/robots.txt` has sitemap reference and admin disallow.
- Run smoke:
  - open at least 5 core pages
  - open 5 convert pages
  - open 2 guide pages
  - confirm CTA and internal links work
