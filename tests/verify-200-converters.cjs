const fs = require('fs');
const path = require('path');
const os = require('os');
const vm = require('vm');
const { convertTool } = require('../worker/src/converters');

const ROOT = path.resolve(__dirname, '..');

const readText = (filePath) => fs.readFileSync(filePath, 'utf8');

const extractLiteral = (source, regex, label) => {
  const match = source.match(regex);
  if (!match) {
    throw new Error(`Cannot extract ${label}`);
  }
  try {
    return vm.runInNewContext(match[1]);
  } catch (error) {
    return vm.runInNewContext(`(${match[1]})`);
  }
};

const loadToolDefsFromShared = () => {
  const source = readText(path.join(ROOT, 'shared', 'tools.js'));
  return extractLiteral(source, /const\s+TOOL_DEFS\s*=\s*(\[[\s\S]*?\]);/, 'shared TOOL_DEFS');
};

const loadToolDefsFromCommonJs = (relPath) => {
  const mod = require(path.join(ROOT, relPath));
  return mod.TOOL_DEFS || [];
};

const loadConversions = () => {
  const source = readText(path.join(ROOT, 'frontend', 'src', 'seo', 'conversions.js'));
  return extractLiteral(source, /const\s+CONVERSIONS\s*=\s*(\[[\s\S]*?\]);/, 'frontend CONVERSIONS');
};

const loadProcessorDefs = () => {
  const source = readText(path.join(ROOT, 'frontend', 'src', 'conversion', 'processors', 'registry.js'));
  return extractLiteral(
    source,
    /const\s+PROCESSORS\s*=\s*(\[[\s\S]*?\])\.map\(createProcessor\);/,
    'frontend PROCESSORS'
  );
};

const loadLegacyMappings = () => {
  const source = readText(path.join(ROOT, 'frontend', 'src', 'App.jsx'));
  const legacyToolSlugById = extractLiteral(
    source,
    /const\s+LEGACY_TOOL_SLUG_BY_ID\s*=\s*(\{[\s\S]*?\});/,
    'LEGACY_TOOL_SLUG_BY_ID'
  );
  const legacySlugToToolId = extractLiteral(
    source,
    /const\s+LEGACY_SLUG_TO_TOOL_ID\s*=\s*(\{[\s\S]*?\});/,
    'LEGACY_SLUG_TO_TOOL_ID'
  );
  return { legacyToolSlugById, legacySlugToToolId };
};

const toSet = (items, key) => new Set(items.map((item) => item[key]));

const diffSets = (a, b) => [...a].filter((item) => !b.has(item));

const ensureFile = (filePath, content = '') => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
};

const makeInputFile = (workDir, tool) => {
  const ext = (tool.inputExts && tool.inputExts[0]) || 'txt';
  if (ext === 'tar.gz') {
    const p = path.join(workDir, 'input.tar.gz');
    ensureFile(p, 'archive');
    return p;
  }
  const p = path.join(workDir, `input.${ext}`);
  const sampleByExt = {
    json: '{"name":"Ann","age":30}',
    csv: 'name,age\nAnn,30\nBob,25\n',
    tsv: 'name\tage\nAnn\t30\nBob\t25\n',
    txt: 'hello\nworld\n',
    md: '# Title\n- item\n',
    markdown: '# Title\n- item\n',
    html: '<h1>Title</h1><p>Body</p>',
    htm: '<h1>Title</h1><p>Body</p>',
    xml: '<?xml version="1.0"?><root><row><name>Ann</name></row></root>',
    yaml: 'name: Ann\nage: 30\n',
    yml: 'name: Ann\nage: 30\n',
    toml: 'name = "Ann"\nage = 30\n',
    ini: '[app]\nname=Ann\n',
    cfg: '[app]\nname=Ann\n',
    sql: "INSERT INTO data VALUES ('Ann','30');",
    base64: Buffer.from('hello').toString('base64'),
    pdf: '%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF',
    svg: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"></svg>',
    zip: 'PK\x03\x04dummy',
    rar: 'Rar!dummy',
    '7z': '7zdummy',
    gz: 'gzdummy',
    bz2: 'bz2dummy',
    xz: 'xzdummy',
    tar: 'tardummy',
    iso: 'isodummy'
  };
  const content = sampleByExt[ext];
  if (content !== undefined) {
    ensureFile(p, content);
    return p;
  }
  ensureFile(p, Buffer.from([0, 1, 2, 3]));
  return p;
};

const getArg = (args, name) => {
  const idx = args.indexOf(name);
  if (idx >= 0 && idx + 1 < args.length) return args[idx + 1];
  return null;
};

const mockHelpers = {
  exec: async (cmd, args = [], options = {}) => {
    const cwd = options.cwd || process.cwd();

    if (cmd === '7z') {
      if (args[0] === 'x') {
        const outArg = args.find((arg) => String(arg).startsWith('-o'));
        const outDir = outArg ? String(outArg).slice(2) : path.join(cwd, 'extract');
        fs.mkdirSync(outDir, { recursive: true });
        ensureFile(path.join(outDir, 'file.txt'), 'ok');
        return;
      }
      if (args[0] === 'a') {
        const out = args.find((arg) => /\.(zip|7z|rar|gz|bz2|xz|iso)$/i.test(String(arg)));
        if (out) ensureFile(path.isAbsolute(out) ? out : path.join(cwd, out), 'archive');
        return;
      }
    }

    if (cmd === 'tar') {
      const out = getArg(args, '-cf') || getArg(args, '-czf');
      if (out) ensureFile(path.isAbsolute(out) ? out : path.join(cwd, out), 'tar');
      return;
    }

    if (cmd === 'genisoimage' || cmd === 'mkisofs' || cmd === 'xorriso') {
      const out = getArg(args, '-o');
      if (out) ensureFile(path.isAbsolute(out) ? out : path.join(cwd, out), 'iso');
      return;
    }

    if (cmd === 'pdftoppm') {
      const prefix = args[args.length - 1];
      const ext = args.includes('-jpeg') ? 'jpg' : 'png';
      const filePath = args.includes('-singlefile') ? `${prefix}.${ext}` : `${prefix}-1.${ext}`;
      ensureFile(filePath, 'image');
      return;
    }

    if (cmd === 'pdftocairo') {
      const prefix = args[args.length - 1];
      ensureFile(`${prefix}.svg`, '<svg></svg>');
      return;
    }

    if (cmd === 'rsvg-convert') {
      const out = getArg(args, '-o');
      if (out) ensureFile(path.isAbsolute(out) ? out : path.join(cwd, out), 'rsvg');
      return;
    }

    if (cmd === 'ebook-convert') {
      const out = args[1];
      if (out) ensureFile(path.isAbsolute(out) ? out : path.join(cwd, out), 'ebook');
      return;
    }

    if (cmd === 'ffmpeg') {
      const out = args[args.length - 1];
      if (String(out).includes('frame-%05d')) {
        const firstFrame = String(out).replace('frame-%05d', 'frame-00001');
        ensureFile(path.isAbsolute(firstFrame) ? firstFrame : path.join(cwd, firstFrame), 'frame');
        return;
      }
      ensureFile(path.isAbsolute(out) ? out : path.join(cwd, out), 'media');
      return;
    }

    const maybeOut = args[args.length - 1];
    if (typeof maybeOut === 'string' && /\.[A-Za-z0-9]+$/.test(maybeOut)) {
      ensureFile(path.isAbsolute(maybeOut) ? maybeOut : path.join(cwd, maybeOut), 'out');
    }
  },
  execMagick: async (args = []) => {
    const out = args[args.length - 1];
    ensureFile(out, 'magick');
  },
  convertViaLibreOffice: async ({ workDir, to, baseName }) => {
    const out = path.join(workDir, `${baseName}.${to}`);
    ensureFile(out, `lo:${to}`);
    return out;
  },
  extractPdfText: async (_inputPath, outputPath) => {
    ensureFile(outputPath, 'pdf text');
    return outputPath;
  },
  ensureUtf8Bom: () => {},
  buildImageArgs: () => [],
  buildVideoArgs: () => [],
  buildAudioArgs: () => ({ pre: [], post: [] })
};

const verifyWorkerCoverage = async (toolDefs) => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-tool-check-'));
  const failures = [];
  try {
    for (const tool of toolDefs) {
      const workDir = path.join(tmpRoot, tool.id.replace(/[^a-z0-9_-]/gi, '_'));
      fs.mkdirSync(workDir, { recursive: true });
      try {
        const inputPath = makeInputFile(workDir, tool);
        const outputs = await convertTool({
          tool: tool.id,
          inputPath,
          workDir,
          settings: {},
          meta: tool,
          helpers: mockHelpers
        });
        if (!Array.isArray(outputs) || outputs.length === 0) {
          failures.push({ id: tool.id, reason: 'empty_output' });
          continue;
        }
        const missing = outputs.filter((outPath) => !fs.existsSync(outPath));
        if (missing.length) {
          failures.push({ id: tool.id, reason: 'missing_output', missing });
        }
      } catch (error) {
        failures.push({ id: tool.id, reason: error.message || 'unknown_error' });
      }
    }
  } finally {
    try {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    } catch {}
  }
  return failures;
};

const check = async () => {
  const sharedDefs = loadToolDefsFromShared();
  const workerDefs = loadToolDefsFromCommonJs('worker/shared/tools.js');
  const apiDefs = loadToolDefsFromCommonJs('api/shared/tools.js');
  const conversions = loadConversions();
  const processors = loadProcessorDefs();
  const { legacyToolSlugById, legacySlugToToolId } = loadLegacyMappings();

  const issues = [];

  if (sharedDefs.length !== 200) issues.push(`shared TOOL_DEFS count is ${sharedDefs.length}, expected 200`);
  if (workerDefs.length !== 200) issues.push(`worker TOOL_DEFS count is ${workerDefs.length}, expected 200`);
  if (apiDefs.length !== 200) issues.push(`api TOOL_DEFS count is ${apiDefs.length}, expected 200`);
  if (conversions.length !== 200) issues.push(`frontend CONVERSIONS count is ${conversions.length}, expected 200`);
  if (processors.length !== 200) issues.push(`frontend PROCESSORS count is ${processors.length}, expected 200`);

  const sharedIds = toSet(sharedDefs, 'id');
  const workerIds = toSet(workerDefs, 'id');
  const apiIds = toSet(apiDefs, 'id');
  const conversionIds = toSet(conversions, 'id');
  const processorIds = toSet(processors, 'id');

  const reportDiff = (leftName, leftSet, rightName, rightSet) => {
    const leftOnly = diffSets(leftSet, rightSet);
    const rightOnly = diffSets(rightSet, leftSet);
    if (leftOnly.length || rightOnly.length) {
      issues.push(`${leftName} vs ${rightName} mismatch: leftOnly=${JSON.stringify(leftOnly)}, rightOnly=${JSON.stringify(rightOnly)}`);
    }
  };

  reportDiff('shared', sharedIds, 'worker', workerIds);
  reportDiff('shared', sharedIds, 'api', apiIds);
  reportDiff('shared', sharedIds, 'frontend conversions', conversionIds);
  reportDiff('shared', sharedIds, 'frontend processors', processorIds);

  const pageDir = path.join(ROOT, 'frontend', 'public', 'convert');
  const pageSlugs = new Set(
    fs.readdirSync(pageDir, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name)
  );
  const conversionSlugs = new Set(conversions.map((item) => item.slug));
  const legacySlugs = new Set(Object.keys(legacySlugToToolId));
  const expectedPageSlugs = new Set([...conversionSlugs, ...legacySlugs]);
  const missingPages = diffSets(expectedPageSlugs, pageSlugs);
  const unexpectedPages = diffSets(pageSlugs, expectedPageSlugs);

  if (missingPages.length) issues.push(`Missing SEO pages: ${JSON.stringify(missingPages)}`);
  if (unexpectedPages.length) issues.push(`Unexpected SEO pages: ${JSON.stringify(unexpectedPages)}`);

  const invalidLegacyTargets = Object.entries(legacySlugToToolId)
    .filter(([, toolId]) => !sharedIds.has(toolId))
    .map(([slug, toolId]) => ({ slug, toolId }));
  if (invalidLegacyTargets.length) {
    issues.push(`Legacy slug mappings point to unknown tool ids: ${JSON.stringify(invalidLegacyTargets)}`);
  }

  const invalidLegacyToolSlug = Object.entries(legacyToolSlugById)
    .filter(([, slug]) => !expectedPageSlugs.has(slug))
    .map(([toolId, slug]) => ({ toolId, slug }));
  if (invalidLegacyToolSlug.length) {
    issues.push(`Legacy tool->slug mappings point to unknown slugs: ${JSON.stringify(invalidLegacyToolSlug)}`);
  }

  const workerFailures = await verifyWorkerCoverage(sharedDefs);
  if (workerFailures.length) {
    issues.push(`Worker dry-run failures: ${JSON.stringify(workerFailures)}`);
  }

  if (issues.length) {
    console.error('VERIFY_200_CONVERTERS_FAILED');
    for (const issue of issues) {
      console.error(`- ${issue}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log('VERIFY_200_CONVERTERS_OK');
  console.log(`tools=${sharedDefs.length} conversions=${conversions.length} processors=${processors.length}`);
  console.log(`pages=${pageSlugs.size} legacyAliases=${legacySlugs.size}`);
};

check().catch((error) => {
  console.error('VERIFY_200_CONVERTERS_CRASH');
  console.error(error?.stack || error?.message || String(error));
  process.exitCode = 1;
});
