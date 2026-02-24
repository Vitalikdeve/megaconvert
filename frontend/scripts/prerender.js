import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { CONVERSIONS } from '../src/seo/conversions.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const publicDir = path.join(projectRoot, 'public');
const convertDir = path.join(publicDir, 'convert');

const siteUrl = (globalThis.process?.env?.SITE_URL || 'https://megaconvert-web.vercel.app').replace(/\/+$/, '');

const ensureDir = (p) => fs.mkdirSync(p, { recursive: true });

if (fs.existsSync(convertDir)) {
  fs.rmSync(convertDir, { recursive: true, force: true });
}
ensureDir(convertDir);

const htmlShell = ({ title, description, slug, from, to, toolId }) => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <meta name="description" content="${description}" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:type" content="website" />
    <link rel="canonical" href="${siteUrl}/convert/${slug}" />
    <style>
      body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#f8fafc;color:#0f172a}
      .wrap{max-width:840px;margin:80px auto;padding:24px}
      h1{font-size:40px;margin:0 0 16px}
      p{font-size:18px;color:#475569}
      a{display:inline-block;margin-top:20px;padding:12px 20px;border-radius:12px;background:#0f172a;color:#fff;text-decoration:none}
      .chips{margin-top:18px;color:#64748b;font-size:14px}
    </style>
  </head>
  <body>
    <div class="wrap">
      <h1>${from} to ${to} Converter</h1>
      <p>${description}</p>
      <div class="chips">Fast • Secure • High quality</div>
      <a href="/?tool=${encodeURIComponent(toolId)}&autopick=1">Open converter</a>
    </div>
  </body>
</html>`;

const writeFile = (relPath, content) => {
  const abs = path.join(publicDir, relPath);
  ensureDir(path.dirname(abs));
  fs.writeFileSync(abs, content, 'utf8');
};

for (const c of CONVERSIONS) {
  const title = `${c.from} to ${c.to} Converter | MegaConvert`;
  const description = `Convert ${c.from} to ${c.to} online in seconds. Fast, secure, and high-quality conversions.`;
  writeFile(path.join('convert', c.slug, 'index.html'), htmlShell({
    title, description, slug: c.slug, from: c.from, to: c.to, toolId: c.id
  }));
}

const legacyAliases = [
  { slug: 'image-to-pdf', toSlug: 'jpg-to-pdf', from: 'Image', to: 'PDF', toolId: 'jpg-pdf' },
  { slug: 'pdf-to-images', toSlug: 'pdf-to-png-hi-res', from: 'PDF', to: 'PNG', toolId: 'pdf-png-hires' }
];

for (const alias of legacyAliases) {
  const title = `${alias.from} to ${alias.to} Converter | MegaConvert`;
  const description = `Convert ${alias.from} to ${alias.to} online in seconds. Fast, secure, and high-quality conversions.`;
  writeFile(path.join('convert', alias.slug, 'index.html'), htmlShell({
    title,
    description,
    slug: alias.toSlug,
    from: alias.from,
    to: alias.to,
    toolId: alias.toolId
  }));
}

const staticRoutes = [
  '/',
  '/tools',
  '/pricing',
  '/security',
  '/status',
  '/faq',
  '/blog',
  '/privacy',
  '/terms',
  '/cookie-policy',
  '/disclaimer',
  '/legal',
  '/about',
  '/contact'
];

const blogArticleRoutes = [
  '/blog/pdf-to-word-layout-guide',
  '/blog/scan-quality-for-ocr-results',
  '/blog/image-to-pdf-for-visa-packs',
  '/blog/video-compression-without-quality-loss',
  '/blog/secure-file-sharing-after-conversion',
  '/blog/api-readiness-for-file-automation'
];

const sitemapRoutes = [
  ...staticRoutes,
  ...blogArticleRoutes,
  ...CONVERSIONS.map((c) => `/convert/${c.slug}`),
  ...legacyAliases.map((item) => `/convert/${item.slug}`)
];

const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapRoutes.map((route) => `  <url><loc>${siteUrl}${route}</loc></url>`).join('\n')}
</urlset>
`;

writeFile('sitemap.xml', sitemapXml);

const robotsTxt = `User-agent: *
Allow: /

Sitemap: ${siteUrl}/sitemap.xml
`;

writeFile('robots.txt', robotsTxt);

console.log(`Prerendered ${CONVERSIONS.length + legacyAliases.length} pages into public/convert/*`);
