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
const localePrefixes = ['en', 'es', 'de'];

const coreSeoLandings = [
  { path: '/pdf-to-word', title: 'Convert PDF to Word Online for Free', desc: 'Fast and secure PDF to Word conversion with high formatting accuracy.', target: '/convert/pdf-to-word' },
  { path: '/pdf-to-docx', title: 'Convert PDF to DOCX Online', desc: 'Turn PDF files into editable DOCX documents in seconds.', target: '/convert/pdf-to-word' },
  { path: '/pdf-to-excel', title: 'Convert PDF to Excel Online', desc: 'Extract tables from PDF and convert to Excel-ready spreadsheets.', target: '/convert/pdf-to-xlsx' },
  { path: '/pdf-to-ppt', title: 'Convert PDF to PPT Online', desc: 'Convert PDF pages to presentation slides quickly and safely.', target: '/convert/pdf-to-pptx' },
  { path: '/word-to-pdf', title: 'Convert Word to PDF Online', desc: 'Convert DOC and DOCX files to PDF with consistent layout.', target: '/convert/word-to-pdf' },
  { path: '/docx-to-pdf', title: 'Convert DOCX to PDF Online', desc: 'Export DOCX documents to PDF in one click.', target: '/convert/docx-to-pdf' },
  { path: '/png-to-jpg', title: 'Convert PNG to JPG Online', desc: 'Convert PNG images to JPG for smaller file size and sharing.', target: '/convert/png-to-jpg' },
  { path: '/jpg-to-png', title: 'Convert JPG to PNG Online', desc: 'Convert JPG images to PNG with reliable quality output.', target: '/convert/jpg-to-png' },
  { path: '/heic-to-jpg', title: 'Convert HEIC to JPG Online', desc: 'Open HEIC photos anywhere by converting to JPG instantly.', target: '/convert/heic-to-jpg' },
  { path: '/mp4-to-mp3', title: 'Convert MP4 to MP3 Online', desc: 'Extract audio from MP4 videos and download MP3 files fast.', target: '/convert/mp4-to-mp3' },
  { path: '/mov-to-mp4', title: 'Convert MOV to MP4 Online', desc: 'Convert MOV videos to MP4 for universal playback.', target: '/convert/mov-to-mp4' },
  { path: '/file-converter', title: 'Online File Converter', desc: 'Convert documents, images, videos, audio, and archives online.', target: '/tools' },
  { path: '/compress-file', title: 'Compress Files Online', desc: 'Reduce file size with smart compression settings and fast processing.', target: '/tools' },
  { path: '/merge-pdf', title: 'Merge PDF Files Online', desc: 'Combine multiple PDF files into one document in seconds.', target: '/convert/pdf-to-word' },
  { path: '/split-pdf', title: 'Split PDF Files Online', desc: 'Split PDF pages into smaller files with simple controls.', target: '/convert/pdf-to-word' },
  { path: '/image-compressor', title: 'Compress Images Online', desc: 'Reduce image size while keeping visual quality high.', target: '/convert/jpg-to-webp' },
  { path: '/resize-image', title: 'Resize Image Online', desc: 'Resize image dimensions quickly for web, social, and documents.', target: '/convert/jpg-to-png' },
  { path: '/video-compressor', title: 'Compress Video Online', desc: 'Compress video files for upload and sharing without visible quality loss.', target: '/convert/mp4-to-webm' }
];

const guides = [
  { slug: 'how-to-convert-pdf-to-word', title: 'How to Convert PDF to Word', desc: 'Step-by-step guide for accurate PDF to Word conversion.', target: '/convert/pdf-to-word' },
  { slug: 'best-file-formats-explained', title: 'Best File Formats Explained', desc: 'Compare file formats and choose the right one for your workflow.', target: '/tools' },
  { slug: 'how-to-compress-video', title: 'How to Compress Video', desc: 'Practical settings for reducing video size while preserving quality.', target: '/convert/mp4-to-webm' },
  { slug: 'what-is-pdf-vs-docx', title: 'PDF vs DOCX: What Is the Difference?', desc: 'Understand when to use PDF or DOCX for documents and sharing.', target: '/convert/pdf-to-word' },
  { slug: 'reduce-image-size', title: 'How to Reduce Image Size', desc: 'Techniques to lower image file size for faster uploads.', target: '/convert/jpg-to-webp' }
];

const trustRoutes = [
  '/about',
  '/team',
  '/security',
  '/privacy',
  '/how-it-works',
  '/api/docs'
];

const staticRoutes = [
  '/',
  '/tools',
  '/convert',
  '/guides',
  '/blog',
  '/pricing',
  '/status',
  '/reliability',
  '/faq',
  '/contact'
];

const ensureDir = (p) => fs.mkdirSync(p, { recursive: true });
const escapeHtml = (value) => String(value || '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

if (fs.existsSync(convertDir)) {
  fs.rmSync(convertDir, { recursive: true, force: true });
}
ensureDir(convertDir);

const writeFile = (relPath, content) => {
  const abs = path.join(publicDir, relPath);
  ensureDir(path.dirname(abs));
  fs.writeFileSync(abs, content, 'utf8');
};

const makeAlternateLinks = (canonicalPath) => {
  const lines = [`<link rel="alternate" hreflang="x-default" href="${siteUrl}${canonicalPath}" />`];
  for (const locale of localePrefixes) {
    lines.push(`<link rel="alternate" hreflang="${locale}" href="${siteUrl}/${locale}${canonicalPath}" />`);
  }
  return lines.join('\n    ');
};

const pageTemplate = ({ title, description, canonicalPath, headline, body, ctaHref, ctaText }) => {
  const safeTitle = escapeHtml(title);
  const safeDesc = escapeHtml(description);
  const safeHeadline = escapeHtml(headline || title);
  const safeBody = escapeHtml(body || description);
  const safeCtaHref = escapeHtml(ctaHref || '/tools');
  const safeCtaText = escapeHtml(ctaText || 'Open MegaConvert');
  const canonicalUrl = `${siteUrl}${canonicalPath}`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'SoftwareApplication',
        name: safeTitle,
        applicationCategory: 'UtilityApplication',
        operatingSystem: 'Web',
        description: safeDesc,
        url: canonicalUrl
      },
      {
        '@type': 'HowTo',
        name: `How to use ${safeTitle}`,
        step: [
          { '@type': 'HowToStep', name: 'Upload file' },
          { '@type': 'HowToStep', name: 'Configure conversion' },
          { '@type': 'HowToStep', name: 'Download result' }
        ]
      },
      {
        '@type': 'FAQPage',
        mainEntity: [
          {
            '@type': 'Question',
            name: 'Is this tool free?',
            acceptedAnswer: { '@type': 'Answer', text: 'Yes, free conversions are available with optional PRO features.' }
          },
          {
            '@type': 'Question',
            name: 'Are files secure?',
            acceptedAnswer: { '@type': 'Answer', text: 'Files are processed through secure channels and are not published publicly.' }
          }
        ]
      }
    ]
  };

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${safeTitle}</title>
    <meta name="description" content="${safeDesc}" />
    <meta name="robots" content="index,follow,max-image-preview:large" />
    <meta property="og:title" content="${safeTitle}" />
    <meta property="og:description" content="${safeDesc}" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${canonicalUrl}" />
    <link rel="canonical" href="${canonicalUrl}" />
    ${makeAlternateLinks(canonicalPath)}
    <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
    <style>
      body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#0f172a;color:#e2e8f0}
      .wrap{max-width:860px;margin:64px auto;padding:24px}
      .card{background:#111827;border:1px solid #1f2937;border-radius:20px;padding:32px}
      h1{font-size:40px;line-height:1.15;margin:0 0 14px}
      p{font-size:18px;color:#94a3b8;margin:0}
      .cta{display:inline-block;margin-top:24px;padding:12px 20px;border-radius:12px;background:#22d3ee;color:#082f49;text-decoration:none;font-weight:700}
      .meta{margin-top:16px;color:#64748b;font-size:14px}
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="card">
        <h1>${safeHeadline}</h1>
        <p>${safeBody}</p>
        <a class="cta" href="${safeCtaHref}">${safeCtaText}</a>
        <div class="meta">Fast • Secure • High quality</div>
      </div>
    </div>
  </body>
</html>`;
};

const writeLocaleCopies = (canonicalPath, htmlByLocale = null) => {
  for (const locale of localePrefixes) {
    const localePath = `/${locale}${canonicalPath}`;
    const relPath = `${localePath.replace(/^\//, '')}/index.html`;
    const content = htmlByLocale?.[locale] || htmlByLocale?.default || htmlByLocale || '';
    writeFile(relPath, content);
  }
};

for (const conversion of CONVERSIONS) {
  const canonicalPath = `/convert/${conversion.slug}`;
  const title = `${conversion.from} to ${conversion.to} Converter | MegaConvert`;
  const description = `Convert ${conversion.from} to ${conversion.to} online in seconds. Fast, secure, and high-quality conversion.`;
  const html = pageTemplate({
    title,
    description,
    canonicalPath,
    headline: `Convert ${conversion.from} to ${conversion.to} Online`,
    body: description,
    ctaHref: `/?tool=${encodeURIComponent(conversion.id)}&autopick=1`,
    ctaText: 'Upload file'
  });
  writeFile(`convert/${conversion.slug}/index.html`, html);
  writeLocaleCopies(canonicalPath, html);
}

const legacyAliases = [
  { slug: 'image-to-pdf', toSlug: 'jpg-to-pdf', from: 'Image', to: 'PDF', toolId: 'jpg-pdf' },
  { slug: 'pdf-to-images', toSlug: 'pdf-to-png-hi-res', from: 'PDF', to: 'PNG', toolId: 'pdf-png-hires' }
];

for (const alias of legacyAliases) {
  const canonicalPath = `/convert/${alias.slug}`;
  const html = pageTemplate({
    title: `${alias.from} to ${alias.to} Converter | MegaConvert`,
    description: `Convert ${alias.from} to ${alias.to} online in seconds with MegaConvert.`,
    canonicalPath,
    headline: `${alias.from} to ${alias.to} Converter`,
    body: `Open the ${alias.from} to ${alias.to} converter and process files in seconds.`,
    ctaHref: `/?tool=${encodeURIComponent(alias.toolId)}&autopick=1`,
    ctaText: 'Upload file'
  });
  writeFile(`convert/${alias.slug}/index.html`, html);
  writeLocaleCopies(canonicalPath, html);
}

for (const landing of coreSeoLandings) {
  const html = pageTemplate({
    title: `${landing.title} | MegaConvert`,
    description: landing.desc,
    canonicalPath: landing.path,
    headline: landing.title,
    body: landing.desc,
    ctaHref: landing.target,
    ctaText: 'Upload file'
  });
  writeFile(`${landing.path.replace(/^\//, '')}/index.html`, html);
  writeLocaleCopies(landing.path, html);
}

const guidesHubHtml = pageTemplate({
  title: 'Conversion Guides and Tutorials | MegaConvert',
  description: 'Practical guides for document, image, audio, and video conversion workflows.',
  canonicalPath: '/guides',
  headline: 'Conversion Guides',
  body: 'Learn how to convert, compress, and optimize files with practical step-by-step guides.',
  ctaHref: '/tools',
  ctaText: 'Browse tools'
});
writeFile('guides/index.html', guidesHubHtml);
writeLocaleCopies('/guides', guidesHubHtml);

for (const guide of guides) {
  const pathName = `/guides/${guide.slug}`;
  const html = pageTemplate({
    title: `${guide.title} | MegaConvert Guides`,
    description: guide.desc,
    canonicalPath: pathName,
    headline: guide.title,
    body: guide.desc,
    ctaHref: guide.target,
    ctaText: 'Try converter'
  });
  writeFile(`guides/${guide.slug}/index.html`, html);
  writeLocaleCopies(pathName, html);
}

for (const route of trustRoutes) {
  const html = pageTemplate({
    title: `${route.replace('/', '').replaceAll('-', ' ') || 'Home'} | MegaConvert`,
    description: 'MegaConvert trust and platform information page.',
    canonicalPath: route,
    headline: 'MegaConvert Trust and Platform',
    body: 'Security, privacy, and operational details for teams using MegaConvert.',
    ctaHref: '/tools',
    ctaText: 'Open tools'
  });
  writeFile(`${route.replace(/^\//, '')}/index.html`, html);
  writeLocaleCopies(route, html);
}

const allRoutes = [
  ...staticRoutes,
  ...trustRoutes,
  ...coreSeoLandings.map((item) => item.path),
  ...guides.map((item) => `/guides/${item.slug}`),
  ...CONVERSIONS.map((item) => `/convert/${item.slug}`),
  ...legacyAliases.map((item) => `/convert/${item.slug}`)
];

const uniqueRoutes = [...new Set(allRoutes)];

const toSitemapEntry = (route) => {
  const canonical = `${siteUrl}${route}`;
  const alternates = localePrefixes
    .map((locale) => `    <xhtml:link rel="alternate" hreflang="${locale}" href="${siteUrl}/${locale}${route}" />`)
    .join('\n');
  return `  <url>
    <loc>${canonical}</loc>
${alternates}
    <xhtml:link rel="alternate" hreflang="x-default" href="${canonical}" />
  </url>`;
};

const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${uniqueRoutes.map(toSitemapEntry).join('\n')}
</urlset>
`;

writeFile('sitemap.xml', sitemapXml);

const robotsTxt = `User-agent: *
Allow: /
Disallow: /admin

Sitemap: ${siteUrl}/sitemap.xml
`;

writeFile('robots.txt', robotsTxt);

console.log(`Prerendered ${CONVERSIONS.length} conversion pages + SEO hubs, guides, and trust landings.`);
