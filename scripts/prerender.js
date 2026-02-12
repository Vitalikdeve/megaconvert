import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { CONVERSIONS } from '../src/seo/conversions.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const publicDir = path.join(projectRoot, 'public');

const siteUrl = 'https://megaconvert.netlify.app';

const ensureDir = (p) => fs.mkdirSync(p, { recursive: true });

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

console.log(`Prerendered ${CONVERSIONS.length} pages into public/convert/*`);
