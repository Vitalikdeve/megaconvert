const fs = require('fs');
const path = require('path');
const os = require('os');
const { pipeline } = require('stream');
const { promisify } = require('util');
const { execFile } = require('child_process');
const { Worker } = require('bullmq');
const IORedis = require('ioredis');
const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

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

const isWin = process.platform === 'win32';
const tmpRoot = os.tmpdir();
const GS = isWin ? 'gswin64c' : 'gs';
const ZIP = isWin ? '7z' : 'zip';
const SOFFICE = (() => {
  if (!isWin) return 'soffice';
  const candidates = [
    'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
    'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe'
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

async function convertSingle(tool, inputPath, workDir, settings) {
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
    await exec('pdftotext', [inputPath, outputPath]);
    return [outputPath];
  }

  if (tool === 'txt-pdf') {
    await exec(SOFFICE, [...sofficeArgs, '--convert-to', 'pdf', '--outdir', workDir, inputPath]);
    const out = path.join(workDir, `${baseName}.pdf`);
    if (!fs.existsSync(out)) throw new Error('LibreOffice did not produce output');
    return [out];
  }

  if (tool === 'pdf-word' || tool === 'pdf-excel' || tool === 'pdf-pptx' || tool === 'word-pdf' || tool === 'excel-pdf' || tool === 'pptx-pdf' || tool === 'cad-pdf') {
    const to = tool === 'pdf-word' ? 'docx' : tool === 'pdf-excel' ? 'xlsx' : tool === 'pdf-pptx' ? 'pptx' : 'pdf';
    await exec(SOFFICE, [...sofficeArgs, '--convert-to', to, '--outdir', workDir, inputPath]);
    const out = path.join(workDir, `${baseName}.${to}`);
    if (!fs.existsSync(out)) throw new Error('LibreOffice did not produce output');
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

  const fallback = path.join(workDir, path.basename(inputPath));
  fs.copyFileSync(inputPath, fallback);
  return [fallback];
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
  const { tool, inputKey, outputKey, originalName, settings } = data;
  const workDir = path.join(tmpRoot, job.id || job.name || 'job');
  fs.mkdirSync(workDir, { recursive: true });

  const inputPath = path.join(workDir, path.basename(originalName || 'input'));
  job.updateProgress(5);
  if (storageMode === 's3') {
    const inputObj = await s3.send(new GetObjectCommand({ Bucket: process.env.S3_BUCKET, Key: inputKey }));
    await streamToFile(inputObj.Body, inputPath);
  } else {
    const srcPath = localPathForKey(inputKey);
    fs.copyFileSync(srcPath, inputPath);
  }
  job.updateProgress(30);

  const outputs = await convertSingle(tool, inputPath, workDir, settings);

  let finalPath = outputs[0];
  if (tool === 'pdf-images') {
    const zipPath = path.join(workDir, 'pages.zip');
    await zipFiles(zipPath, outputs);
    finalPath = zipPath;
  }

  job.updateProgress(80);
  if (storageMode === 's3') {
    await s3.send(new PutObjectCommand({ Bucket: process.env.S3_BUCKET, Key: outputKey, Body: fs.createReadStream(finalPath) }));
  } else {
    const destPath = localPathForKey(outputKey);
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.copyFileSync(finalPath, destPath);
  }
  job.updateProgress(100);
  return { outputKey };
}

async function handleBatch(job, data) {
  const { tool, items, outputKey, settings } = data;
  const workDir = path.join(tmpRoot, `${job.id || job.name || 'job'}_batch`);
  const outDir = path.join(workDir, 'out');
  fs.mkdirSync(outDir, { recursive: true });

  let index = 0;
  for (const item of items) {
    index += 1;
    const inputPath = path.join(workDir, path.basename(item.originalName || `file_${index}`));
    if (storageMode === 's3') {
      const inputObj = await s3.send(new GetObjectCommand({ Bucket: process.env.S3_BUCKET, Key: item.inputKey }));
      await streamToFile(inputObj.Body, inputPath);
    } else {
      const srcPath = localPathForKey(item.inputKey);
      fs.copyFileSync(srcPath, inputPath);
    }
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
  if (storageMode === 's3') {
    await s3.send(new PutObjectCommand({ Bucket: process.env.S3_BUCKET, Key: outputKey, Body: fs.createReadStream(zipPath) }));
  } else {
    const destPath = localPathForKey(outputKey);
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.copyFileSync(zipPath, destPath);
  }
  job.updateProgress(100);
  return { outputKey };
}

const worker = new Worker('convert', async (job) => {
  if (job.data.batch) {
    return handleBatch(job, job.data);
  }
  return handleSingle(job, job.data);
}, { connection });

worker.on('failed', (job, err) => {
  const started = job?.processedOn || job?.timestamp || Date.now();
  const finished = job?.finishedOn || Date.now();
  console.error('Job failed', job?.id, err);
  console.log(JSON.stringify({
    type: 'job_failed',
    jobId: job?.id,
    durationMs: finished - started,
    error: err?.message || 'unknown'
  }));
});

worker.on('completed', (job) => {
  const started = job?.processedOn || job?.timestamp || Date.now();
  const finished = job?.finishedOn || Date.now();
  console.log(JSON.stringify({
    type: 'job_completed',
    jobId: job?.id,
    durationMs: finished - started
  }));
});

console.log('Worker started');
