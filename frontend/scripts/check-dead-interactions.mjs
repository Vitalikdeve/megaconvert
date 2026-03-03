import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.cwd(), 'src');
const EXTENSIONS = new Set(['.jsx', '.tsx']);

const violations = [];

const getFiles = (dir) => {
  const out = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...getFiles(full));
      continue;
    }
    if (EXTENSIONS.has(path.extname(entry.name))) out.push(full);
  }
  return out;
};

const getLine = (text, index) => text.slice(0, index).split('\n').length;

const hasActionableButtonBehavior = (tag) => {
  if (/data-allow-passive-button/.test(tag)) return true;
  if (/\bonClick\s*=/.test(tag)) return true;
  if (/\btype\s*=\s*["'](?:submit|reset)["']/.test(tag)) return true;
  if (/\btype\s*=\s*\{["'](?:submit|reset)["']\}/.test(tag)) return true;
  if (/\bdisabled\b/.test(tag)) return true;
  return false;
};

const hasActionableAnchorBehavior = (tag) => {
  if (/data-allow-passive-link/.test(tag)) return true;
  if (/\bonClick\s*=/.test(tag)) return true;
  if (/\bhref\s*=\s*\{/.test(tag)) return true;
  const hrefMatch = tag.match(/\bhref\s*=\s*["']([^"']*)["']/);
  if (!hrefMatch) return false;
  const href = String(hrefMatch[1] || '').trim().toLowerCase();
  if (!href) return false;
  if (href === '#' || href.startsWith('javascript:')) return false;
  return true;
};

const auditFile = (filePath) => {
  const source = fs.readFileSync(filePath, 'utf8');

  const buttonRegex = /<button\b[\s\S]*?>/g;
  let match;
  while ((match = buttonRegex.exec(source)) !== null) {
    const rawTag = match[0].replace(/\s+/g, ' ').trim();
    if (!hasActionableButtonBehavior(rawTag)) {
      violations.push({
        filePath,
        line: getLine(source, match.index),
        kind: 'button',
        snippet: rawTag.slice(0, 180)
      });
    }
  }

  const anchorRegex = /<a\b[\s\S]*?>/g;
  while ((match = anchorRegex.exec(source)) !== null) {
    const rawTag = match[0].replace(/\s+/g, ' ').trim();
    if (!hasActionableAnchorBehavior(rawTag)) {
      violations.push({
        filePath,
        line: getLine(source, match.index),
        kind: 'anchor',
        snippet: rawTag.slice(0, 180)
      });
    }
  }
};

if (!fs.existsSync(ROOT)) {
  console.error(`[check-dead-interactions] source directory not found: ${ROOT}`);
  process.exit(1);
}

const files = getFiles(ROOT);
for (const filePath of files) {
  auditFile(filePath);
}

if (violations.length > 0) {
  console.error(`[check-dead-interactions] Found ${violations.length} potential dead interactive element(s):`);
  for (const issue of violations) {
    const relative = path.relative(process.cwd(), issue.filePath).replace(/\\/g, '/');
    console.error(`- ${relative}:${issue.line} [${issue.kind}] ${issue.snippet}`);
  }
  process.exit(1);
}

console.log(`[check-dead-interactions] OK: scanned ${files.length} files, no dead interactions found.`);
