const fs = require('fs');
const path = require('path');
const os = require('os');
const { pipeline } = require('stream');
const { promisify } = require('util');
const { execFile, execFileSync } = require('child_process');
const crypto = require('crypto');
const { Worker, Queue } = require('bullmq');
const IORedis = require('ioredis');
const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const { TOOL_IDS, TOOL_META } = require('../shared/tools');
const nacl = require('tweetnacl');
const { convertTool } = require('./converters');

const envCandidates = [
  path.join(__dirname, '..', '.env'),
  path.join(__dirname, '..', '..', '.env')
];
for (const envPath of envCandidates) {
  if (fs.existsSync(envPath)) {
    require('dotenv').config({ path: envPath });
    break;
  }
}

const log = (payload) => console.log(JSON.stringify(payload));
const logError = (payload) => console.error(JSON.stringify(payload));

function hasCommand(cmd, args = ['-version']) {
  try {
    execFileSync(cmd, args, { stdio: 'ignore', timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

function logToolchainStatus() {
  const checks = [
    { key: 'soffice', ok: hasCommand(SOFFICE, ['--version']), requiredFor: ['pdf-word', 'word-pdf', 'pdf-excel', 'pdf-pptx', 'excel-pdf', 'pptx-pdf', 'txt-pdf'] },
    { key: 'ffmpeg', ok: hasCommand('ffmpeg'), requiredFor: ['mp4-mp3', 'mp4-gif', 'mov-mp4', 'mkv-mp4', 'avi-mp4', 'video-webm', 'mp3-wav', 'wav-mp3', 'm4a-mp3', 'flac-mp3', 'ogg-mp3'] },
    { key: 'magick', ok: hasCommand('magick'), requiredFor: ['png-jpg', 'jpg-png', 'jpg-webp', 'png-webp', 'heic-jpg', 'avif-jpg', 'avif-png', 'image-pdf', 'jpg-pdf', 'svg-jpg', 'svg-png'] },
    { key: 'pdftoppm', ok: hasCommand('pdftoppm', ['-v']), requiredFor: ['pdf-images'] },
    { key: 'ebook-convert', ok: hasCommand('ebook-convert', ['--version']), requiredFor: ['pdf-epub', 'epub-pdf', 'pdf-mobi', 'mobi-pdf'] },
    { key: 'tesseract', ok: hasCommand('tesseract', ['--version']), requiredFor: ['ocr'] }
  ];
  const missing = checks.filter((item) => !item.ok);
  if (!missing.length) {
    log({ type: 'toolchain_ok' });
    return;
  }
  for (const item of missing) {
    logError({
      type: 'tool_missing',
      tool: item.key,
      requiredFor: item.requiredFor
    });
  }
}

const streamToFile = async (stream, filePath) => {
  await promisify(pipeline)(stream, fs.createWriteStream(filePath));
};

const exec = (cmd, args, options = {}) => new Promise((resolve, reject) => {
  execFile(cmd, args, options, (err, stdout, stderr) => {
    if (err) {
      if (err.code === 'ENOENT') {
        err.message = `Missing dependency: ${cmd}`;
      }
      err.stdout = stdout;
      err.stderr = stderr;
      return reject(err);
    }
    resolve({ stdout, stderr });
  });
});

const connection = new IORedis(process.env.REDIS_URL, { maxRetriesPerRequest: null });
const dlq = new Queue('convert-dlq', { connection });
const storageMode = (process.env.STORAGE_MODE || 's3').toLowerCase();
const s3 = storageMode === 's3' ? new S3Client({
  region: process.env.S3_REGION || 'auto',
  endpoint: process.env.S3_ENDPOINT,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || ''
  },
  forcePathStyle: true
}) : null;

const localRoot = process.env.LOCAL_STORAGE_DIR || '/data';
const localPathForKey = (key) => path.join(localRoot, key);
const JOB_MAX_AGE_MS = Number(process.env.JOB_MAX_AGE_MS || 15 * 60 * 1000);

const isWin = process.platform === 'win32';
const tmpRoot = os.tmpdir();
const GS = isWin ? 'gswin64c' : 'gs';
const ZIP = isWin ? '7z' : 'zip';
const SOFFICE = (() => {
  if (!isWin) return 'soffice';
  const candidates = [
    'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
    'C:\\Program Files\\LibreOffice\\program\\soffice.com',
    'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe',
    'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.com'
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return 'soffice';
})();

function addToPathIfExists(dir) {
  if (!dir) return;
  if (fs.existsSync(dir)) {
    const parts = (process.env.PATH || '').split(';');
    if (!parts.includes(dir)) {
      process.env.PATH = [dir, ...parts].join(';');
    }
  }
}

function findDirByPrefix(base, prefix) {
  if (!base || !fs.existsSync(base)) return null;
  const entries = fs.readdirSync(base, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory() && entry.name.toLowerCase().startsWith(prefix.toLowerCase())) {
      return path.join(base, entry.name);
    }
  }
  return null;
}

function addWindowsToolPaths() {
  const pf = process.env.ProgramFiles || 'C:\\Program Files';
  const pfx86 = process.env['ProgramFiles(x86)'];
  const localApp = process.env.LOCALAPPDATA;

  addToPathIfExists(path.join(pf, 'LibreOffice', 'program'));
  addToPathIfExists(path.join(pf, 'Tesseract-OCR'));
  addToPathIfExists(path.join(pf, '7-Zip'));
  addToPathIfExists(path.join(pf, 'Calibre2'));
  if (pfx86) addToPathIfExists(path.join(pfx86, 'Calibre2'));

  const imDir = findDirByPrefix(pf, 'ImageMagick-') || (pfx86 ? findDirByPrefix(pfx86, 'ImageMagick-') : null);
  if (imDir) addToPathIfExists(imDir);

  const popplerDir = findDirByPrefix(pf, 'poppler-') || (pfx86 ? findDirByPrefix(pfx86, 'poppler-') : null);
  if (popplerDir) addToPathIfExists(path.join(popplerDir, 'Library', 'bin'));

  const gsRoot = path.join(pf, 'gs');
  if (fs.existsSync(gsRoot)) {
    const entries = fs.readdirSync(gsRoot, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const bin = path.join(gsRoot, entry.name, 'bin');
        if (fs.existsSync(path.join(bin, 'gswin64c.exe'))) {
          addToPathIfExists(bin);
          break;
        }
      }
    }
  }

  if (localApp) {
    addToPathIfExists(path.join(localApp, 'Microsoft', 'WinGet', 'Links'));
    const pkgsRoot = path.join(localApp, 'Microsoft', 'WinGet', 'Packages');
    if (fs.existsSync(pkgsRoot)) {
      const entries = fs.readdirSync(pkgsRoot, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory() && entry.name.toLowerCase().startsWith('oschwartz10612.poppler')) {
          const pkgDir = path.join(pkgsRoot, entry.name);
          const subs = fs.readdirSync(pkgDir, { withFileTypes: true });
          for (const sub of subs) {
            if (sub.isDirectory() && sub.name.toLowerCase().startsWith('poppler-')) {
              addToPathIfExists(path.join(pkgDir, sub.name, 'Library', 'bin'));
              break;
            }
          }
          break;
        }
      }
    }
  }
}

if (isWin) {
  addWindowsToolPaths();
}

const RESOLUTION_MAP = {
  '480p': '854:480',
  '720p': '1280:720',
  '1080p': '1920:1080',
  '4k': '3840:2160'
};

const CODEC_MAP = {
  h264: 'libx264',
  h265: 'libx265',
  av1: 'libaom-av1'
};

const WORKER_PUBLIC_KEY = process.env.WORKER_KEY_PUBLIC || '';
const WORKER_PRIVATE_KEY = process.env.WORKER_KEY_PRIVATE || '';
const OCR_LANGS = String(process.env.OCR_LANGS || 'eng+rus,eng')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

const b64ToBytes = (b64) => Uint8Array.from(Buffer.from(b64, 'base64'));
const bytesToB64 = (bytes) => Buffer.from(bytes).toString('base64');

async function unwrapKey(encryption) {
  if (!encryption || !encryption.keyWrap) return null;
  let privKey = WORKER_PRIVATE_KEY;
  if (encryption.sessionId) {
    const stored = await connection.get(`zk:session:${encryption.sessionId}`);
    if (!stored) throw new Error('Encryption session expired');
    privKey = stored;
  }
  if (!privKey) throw new Error('Missing worker private key');
  const clientPub = b64ToBytes(encryption.keyWrap.clientPublicKey);
  const nonce = b64ToBytes(encryption.keyWrap.nonce);
  const wrapped = b64ToBytes(encryption.keyWrap.wrappedKey);
  const priv = b64ToBytes(privKey);
  const shared = nacl.box.before(clientPub, priv);
  const key = nacl.secretbox.open(wrapped, nonce, shared);
  if (!key) throw new Error('Failed to unwrap key');
  return Buffer.from(key);
}

async function cleanupEncryptionSession(job) {
  const sessionId = job?.data?.encryption?.sessionId;
  if (!sessionId) return;
  try {
    await connection.del(`zk:session:${sessionId}`);
  } catch (error) {
    logError({
      type: 'session_cleanup_failed',
      jobId: job?.id || null,
      error: error?.message || 'unknown'
    });
  }
}

async function decryptFileGcm(inputPath, outputPath, meta, key) {
  const { chunkSize, ivBase, totalChunks } = meta;
  const ivBaseBytes = Buffer.from(ivBase, 'base64');
  const inFd = fs.openSync(inputPath, 'r');
  const outFd = fs.openSync(outputPath, 'w');
  let offset = 0;
  try {
    for (let i = 0; i < totalChunks; i += 1) {
      const cipherChunkSize = (i === totalChunks - 1)
        ? fs.statSync(inputPath).size - offset
        : chunkSize + 16;
      const buf = Buffer.alloc(cipherChunkSize);
      const read = fs.readSync(inFd, buf, 0, cipherChunkSize, offset);
      offset += read;
      const iv = Buffer.alloc(12);
      ivBaseBytes.copy(iv, 0, 0, 8);
      iv.writeUInt32BE(i, 8);
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      const tag = buf.subarray(read - 16, read);
      decipher.setAuthTag(tag);
      const plaintext = Buffer.concat([decipher.update(buf.subarray(0, read - 16)), decipher.final()]);
      fs.writeSync(outFd, plaintext);
    }
  } finally {
    fs.closeSync(inFd);
    fs.closeSync(outFd);
  }
}

async function encryptFileGcm(inputPath, outputPath, key, chunkSize = 4 * 1024 * 1024) {
  const stat = fs.statSync(inputPath);
  const totalChunks = Math.max(1, Math.ceil(stat.size / chunkSize));
  const ivBase = crypto.randomBytes(8);
  const inFd = fs.openSync(inputPath, 'r');
  const outFd = fs.openSync(outputPath, 'w');
  try {
    for (let i = 0; i < totalChunks; i += 1) {
      const size = Math.min(chunkSize, stat.size - (i * chunkSize));
      const buf = Buffer.alloc(size);
      fs.readSync(inFd, buf, 0, size, i * chunkSize);
      const iv = Buffer.alloc(12);
      ivBase.copy(iv, 0, 0, 8);
      iv.writeUInt32BE(i, 8);
      const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
      const cipherText = Buffer.concat([cipher.update(buf), cipher.final()]);
      const tag = cipher.getAuthTag();
      fs.writeSync(outFd, cipherText);
      fs.writeSync(outFd, tag);
    }
  } finally {
    fs.closeSync(inFd);
    fs.closeSync(outFd);
  }
  return {
    chunkSize,
    totalChunks,
    ivBase: ivBase.toString('base64'),
    alg: 'AES-256-GCM'
  };
}

function readHeader(filePath, len = 32) {
  const fd = fs.openSync(filePath, 'r');
  try {
    const buf = Buffer.alloc(len);
    fs.readSync(fd, buf, 0, len, 0);
    return buf;
  } finally {
    fs.closeSync(fd);
  }
}

function hasPrefix(buf, arr) {
  if (buf.length < arr.length) return false;
  for (let i = 0; i < arr.length; i += 1) {
    if (buf[i] !== arr[i]) return false;
  }
  return true;
}

function isPng(buf) {
  return hasPrefix(buf, [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
}

function isJpg(buf) {
  return buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF;
}

function isGif(buf) {
  const sig = buf.toString('ascii', 0, 6);
  return sig === 'GIF87a' || sig === 'GIF89a';
}

function isPdf(buf) {
  const sig = Buffer.from('%PDF-');
  const idx = buf.indexOf(sig);
  return idx >= 0 && idx <= 1024;
}

function isZip(buf) {
  return buf[0] === 0x50 && buf[1] === 0x4B && buf[2] === 0x03 && buf[3] === 0x04;
}

function isRiff(buf, type) {
  return buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === type;
}

function isWebp(buf) {
  return isRiff(buf, 'WEBP');
}

function isWav(buf) {
  return isRiff(buf, 'WAVE');
}

function isMp3(buf) {
  if (buf.toString('ascii', 0, 3) === 'ID3') return true;
  return buf[0] === 0xFF && (buf[1] & 0xE0) === 0xE0;
}

function isFtyp(buf, brands = []) {
  if (buf.toString('ascii', 4, 8) !== 'ftyp') return false;
  if (!brands.length) return true;
  const brand = buf.toString('ascii', 8, 12);
  return brands.includes(brand);
}

function isHeic(buf) {
  return isFtyp(buf, ['heic', 'heix', 'hevc', 'hevx', 'mif1']);
}

function assertMagic(tool, filePath) {
  const headerSize = (tool === 'pdf-word' || tool === 'pdf-txt' || tool === 'pdf-images') ? 1024 : 32;
  const header = readHeader(filePath, headerSize);
  const isImage = isPng(header) || isJpg(header) || isGif(header) || isWebp(header) || isHeic(header);
  const isVideo = isFtyp(header);
  const isAudio = isMp3(header) || isWav(header) || isFtyp(header, ['M4A ', 'isom', 'mp42']);

  if (tool === 'pdf-word' || tool === 'pdf-txt' || tool === 'pdf-images') {
    if (!isPdf(header)) throw new Error('Invalid PDF input');
  }
  if (tool === 'word-pdf') {
    const ext = path.extname(String(filePath || '')).toLowerCase();
    if (ext === '.doc') return;
    if (!isZip(header)) throw new Error('Invalid DOCX input');
  }
  if (tool === 'image-pdf') {
    if (!isImage) throw new Error('Invalid image input');
  }
  if (tool === 'png-jpg') {
    if (!isPng(header)) throw new Error('Invalid PNG input');
  }
  if (tool === 'jpg-png' || tool === 'jpg-webp') {
    if (!isJpg(header)) throw new Error('Invalid JPG input');
  }
  if (tool === 'png-webp') {
    if (!isPng(header)) throw new Error('Invalid PNG input');
  }
  if (tool === 'heic-jpg') {
    if (!isHeic(header)) throw new Error('Invalid HEIC input');
  }
  if (tool === 'mp4-mp3' || tool === 'mp4-gif' || tool === 'mov-mp4') {
    if (!isVideo) throw new Error('Invalid video input');
  }
  if (tool === 'mp3-wav') {
    if (!isMp3(header)) throw new Error('Invalid MP3 input');
  }
  if (tool === 'wav-mp3') {
    if (!isWav(header)) throw new Error('Invalid WAV input');
  }
  if (tool === 'm4a-mp3') {
    if (!isFtyp(header)) throw new Error('Invalid M4A input');
  }
}

async function execMagick(args) {
  try {
    await exec('magick', args);
  } catch (err) {
    await exec('convert', args);
  }
}

function buildImageArgs(settings = {}) {
  const args = [];
  if (settings.dpi) args.push('-density', String(settings.dpi));
  if (settings.resize) args.push('-resize', String(settings.resize));
  if (settings.crop) args.push('-crop', String(settings.crop));
  if (settings.quality) args.push('-quality', String(settings.quality));
  return args;
}

function buildVideoArgs(settings = {}) {
  const args = [];
  if (settings.resolution && RESOLUTION_MAP[settings.resolution]) {
    args.push('-vf', `scale=${RESOLUTION_MAP[settings.resolution]}`);
  }
  if (settings.fps) args.push('-r', String(settings.fps));
  if (settings.bitrate) args.push('-b:v', String(settings.bitrate));
  if (settings.codec && CODEC_MAP[settings.codec]) args.push('-c:v', CODEC_MAP[settings.codec]);
  return args;
}

function buildAudioArgs(settings = {}) {
  const pre = [];
  const post = [];
  if (settings.trimStart) pre.push('-ss', String(settings.trimStart));
  if (settings.trimDuration) pre.push('-t', String(settings.trimDuration));
  if (settings.bitrate) post.push('-b:a', String(settings.bitrate));
  if (settings.channels) post.push('-ac', String(settings.channels));
  if (settings.normalize) post.push('-af', 'loudnorm');
  return { pre, post };
}

function resolveSofficeOutput(workDir, expectedPath, ext, beforeNames) {
  if (fs.existsSync(expectedPath)) return expectedPath;
  const targetExt = `.${String(ext || '').toLowerCase()}`;
  const candidates = fs.readdirSync(workDir)
    .filter((name) => path.extname(name).toLowerCase() === targetExt)
    .map((name) => path.join(workDir, name));
  const created = candidates.filter((filePath) => !beforeNames.has(path.basename(filePath)));
  if (created.length === 1) return created[0];
  if (candidates.length === 1) return candidates[0];
  return null;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForSofficeOutput(workDir, expectedPath, ext, beforeNames, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const resolved = resolveSofficeOutput(workDir, expectedPath, ext, beforeNames);
    if (resolved) return resolved;
    await sleep(250);
  }
  return resolveSofficeOutput(workDir, expectedPath, ext, beforeNames);
}

async function execSoffice(args) {
  try {
    return await exec(SOFFICE, args);
  } catch (error) {
    if (isWin && error?.code === 'EPERM' && /\.com$/i.test(SOFFICE)) {
      const fallbackExe = SOFFICE.replace(/\.com$/i, '.exe');
      if (fs.existsSync(fallbackExe)) {
        return exec(fallbackExe, args);
      }
    }
    throw error;
  }
}

async function convertViaLibreOffice({ inputPath, workDir, sofficeArgs, to, baseName, inputFilter }) {
  const beforeNames = new Set(fs.readdirSync(workDir));
  const args = [...sofficeArgs];
  if (inputFilter) {
    args.push(`--infilter=${inputFilter}`);
  }
  args.push('--convert-to', to, '--outdir', workDir, inputPath);
  const result = await execSoffice(args);
  const expected = path.join(workDir, `${baseName}.${to}`);
  const resolved = await waitForSofficeOutput(workDir, expected, to, beforeNames);
  if (resolved) return resolved;
  const detail = String(result?.stderr || result?.stdout || '').replace(/\s+/g, ' ').trim();
  if (detail) {
    throw new Error(`LibreOffice did not produce output: ${detail}`);
  }
  throw new Error('LibreOffice did not produce output');
}

function ensureUtf8Bom(filePath) {
  if (!fs.existsSync(filePath)) return;
  const current = fs.readFileSync(filePath);
  const hasBom = current.length >= 3 && current[0] === 0xEF && current[1] === 0xBB && current[2] === 0xBF;
  if (hasBom) return;
  fs.writeFileSync(filePath, Buffer.concat([Buffer.from([0xEF, 0xBB, 0xBF]), current]));
}

function hasTextContent(filePath) {
  if (!fs.existsSync(filePath)) return false;
  try {
    if (fs.statSync(filePath).size === 0) return false;
    const text = fs.readFileSync(filePath, 'utf8');
    return text.replace(/\s+/g, '').length > 0;
  } catch {
    return false;
  }
}

async function runTesseract(pagePath, outBase) {
  const langs = OCR_LANGS.length ? OCR_LANGS : ['eng'];
  const commands = isWin
    ? ['tesseract', 'C:\\Program Files\\Tesseract-OCR\\tesseract.exe']
    : ['tesseract'];

  for (const cmd of commands) {
    for (const lang of langs) {
      try {
        await exec(cmd, [pagePath, outBase, '-l', lang]);
        return true;
      } catch {}
    }
  }
  return false;
}

async function extractPdfText(inputPath, outputPath, workDir) {
  try {
    await exec('pdftotext', ['-enc', 'UTF-8', inputPath, outputPath]);
  } catch {}

  if (hasTextContent(outputPath)) {
    ensureUtf8Bom(outputPath);
    return outputPath;
  }

  try {
    await exec(GS, ['-dNOPAUSE', '-dBATCH', '-sDEVICE=txtwrite', `-sOutputFile=${outputPath}`, inputPath]);
  } catch {}

  if (hasTextContent(outputPath)) {
    ensureUtf8Bom(outputPath);
    return outputPath;
  }

  try {
    const imagePattern = path.join(workDir, 'ocr-page-%03d.png');
    await exec(GS, ['-dNOPAUSE', '-dBATCH', '-sDEVICE=png16m', '-r200', `-sOutputFile=${imagePattern}`, inputPath]);
    const pages = fs.readdirSync(workDir)
      .filter((name) => /^ocr-page-\d+\.png$/i.test(name))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    const chunks = [];

    for (const page of pages) {
      const pagePath = path.join(workDir, page);
      const outBase = path.join(workDir, path.basename(page, '.png'));
      const ocrDone = await runTesseract(pagePath, outBase);
      if (!ocrDone) continue;
      const txtPath = `${outBase}.txt`;
      if (!hasTextContent(txtPath)) continue;
      const text = fs.readFileSync(txtPath, 'utf8').trim();
      if (text) chunks.push(text);
    }

    fs.writeFileSync(outputPath, chunks.join('\n\n'), 'utf8');
  } catch {}

  if (!hasTextContent(outputPath)) {
    fs.writeFileSync(outputPath, '', 'utf8');
  }
  ensureUtf8Bom(outputPath);
  return outputPath;
}

async function convertSingle(tool, inputPath, workDir, settings) {
  if (!TOOL_IDS.has(tool)) {
    throw new Error(`Unsupported tool: ${tool}`);
  }
  const meta = TOOL_META[tool] || null;
  const baseName = path.basename(inputPath, path.extname(inputPath));
  const imageArgs = buildImageArgs(settings?.image);
  const videoArgs = buildVideoArgs(settings?.video);
  const audioArgs = buildAudioArgs(settings?.audio);
  const sofficeArgs = [
    '--headless',
    '--nologo',
    '--nolockcheck',
    '--norestore',
    `-env:UserInstallation=file:///${path.join(workDir, 'lo_profile').replace(/\\/g, '/')}`
  ];

  const delegated = await convertTool({
    tool,
    inputPath,
    workDir,
    settings,
    meta,
    helpers: {
      exec,
      execMagick,
      convertViaLibreOffice: ({ inputPath: sourcePath, workDir: targetDir, to, baseName: outputBaseName, inputFilter }) =>
        convertViaLibreOffice({
          inputPath: sourcePath,
          workDir: targetDir,
          sofficeArgs,
          to,
          baseName: outputBaseName,
          inputFilter
        }),
      extractPdfText,
      ensureUtf8Bom,
      buildImageArgs,
      buildVideoArgs,
      buildAudioArgs
    }
  });
  if (delegated && delegated.length) {
    return delegated;
  }

  if (tool === 'png-jpg' || tool === 'jpg-png' || tool === 'jpg-webp' || tool === 'png-webp' || tool === 'heic-jpg' || tool === 'avif-jpg' || tool === 'avif-png') {
    const ext = tool.split('-')[1];
    const outputPath = path.join(workDir, `${baseName}.${ext}`);
    await execMagick([inputPath, ...imageArgs, outputPath]);
    return [outputPath];
  }

  if (tool === 'svg-png') {
    const outputPath = path.join(workDir, `${baseName}.png`);
    try {
      await exec('rsvg-convert', ['-o', outputPath, inputPath]);
    } catch (err) {
      await execMagick([inputPath, ...imageArgs, outputPath]);
    }
    return [outputPath];
  }

  if (tool === 'svg-jpg') {
    const tempPng = path.join(workDir, `${baseName}_svg.png`);
    const outputPath = path.join(workDir, `${baseName}.jpg`);
    try {
      await exec('rsvg-convert', ['-o', tempPng, inputPath]);
      await execMagick([tempPng, ...imageArgs, outputPath]);
    } catch (err) {
      await execMagick([inputPath, ...imageArgs, outputPath]);
    }
    return [outputPath];
  }

  if (tool === 'image-pdf' || tool === 'jpg-pdf') {
    const outputPath = path.join(workDir, `${baseName}.pdf`);
    await execMagick([inputPath, outputPath]);
    return [outputPath];
  }

  if (tool === 'pdf-images') {
    const outPrefix = path.join(workDir, 'page');
    await exec('pdftoppm', ['-png', inputPath, outPrefix]);
    const files = fs.readdirSync(workDir).filter((f) => f.startsWith('page-') && f.endsWith('.png')).map((f) => path.join(workDir, f));
    return files;
  }

  if (tool === 'pdf-txt') {
    const outputPath = path.join(workDir, `${baseName}.txt`);
    await extractPdfText(inputPath, outputPath, workDir);
    return [outputPath];
  }

  if (tool === 'txt-pdf') {
    const out = await convertViaLibreOffice({
      inputPath,
      workDir,
      sofficeArgs,
      to: 'pdf',
      baseName,
      inputFilter: 'Text (encoded):UTF8,LF,,,'
    });
    return [out];
  }

  if (tool === 'pdf-word') {
    const txtPath = path.join(workDir, `${baseName}.txt`);
    await extractPdfText(inputPath, txtPath, workDir);
    ensureUtf8Bom(txtPath);
    const out = await convertViaLibreOffice({
      inputPath: txtPath,
      workDir,
      sofficeArgs,
      to: 'docx',
      baseName,
      inputFilter: 'Text (encoded):UTF8,LF,,,'
    });
    return [out];
  }

  if (tool === 'pdf-excel' || tool === 'pdf-pptx' || tool === 'word-pdf' || tool === 'excel-pdf' || tool === 'pptx-pdf' || tool === 'cad-pdf') {
    const to = tool === 'pdf-excel' ? 'xlsx' : tool === 'pdf-pptx' ? 'pptx' : 'pdf';
    const out = await convertViaLibreOffice({ inputPath, workDir, sofficeArgs, to, baseName });
    return [out];
  }

  if (tool === 'compress-pdf') {
    const outputPath = path.join(workDir, `${baseName}_compressed.pdf`);
    await exec(GS, [
      '-sDEVICE=pdfwrite',
      '-dCompatibilityLevel=1.4',
      '-dPDFSETTINGS=/ebook',
      '-dNOPAUSE',
      '-dQUIET',
      '-dBATCH',
      `-sOutputFile=${outputPath}`,
      inputPath
    ]);
    return [outputPath];
  }

  if (tool === 'mp4-mp3' || tool === 'mp3-wav' || tool === 'wav-mp3' || tool === 'm4a-mp3' || tool === 'flac-mp3' || tool === 'ogg-mp3' || tool === 'audio-aac') {
    const ext = tool.split('-')[1];
    const outputPath = path.join(workDir, `${baseName}.${ext}`);
    await exec('ffmpeg', ['-y', ...audioArgs.pre, '-i', inputPath, ...audioArgs.post, outputPath]);
    return [outputPath];
  }

  if (tool === 'mp4-gif') {
    const outputPath = path.join(workDir, `${baseName}.gif`);
    await exec('ffmpeg', ['-y', '-i', inputPath, '-vf', 'fps=10,scale=640:-1:flags=lanczos', outputPath]);
    return [outputPath];
  }

  if (tool === 'compress-video') {
    const outputPath = path.join(workDir, `${baseName}_compressed.mp4`);
    await exec('ffmpeg', ['-y', '-i', inputPath, ...videoArgs, '-c:v', 'libx264', '-crf', '28', '-preset', 'veryfast', '-c:a', 'aac', '-b:a', '128k', outputPath]);
    return [outputPath];
  }

  if (tool === 'mov-mp4' || tool === 'mkv-mp4' || tool === 'avi-mp4') {
    const outputPath = path.join(workDir, `${baseName}.mp4`);
    await exec('ffmpeg', ['-y', '-i', inputPath, ...videoArgs, '-c:v', 'libx264', '-c:a', 'aac', outputPath]);
    return [outputPath];
  }

  if (tool === 'video-webm') {
    const outputPath = path.join(workDir, `${baseName}.webm`);
    await exec('ffmpeg', ['-y', '-i', inputPath, ...videoArgs, '-c:v', 'libvpx-vp9', '-c:a', 'libopus', outputPath]);
    return [outputPath];
  }

  if (tool === 'ocr') {
    const outBase = path.join(workDir, `${baseName}_ocr`);
    await exec('tesseract', [inputPath, outBase, '-l', 'eng+rus']);
    return [`${outBase}.txt`];
  }

  if (tool === 'zip-rar' || tool === 'rar-zip' || tool === '7z-zip' || tool === 'zip-tar') {
    const extractDir = path.join(workDir, 'extract');
    fs.mkdirSync(extractDir, { recursive: true });
    await exec('7z', ['x', inputPath, `-o${extractDir}`]);
    if (tool === 'zip-rar') {
      const outputPath = path.join(workDir, `${baseName}.rar`);
      await exec('7z', ['a', '-tRAR', outputPath, path.join(extractDir, '*')]);
      return [outputPath];
    }
    if (tool === 'zip-tar') {
      const outputPath = path.join(workDir, `${baseName}.tar`);
      await exec('tar', ['-cf', outputPath, '-C', extractDir, '.']);
      return [outputPath];
    }
    const outputPath = path.join(workDir, `${baseName}.zip`);
    if (ZIP === 'zip') {
      await exec('zip', ['-r', outputPath, '.'], { cwd: extractDir });
    } else {
      await exec('7z', ['a', '-tzip', outputPath, '.'], { cwd: extractDir });
    }
    return [outputPath];
  }

  throw new Error(`No conversion strategy for tool: ${tool}`);
}

async function zipFiles(outputZip, files) {
  if (ZIP === 'zip') {
    const args = ['-j', outputZip, ...files];
    await exec('zip', args);
  } else {
    const args = ['a', '-tzip', outputZip, ...files];
    await exec('7z', args);
  }
}

async function handleSingle(job, data) {
  const { tool, inputKey, outputKey, originalName, settings, encryption } = data;
  const workDir = path.join(tmpRoot, job.id || job.name || 'job');
  fs.mkdirSync(workDir, { recursive: true });
  try {
    if (job?.timestamp && Date.now() - job.timestamp > JOB_MAX_AGE_MS) {
      throw new Error('Job TTL exceeded');
    }
    const inputPath = path.join(workDir, path.basename(originalName || 'input'));
    const encPath = encryption?.enabled ? path.join(workDir, `${path.basename(originalName || 'input')}.enc`) : null;
    job.updateProgress(5);
    if (storageMode === 's3') {
      const inputObj = await s3.send(new GetObjectCommand({ Bucket: process.env.S3_BUCKET, Key: inputKey }));
      await streamToFile(inputObj.Body, encryption?.enabled ? encPath : inputPath);
    } else {
      const srcPath = localPathForKey(inputKey);
      fs.copyFileSync(srcPath, encryption?.enabled ? encPath : inputPath);
    }
    job.updateProgress(30);

    let outputMeta = null;
    let key = null;
    if (encryption?.enabled) {
      key = await unwrapKey(encryption);
      await decryptFileGcm(encPath, inputPath, encryption, key);
    }

    assertMagic(tool, inputPath);
    const outputs = await convertSingle(tool, inputPath, workDir, settings);

    let finalPath = outputs[0];
    if (outputs.length > 1) {
      const zipPath = path.join(workDir, 'pages.zip');
      await zipFiles(zipPath, outputs);
      finalPath = zipPath;
    }
    if (!fs.existsSync(finalPath)) {
      throw new Error('Output not produced');
    }
    const stat = fs.statSync(finalPath);
    if (!stat.size) {
      throw new Error('Output is empty');
    }

    job.updateProgress(80);
    let uploadPath = finalPath;
    if (encryption?.enabled) {
      const encOut = path.join(workDir, `${path.basename(finalPath)}.enc`);
      outputMeta = await encryptFileGcm(finalPath, encOut, key);
      uploadPath = encOut;
    }
    if (storageMode === 's3') {
      await s3.send(new PutObjectCommand({ Bucket: process.env.S3_BUCKET, Key: outputKey, Body: fs.createReadStream(uploadPath) }));
    } else {
      const destPath = localPathForKey(outputKey);
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      fs.copyFileSync(uploadPath, destPath);
    }
    job.updateProgress(100);
    return { outputKey, outputMeta };
  } finally {
    try { fs.rmSync(workDir, { recursive: true, force: true }); } catch {}
  }
}

async function handleBatch(job, data) {
  const { tool, items, outputKey, settings, encryption } = data;
  const workDir = path.join(tmpRoot, `${job.id || job.name || 'job'}_batch`);
  const outDir = path.join(workDir, 'out');
  fs.mkdirSync(outDir, { recursive: true });
  try {
    if (job?.timestamp && Date.now() - job.timestamp > JOB_MAX_AGE_MS) {
      throw new Error('Job TTL exceeded');
    }
    let outputMeta = null;
    let key = null;
    if (encryption?.enabled) {
      key = await unwrapKey(encryption);
    }
    let index = 0;
    for (const item of items) {
      index += 1;
      const inputPath = path.join(workDir, path.basename(item.originalName || `file_${index}`));
      const encPath = encryption?.enabled ? path.join(workDir, `${path.basename(item.originalName || `file_${index}`)}.enc`) : null;
      if (storageMode === 's3') {
        const inputObj = await s3.send(new GetObjectCommand({ Bucket: process.env.S3_BUCKET, Key: item.inputKey }));
        await streamToFile(inputObj.Body, encryption?.enabled ? encPath : inputPath);
      } else {
        const srcPath = localPathForKey(item.inputKey);
        fs.copyFileSync(srcPath, encryption?.enabled ? encPath : inputPath);
      }
      if (encryption?.enabled) {
        const meta = item.encryption || encryption;
        await decryptFileGcm(encPath, inputPath, meta, key);
      }
      assertMagic(tool, inputPath);
      const outputs = await convertSingle(tool, inputPath, workDir, settings);
      const target = outputs[0];
      const dest = path.join(outDir, path.basename(target));
      fs.copyFileSync(target, dest);
      job.updateProgress(Math.min(80, Math.round((index / items.length) * 70) + 10));
    }

    const zipPath = path.join(workDir, 'batch.zip');
    if (ZIP === 'zip') {
      await exec('zip', ['-r', zipPath, '.'], { cwd: outDir });
    } else {
      await exec('7z', ['a', '-tzip', zipPath, '.'], { cwd: outDir });
    }
    if (!fs.existsSync(zipPath)) {
      throw new Error('Batch output not produced');
    }
    let uploadPath = zipPath;
    if (encryption?.enabled) {
      const encOut = path.join(workDir, 'batch.zip.enc');
      outputMeta = await encryptFileGcm(zipPath, encOut, key);
      uploadPath = encOut;
    }
    if (storageMode === 's3') {
      await s3.send(new PutObjectCommand({ Bucket: process.env.S3_BUCKET, Key: outputKey, Body: fs.createReadStream(uploadPath) }));
    } else {
      const destPath = localPathForKey(outputKey);
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      fs.copyFileSync(uploadPath, destPath);
    }
    job.updateProgress(100);
    return { outputKey, outputMeta };
  } finally {
    try { fs.rmSync(workDir, { recursive: true, force: true }); } catch {}
  }
}

const worker = new Worker('convert', async (job) => {
  if (job.data.batch) {
    return handleBatch(job, job.data);
  }
  return handleSingle(job, job.data);
}, {
  connection,
  concurrency: Number(process.env.WORKER_CONCURRENCY || 2)
});

worker.on('active', (job) => {
  log({
    type: 'job_started',
    requestId: job?.data?.requestId || null,
    jobId: job?.id,
    tool: job?.data?.tool,
    batch: !!job?.data?.batch,
    inputSize: job?.data?.inputSize || null,
    inputFormat: job?.data?.inputFormat || null
  });
});

worker.on('failed', async (job, err) => {
  const started = job?.processedOn || job?.timestamp || Date.now();
  const finished = job?.finishedOn || Date.now();
  const maxAttempts = job?.opts?.attempts || 1;
  if (job && job.attemptsMade >= maxAttempts) {
    await cleanupEncryptionSession(job);
    try {
      await dlq.add('convert', { ...job.data, failedAt: Date.now(), error: err?.message || 'unknown' }, { removeOnComplete: 1000 });
    } catch (dlqError) {
      logError({
        type: 'dlq_add_failed',
        jobId: job?.id || null,
        error: dlqError?.message || 'unknown'
      });
    }
  }
  logError({
    type: 'job_failed',
    requestId: job?.data?.requestId || null,
    jobId: job?.id,
    durationMs: finished - started,
    error: err?.message || 'unknown'
  });
});

worker.on('completed', async (job) => {
  const started = job?.processedOn || job?.timestamp || Date.now();
  const finished = job?.finishedOn || Date.now();
  await cleanupEncryptionSession(job);
  log({
    type: 'job_completed',
    requestId: job?.data?.requestId || null,
    jobId: job?.id,
    durationMs: finished - started
  });
});

log({ type: 'worker_started' });
log({
  type: 'worker_config',
  storageMode,
  redisUrl: process.env.REDIS_URL || null,
  s3Endpoint: process.env.S3_ENDPOINT || null,
  s3Region: process.env.S3_REGION || null,
  bucket: process.env.S3_BUCKET || null
});
logToolchainStatus();
