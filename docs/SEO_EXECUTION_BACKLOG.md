# SEO Execution Backlog (Dev + Content + QA)

Operational backlog for rolling out and maintaining MegaConvert SEO.

## Engineering

1. Keep prerender source-of-truth route lists current in `frontend/scripts/prerender.js`.
2. Regenerate static SEO assets on each release:
   - `npm --prefix frontend run prerender`
3. Validate canonical/hreflang/meta on:
   - 10 high-intent pages
   - 10 programmatic `/convert/*` pages
   - `/guides` + 2 guide articles
4. Keep structured data valid (`SoftwareApplication`, `HowTo`, `FAQPage`).
5. Ensure `/sitemap.xml` includes:
   - core SEO pages
   - guides
   - convert routes
   - alternate language links
6. Keep `/robots.txt` policy:
   - `Allow: /`
   - `Disallow: /admin`
   - sitemap link.

## Content

1. Publish 2-4 guide articles per month under `/guides/*`.
2. For each new guide:
   - map one primary keyword
   - include one main converter CTA
   - include 3-5 related internal links.
3. Maintain FAQ blocks for top converter pages.
4. Refresh top converter copy every quarter:
   - title and intro
   - benefits
   - supported formats
   - related tools.

## QA

1. SEO smoke pre-release:
   - run `npm --prefix frontend run test:seo`
   - page title and description present
   - canonical tag present
   - `og:*` tags present
   - JSON-LD script present and parseable
   - CTA click produces real action
   - no dead internal links.
2. Route smoke:
   - `/{tool}` aliases resolve
   - `/convert/{from}-to-{to}` resolves
   - `/guides` and `/guides/{slug}` resolve
   - locale-prefixed routes (`/en`, `/es`, `/de`) resolve.
3. Crawl smoke:
   - sitemap is valid XML
   - sample URLs from sitemap return HTTP 200.

## KPIs

- Organic sessions (weekly).
- Indexed pages count.
- CTR for high-intent converter pages.
- Top-20 keyword coverage.
- Guide-to-converter click-through rate.
