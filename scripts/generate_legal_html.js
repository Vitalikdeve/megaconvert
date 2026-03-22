import fs from "node:fs/promises";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "..");
const outputDir = path.join(repoRoot, "public", "legal");

const defaultSources = [
  {
    id: "privacy-policy",
    title: "Privacy Policy",
    source: path.join(repoRoot, "docs", "legal", "privacy_policy.md"),
  },
  {
    id: "terms-of-service",
    title: "Terms of Service",
    source: path.join(repoRoot, "docs", "legal", "terms_of_service.md"),
  },
  {
    id: "law-enforcement-guidelines",
    title: "Law Enforcement Guidelines",
    source: path.join(repoRoot, "docs", "legal", "law_enforcement_guidelines.md"),
  },
  {
    id: "transparency-report",
    title: "Transparency Report",
    source: path.join(repoRoot, "TRANSPARENCY_REPORT.md"),
  },
];

async function main() {
  await fs.mkdir(outputDir, { recursive: true });

  const builtPages = [];

  for (const entry of defaultSources) {
    const exists = await fileExists(entry.source);
    if (!exists) {
      console.warn(`[legal] skip missing source: ${path.relative(repoRoot, entry.source)}`);
      continue;
    }

    const markdown = await fs.readFile(entry.source, "utf8");
    const htmlBody = renderMarkdown(markdown);
    const finalHtml = buildDocument({
      title: entry.title,
      bodyHtml: htmlBody,
      sourcePath: path.relative(repoRoot, entry.source),
    });

    const outputPath = path.join(outputDir, `${entry.id}.html`);
    await fs.writeFile(outputPath, finalHtml, "utf8");
    builtPages.push({
      title: entry.title,
      outputPath,
    });
    console.log(`[legal] built ${path.relative(repoRoot, outputPath)}`);
  }

  if (builtPages.length === 0) {
    throw new Error(
      "No legal markdown files were found. Add docs/legal/privacy_policy.md and docs/legal/terms_of_service.md."
    );
  }

  const indexHtml = buildIndexPage(builtPages);
  const indexPath = path.join(outputDir, "index.html");
  await fs.writeFile(indexPath, indexHtml, "utf8");
  console.log(`[legal] built ${path.relative(repoRoot, indexPath)}`);
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function renderMarkdown(markdown) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const html = [];
  let paragraph = [];
  let listItems = [];
  let codeFence = null;
  let codeLines = [];

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    html.push(`<p>${renderInline(paragraph.join(" "))}</p>`);
    paragraph = [];
  };

  const flushList = () => {
    if (listItems.length === 0) return;
    html.push("<ul>");
    for (const item of listItems) {
      html.push(`<li>${renderInline(item)}</li>`);
    }
    html.push("</ul>");
    listItems = [];
  };

  const flushCode = () => {
    if (codeFence === null) return;
    html.push(
      `<pre><code class="language-${escapeHtml(codeFence)}">${escapeHtml(codeLines.join("\n"))}</code></pre>`
    );
    codeFence = null;
    codeLines = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    if (line.startsWith("```")) {
      flushParagraph();
      flushList();

      if (codeFence === null) {
        codeFence = line.slice(3).trim();
      } else {
        flushCode();
      }
      continue;
    }

    if (codeFence !== null) {
      codeLines.push(rawLine);
      continue;
    }

    if (line.trim() === "") {
      flushParagraph();
      flushList();
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      flushParagraph();
      flushList();
      const level = headingMatch[1].length;
      html.push(`<h${level}>${renderInline(headingMatch[2])}</h${level}>`);
      continue;
    }

    const listMatch = line.match(/^[-*]\s+(.*)$/);
    if (listMatch) {
      flushParagraph();
      listItems.push(listMatch[1]);
      continue;
    }

    const quoteMatch = line.match(/^>\s?(.*)$/);
    if (quoteMatch) {
      flushParagraph();
      flushList();
      html.push(`<blockquote>${renderInline(quoteMatch[1])}</blockquote>`);
      continue;
    }

    paragraph.push(line.trim());
  }

  flushParagraph();
  flushList();
  flushCode();

  return html.join("\n");
}

function renderInline(text) {
  let html = escapeHtml(text);
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  html = html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noreferrer">$1</a>'
  );
  return html;
}

function buildDocument({ title, bodyHtml, sourcePath }) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)} | MegaConvert</title>
  <style>
    :root {
      --bg: #050509;
      --panel: rgba(16, 16, 26, 0.7);
      --panel-border: rgba(255, 255, 255, 0.08);
      --text: rgba(255, 255, 255, 0.94);
      --muted: rgba(255, 255, 255, 0.62);
      --accent: #00e5ff;
      --shadow: rgba(0, 229, 255, 0.14);
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      min-height: 100vh;
      background:
        radial-gradient(circle at top left, rgba(0, 229, 255, 0.14), transparent 28%),
        radial-gradient(circle at bottom right, rgba(255, 255, 255, 0.06), transparent 22%),
        linear-gradient(180deg, #06060c 0%, var(--bg) 100%);
      color: var(--text);
      font-family: "Segoe UI", "SF Pro Display", "Helvetica Neue", sans-serif;
      line-height: 1.65;
      padding: 32px 18px 64px;
    }

    .shell {
      width: min(920px, 100%);
      margin: 0 auto;
    }

    .hero {
      margin-bottom: 20px;
    }

    .eyebrow {
      display: inline-block;
      padding: 8px 12px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.06);
      color: var(--muted);
      font-size: 13px;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    h1 {
      font-size: clamp(34px, 6vw, 56px);
      line-height: 1.02;
      margin: 18px 0 10px;
      letter-spacing: -0.03em;
    }

    .subtitle {
      color: var(--muted);
      max-width: 720px;
      font-size: 17px;
    }

    article {
      margin-top: 28px;
      padding: clamp(20px, 4vw, 36px);
      border-radius: 28px;
      background: var(--panel);
      border: 1px solid var(--panel-border);
      backdrop-filter: blur(26px);
      box-shadow:
        0 24px 60px rgba(0, 0, 0, 0.34),
        0 0 24px var(--shadow);
    }

    h2, h3, h4, h5, h6 {
      margin-top: 1.8em;
      margin-bottom: 0.5em;
      letter-spacing: -0.02em;
    }

    p, li, blockquote {
      color: var(--text);
      font-size: 16px;
    }

    ul {
      padding-left: 22px;
    }

    code {
      font-family: "Cascadia Code", "JetBrains Mono", monospace;
      font-size: 0.95em;
      background: rgba(255, 255, 255, 0.05);
      padding: 0.18em 0.42em;
      border-radius: 8px;
    }

    pre {
      overflow-x: auto;
      padding: 16px;
      border-radius: 18px;
      background: rgba(0, 0, 0, 0.3);
      border: 1px solid rgba(255, 255, 255, 0.06);
    }

    pre code {
      background: transparent;
      padding: 0;
    }

    a {
      color: var(--accent);
    }

    blockquote {
      margin: 1.4em 0;
      padding: 14px 18px;
      border-left: 3px solid rgba(0, 229, 255, 0.5);
      background: rgba(255, 255, 255, 0.03);
      border-radius: 0 16px 16px 0;
    }

    footer {
      margin-top: 18px;
      color: var(--muted);
      font-size: 13px;
    }
  </style>
</head>
<body>
  <div class="shell">
    <header class="hero">
      <span class="eyebrow">MegaConvert Legal</span>
      <h1>${escapeHtml(title)}</h1>
      <p class="subtitle">
        Minimal static legal page generated from markdown source for publication on a secure HTTPS domain.
      </p>
    </header>
    <article>
      ${bodyHtml}
    </article>
    <footer>Generated from ${escapeHtml(sourcePath)}</footer>
  </div>
</body>
</html>`;
}

function buildIndexPage(pages) {
  const cards = pages
    .map(({ title, outputPath }) => {
      const fileName = path.basename(outputPath);
      return `<a class="card" href="./${escapeHtml(fileName)}">${escapeHtml(title)}</a>`;
    })
    .join("\n");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>MegaConvert Legal Index</title>
  <style>
    body {
      margin: 0;
      min-height: 100vh;
      background:
        radial-gradient(circle at top, rgba(0,229,255,0.16), transparent 24%),
        linear-gradient(180deg, #07070d 0%, #050509 100%);
      color: rgba(255,255,255,0.94);
      font-family: "Segoe UI", "SF Pro Display", sans-serif;
      display: grid;
      place-items: center;
      padding: 24px;
    }
    .wrap {
      width: min(780px, 100%);
      padding: 28px;
      border-radius: 28px;
      background: rgba(16,16,26,0.72);
      border: 1px solid rgba(255,255,255,0.08);
      backdrop-filter: blur(24px);
      box-shadow: 0 24px 60px rgba(0,0,0,0.35);
    }
    h1 {
      margin-top: 0;
      font-size: clamp(32px, 5vw, 52px);
      letter-spacing: -0.03em;
    }
    p {
      color: rgba(255,255,255,0.64);
      margin-bottom: 22px;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 14px;
    }
    .card {
      display: block;
      padding: 18px;
      border-radius: 18px;
      color: white;
      text-decoration: none;
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.08);
    }
    .card:hover {
      border-color: rgba(0,229,255,0.4);
      box-shadow: 0 0 24px rgba(0,229,255,0.12);
    }
  </style>
</head>
<body>
  <main class="wrap">
    <h1>Legal Documents</h1>
    <p>Generated static pages for Google Play compliance, public transparency, and startup website publishing.</p>
    <div class="grid">
      ${cards}
    </div>
  </main>
</body>
</html>`;
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

main().catch((error) => {
  console.error(`[legal] ${error.message}`);
  process.exitCode = 1;
});
