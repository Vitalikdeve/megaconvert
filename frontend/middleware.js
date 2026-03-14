import { next } from '@vercel/functions';

const BLOCKED_COUNTRIES = new Set(['RU', 'CN', 'IR', 'KP', 'SY', 'CU']);

const COUNTRY_LANGUAGE_MAP = new Map([
  ['AR', 'es'],
  ['AT', 'de'],
  ['AU', 'en'],
  ['BE', 'fr'],
  ['BR', 'pt'],
  ['BY', 'ru'],
  ['CA', 'en'],
  ['CH', 'de'],
  ['CL', 'es'],
  ['CO', 'es'],
  ['CR', 'es'],
  ['CY', 'tr'],
  ['DE', 'de'],
  ['DO', 'es'],
  ['DZ', 'ar'],
  ['EC', 'es'],
  ['EG', 'ar'],
  ['ES', 'es'],
  ['FR', 'fr'],
  ['GB', 'en'],
  ['GT', 'es'],
  ['HN', 'es'],
  ['HK', 'zh'],
  ['ID', 'id'],
  ['IE', 'en'],
  ['IN', 'hi'],
  ['IQ', 'ar'],
  ['IT', 'it'],
  ['JO', 'ar'],
  ['JP', 'ja'],
  ['KR', 'ko'],
  ['KW', 'ar'],
  ['KZ', 'ru'],
  ['LB', 'ar'],
  ['LU', 'fr'],
  ['MA', 'ar'],
  ['MO', 'zh'],
  ['MX', 'es'],
  ['MY', 'en'],
  ['NI', 'es'],
  ['OM', 'ar'],
  ['PA', 'es'],
  ['PE', 'es'],
  ['PH', 'en'],
  ['PR', 'es'],
  ['PT', 'pt'],
  ['PY', 'es'],
  ['QA', 'ar'],
  ['SA', 'ar'],
  ['SG', 'zh'],
  ['SV', 'es'],
  ['TN', 'ar'],
  ['TR', 'tr'],
  ['TW', 'zh'],
  ['US', 'en'],
  ['UY', 'es'],
  ['VE', 'es'],
  ['VN', 'vi'],
]);

const STATIC_FILE_PATTERN = /\.(?:avif|bmp|css|gif|html|ico|jpeg|jpg|js|json|mjs|mp3|mp4|ogg|pdf|png|svg|txt|wav|webmanifest|webm|webp|woff2?|xml|wasm)$/i;

function parseCookies(headerValue) {
  return String(headerValue || '')
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((accumulator, item) => {
      const separatorIndex = item.indexOf('=');
      if (separatorIndex === -1) {
        return accumulator;
      }

      const key = item.slice(0, separatorIndex).trim();
      const value = item.slice(separatorIndex + 1).trim();
      try {
        accumulator[key] = decodeURIComponent(value);
      } catch {
        accumulator[key] = value;
      }
      return accumulator;
    }, {});
}

function detectLanguage(countryCode) {
  return COUNTRY_LANGUAGE_MAP.get(String(countryCode || '').toUpperCase()) || 'en';
}

function shouldSkip(pathname) {
  if (!pathname) {
    return false;
  }

  return pathname === '/api'
    || pathname.startsWith('/api/')
    || pathname.startsWith('/assets/')
    || pathname.startsWith('/_vercel/')
    || pathname.startsWith('/.well-known/')
    || pathname === '/favicon.ico'
    || pathname === '/robots.txt'
    || pathname === '/sitemap.xml'
    || pathname === '/ads.txt'
    || pathname === '/sw.js'
    || pathname.startsWith('/workbox-')
    || pathname === '/registerSW.js'
    || STATIC_FILE_PATTERN.test(pathname);
}

function buildLanguageCookie(languageCode) {
  return `i18nextLng=${encodeURIComponent(languageCode)}; Path=/; Max-Age=31536000; SameSite=Lax; Secure`;
}

function renderDeniedPage(countryCode, languageCode) {
  return `<!doctype html>
<html lang="${languageCode}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>403 - Region Restricted</title>
    <style>
      :root { color-scheme: dark; }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
        background:
          radial-gradient(circle at top, rgba(255,255,255,0.08), transparent 32%),
          linear-gradient(180deg, rgba(6,6,6,0.96), rgba(2,2,2,1));
        color: rgba(255,255,255,0.92);
        font-family: Inter, ui-sans-serif, system-ui, sans-serif;
      }
      .card {
        width: min(720px, calc(100vw - 32px));
        padding: 32px;
        border-radius: 28px;
        border: 1px solid rgba(255,255,255,0.08);
        background: rgba(255,255,255,0.03);
        backdrop-filter: blur(28px);
        box-shadow: 0 36px 120px -56px rgba(0,0,0,0.92);
      }
      .eyebrow {
        display: inline-flex;
        padding: 8px 14px;
        border-radius: 999px;
        border: 1px solid rgba(255,255,255,0.08);
        background: rgba(255,255,255,0.03);
        letter-spacing: 0.28em;
        text-transform: uppercase;
        font-size: 11px;
        color: rgba(255,255,255,0.48);
      }
      h1 {
        margin: 20px 0 0;
        font-size: clamp(34px, 7vw, 52px);
        line-height: 1;
        letter-spacing: -0.05em;
      }
      p {
        margin: 18px 0 0;
        font-size: 16px;
        line-height: 1.8;
        color: rgba(255,255,255,0.64);
      }
      code {
        display: inline-flex;
        margin-top: 20px;
        padding: 10px 14px;
        border-radius: 999px;
        border: 1px solid rgba(255,255,255,0.08);
        background: rgba(255,255,255,0.04);
        color: rgba(255,255,255,0.84);
        font-family: "SFMono-Regular", Consolas, ui-monospace, monospace;
        font-size: 12px;
        letter-spacing: 0.14em;
        text-transform: uppercase;
      }
    </style>
  </head>
  <body>
    <main class="card">
      <div class="eyebrow">MegaConvert Compliance</div>
      <h1>403 - Region Restricted</h1>
      <p>MegaConvert is unavailable in this region due to export controls, sanctions screening, and compliance obligations.</p>
      <code>Country ${countryCode || 'Unknown'}</code>
    </main>
  </body>
</html>`;
}

export default function middleware(request) {
  const url = new URL(request.url);

  if (shouldSkip(url.pathname)) {
    return next();
  }

  const countryCode = String(request.headers.get('x-vercel-ip-country') || '').trim().toUpperCase();
  const preferredLanguage = detectLanguage(countryCode);
  const cookies = parseCookies(request.headers.get('cookie'));
  const hasLanguageCookie = Boolean(cookies.i18nextLng);

  if (BLOCKED_COUNTRIES.has(countryCode)) {
    const response = new Response(renderDeniedPage(countryCode, preferredLanguage), {
      status: 403,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store, max-age=0',
      },
    });

    if (!hasLanguageCookie) {
      response.headers.append('Set-Cookie', buildLanguageCookie(preferredLanguage));
    }

    return response;
  }

  const response = next();

  if (!hasLanguageCookie) {
    response.headers.append('Set-Cookie', buildLanguageCookie(preferredLanguage));
  }

  return response;
}
