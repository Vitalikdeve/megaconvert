const fs = require('fs');
const path = require('path');

const IMAGE_EXTS = new Set([
  'jpg', 'jpeg', 'png', 'webp', 'heic', 'heif', 'avif', 'tif', 'tiff', 'bmp',
  'gif', 'ico', 'psd', 'raw', 'cr2', 'nef', 'orf', 'dng', 'eps', 'ai', 'svg'
]);

const VIDEO_EXTS = new Set(['mp4', 'mov', 'mkv', 'avi', 'webm', 'flv', 'wmv', 'm4v', 'ogv']);
const AUDIO_EXTS = new Set(['mp3', 'wav', 'flac', 'aac', 'm4a', 'ogg', 'wma', 'aiff', 'amr', 'opus', 'm4r']);

const getExt = (filePath = '') => {
  const lower = String(filePath).toLowerCase();
  if (lower.endsWith('.tar.gz')) return 'tar.gz';
  return path.extname(lower).replace('.', '') || '';
};

const getBaseName = (filePath = '') => {
  const lower = String(filePath).toLowerCase();
  if (lower.endsWith('.tar.gz')) return path.basename(filePath, '.tar.gz');
  return path.basename(filePath, path.extname(filePath));
};

const escapeCsv = (value) => {
  const text = value == null ? '' : String(value);
  if (!/[",\n\r\t]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
};

const parseDelimited = (text, delimiter = ',') => {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  const input = String(text || '').replace(/\r\n/g, '\n');
  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    if (ch === '"') {
      if (inQuotes && input[i + 1] === '"') {
        field += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (!inQuotes && ch === delimiter) {
      row.push(field);
      field = '';
      continue;
    }
    if (!inQuotes && ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      continue;
    }
    field += ch;
  }
  row.push(field);
  if (row.length > 1 || row[0] !== '') rows.push(row);
  return rows;
};

const stringifyDelimited = (rows, delimiter = ',') =>
  rows.map((row) => row.map((value) => escapeCsv(value)).join(delimiter)).join('\n');

const delimitedToObjects = (rows) => {
  if (!rows.length) return [];
  const header = rows[0].map((item, idx) => item || `col_${idx + 1}`);
  return rows.slice(1).map((row) => {
    const obj = {};
    header.forEach((key, idx) => {
      obj[key] = row[idx] ?? '';
    });
    return obj;
  });
};

const objectsToRows = (value) => {
  const list = Array.isArray(value) ? value : [value];
  const normalized = list.filter((item) => item && typeof item === 'object' && !Array.isArray(item));
  if (!normalized.length) return [['value'], [JSON.stringify(value ?? '')]];
  const headers = [...new Set(normalized.flatMap((item) => Object.keys(item)))];
  const rows = [headers];
  for (const item of normalized) {
    rows.push(headers.map((key) => item[key] ?? ''));
  }
  return rows;
};

const escapeXml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;');

const decodeXml = (value) => String(value ?? '')
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"')
  .replace(/&apos;/g, "'")
  .replace(/&amp;/g, '&');

const jsonToXml = (value, root = 'root') => {
  const writeNode = (key, node) => {
    if (Array.isArray(node)) return node.map((item) => writeNode(key, item)).join('');
    if (node && typeof node === 'object') {
      const children = Object.entries(node)
        .map(([childKey, childValue]) => writeNode(childKey, childValue))
        .join('');
      return `<${key}>${children}</${key}>`;
    }
    return `<${key}>${escapeXml(node)}</${key}>`;
  };
  return `<?xml version="1.0" encoding="UTF-8"?>\n${writeNode(root, value)}`;
};

const xmlToJson = (xmlText) => {
  const body = String(xmlText || '')
    .replace(/<\?xml[\s\S]*?\?>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .trim();

  const parseFragment = (fragment) => {
    const tagRegex = /<([A-Za-z_][\w:.-]*)[^>]*>([\s\S]*?)<\/\1>/g;
    let match = tagRegex.exec(fragment);
    if (!match) return decodeXml(fragment.trim());
    const result = {};
    tagRegex.lastIndex = 0;
    while ((match = tagRegex.exec(fragment)) !== null) {
      const key = match[1];
      const value = parseFragment(match[2]);
      if (Object.prototype.hasOwnProperty.call(result, key)) {
        if (!Array.isArray(result[key])) result[key] = [result[key]];
        result[key].push(value);
      } else {
        result[key] = value;
      }
    }
    return result;
  };

  return parseFragment(body);
};

const parseScalar = (value) => {
  const text = String(value ?? '').trim();
  if (text === '') return '';
  if (text === 'true') return true;
  if (text === 'false') return false;
  if (text === 'null') return null;
  if (/^-?\d+(\.\d+)?$/.test(text)) return Number(text);
  return text.replace(/^["']|["']$/g, '');
};

const yamlToJson = (yamlText) => {
  const result = {};
  const lines = String(yamlText || '').replace(/\r\n/g, '\n').split('\n');
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || line.startsWith('- ')) continue;
    const idx = line.indexOf(':');
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    result[key] = parseScalar(value);
  }
  return result;
};

const jsonToYaml = (value, indent = 0) => {
  if (Array.isArray(value)) {
    return value.map((item) => `${' '.repeat(indent)}- ${typeof item === 'object' ? '' : String(item)}`).join('\n');
  }
  if (!value || typeof value !== 'object') return String(value ?? '');
  return Object.entries(value).map(([key, item]) => {
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      return `${' '.repeat(indent)}${key}:\n${jsonToYaml(item, indent + 2)}`;
    }
    return `${' '.repeat(indent)}${key}: ${String(item ?? '')}`;
  }).join('\n');
};

const parseIniLike = (text) => {
  const root = {};
  let current = root;
  const lines = String(text || '').replace(/\r\n/g, '\n').split('\n');
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith(';') || line.startsWith('#')) continue;
    if (line.startsWith('[') && line.endsWith(']')) {
      const section = line.slice(1, -1).trim();
      root[section] = root[section] || {};
      current = root[section];
      continue;
    }
    const idx = line.indexOf('=');
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    current[key] = parseScalar(value);
  }
  return root;
};

const toIniLike = (value) => {
  const lines = [];
  const object = value && typeof value === 'object' ? value : { value };
  for (const [key, item] of Object.entries(object)) {
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      lines.push(`[${key}]`);
      for (const [childKey, childValue] of Object.entries(item)) {
        lines.push(`${childKey}=${childValue == null ? '' : childValue}`);
      }
      lines.push('');
    } else {
      lines.push(`${key}=${item == null ? '' : item}`);
    }
  }
  return lines.join('\n').trim();
};

const markdownToHtml = (markdown) => {
  const lines = String(markdown || '').replace(/\r\n/g, '\n').split('\n');
  const out = [];
  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (!line) {
      out.push('');
      continue;
    }
    if (line.startsWith('### ')) out.push(`<h3>${escapeXml(line.slice(4))}</h3>`);
    else if (line.startsWith('## ')) out.push(`<h2>${escapeXml(line.slice(3))}</h2>`);
    else if (line.startsWith('# ')) out.push(`<h1>${escapeXml(line.slice(2))}</h1>`);
    else if (line.startsWith('- ')) out.push(`<li>${escapeXml(line.slice(2))}</li>`);
    else out.push(`<p>${escapeXml(line)}</p>`);
  }
  return `<!doctype html><html><body>\n${out.join('\n')}\n</body></html>`;
};

const htmlToText = (html) => String(html || '')
  .replace(/<script[\s\S]*?<\/script>/gi, '')
  .replace(/<style[\s\S]*?<\/style>/gi, '')
  .replace(/<\/(p|div|h1|h2|h3|li|br)>/gi, '\n')
  .replace(/<[^>]+>/g, '')
  .replace(/\n{3,}/g, '\n\n')
  .trim();

const htmlToMarkdown = (html) => String(html || '')
  .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '# $1\n')
  .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '## $1\n')
  .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '### $1\n')
  .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '- $1\n')
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<\/p>/gi, '\n')
  .replace(/<[^>]+>/g, '')
  .replace(/\n{3,}/g, '\n\n')
  .trim();

const csvToSql = (csvText) => {
  const rows = parseDelimited(csvText, ',');
  if (!rows.length) return 'CREATE TABLE data (value TEXT);';
  const header = rows[0].map((item, idx) => item || `col_${idx + 1}`);
  const escapedHeader = header.map((col) => `"${String(col).replace(/"/g, '""')}"`);
  const values = rows.slice(1).map((row) => {
    const items = header.map((_, idx) => {
      const value = row[idx] ?? '';
      return `'${String(value).replace(/'/g, "''")}'`;
    });
    return `(${items.join(', ')})`;
  });
  const create = `CREATE TABLE data (${escapedHeader.map((col) => `${col} TEXT`).join(', ')});`;
  if (!values.length) return create;
  return `${create}\nINSERT INTO data (${escapedHeader.join(', ')}) VALUES\n${values.join(',\n')};`;
};

const sqlToCsv = (sqlText) => {
  const rows = [];
  const text = String(sqlText || '');
  const insertRegex = /INSERT\s+INTO[\s\S]*?VALUES\s*([\s\S]*?);/gi;
  let match;
  while ((match = insertRegex.exec(text)) !== null) {
    const tupleRegex = /\(([\s\S]*?)\)/g;
    let tuple;
    while ((tuple = tupleRegex.exec(match[1])) !== null) {
      const raw = tuple[1];
      const cols = [];
      let current = '';
      let inQuote = false;
      for (let i = 0; i < raw.length; i += 1) {
        const ch = raw[i];
        if (ch === "'") {
          if (inQuote && raw[i + 1] === "'") {
            current += "'";
            i += 1;
          } else {
            inQuote = !inQuote;
          }
          continue;
        }
        if (!inQuote && ch === ',') {
          cols.push(current.trim());
          current = '';
          continue;
        }
        current += ch;
      }
      cols.push(current.trim());
      rows.push(cols.map((value) => value.replace(/^NULL$/i, '')));
    }
  }
  if (!rows.length) return 'value\n';
  const width = rows.reduce((max, row) => Math.max(max, row.length), 0);
  const header = Array.from({ length: width }, (_, idx) => `col_${idx + 1}`);
  return stringifyDelimited([header, ...rows], ',');
};

const CSV_CALC_FILTER_COMMA = 'Text - txt - csv (StarCalc):44,34,76,1';
const CSV_CALC_FILTER_TAB = 'Text - txt - csv (StarCalc):9,34,76,1';

const toSpreadsheetColumn = (index) => {
  let value = Number(index) + 1;
  let column = '';
  while (value > 0) {
    const rem = (value - 1) % 26;
    column = String.fromCharCode(65 + rem) + column;
    value = Math.floor((value - 1) / 26);
  }
  return column;
};

const rowsToXlsxSheetXml = (rows) => {
  const body = rows.map((row, rowIdx) => {
    const cells = row.map((cell, colIdx) => {
      const ref = `${toSpreadsheetColumn(colIdx)}${rowIdx + 1}`;
      const text = String(cell ?? '');
      if (/^-?\d+(\.\d+)?$/.test(text)) {
        return `<c r="${ref}"><v>${text}</v></c>`;
      }
      return `<c r="${ref}" t="inlineStr"><is><t>${escapeXml(text)}</t></is></c>`;
    }).join('');
    return `<row r="${rowIdx + 1}">${cells}</row>`;
  }).join('');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<sheetData>${body}</sheetData>` +
    `</worksheet>\n`;
};

const writeSimpleXlsx = async (helpers, { rows, workDir, baseName }) => {
  const xlsxPath = path.join(workDir, `${baseName}.xlsx`);
  const packDir = path.join(workDir, `${baseName}_xlsx_pack`);
  const relsDir = path.join(packDir, '_rels');
  const xlDir = path.join(packDir, 'xl');
  const xlRelsDir = path.join(xlDir, '_rels');
  const xlSheetsDir = path.join(xlDir, 'worksheets');
  fs.mkdirSync(relsDir, { recursive: true });
  fs.mkdirSync(xlRelsDir, { recursive: true });
  fs.mkdirSync(xlSheetsDir, { recursive: true });

  fs.writeFileSync(
    path.join(packDir, '[Content_Types].xml'),
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="xml" ContentType="application/xml"/>` +
    `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
    `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>` +
    `</Types>\n`,
    'utf8'
  );

  fs.writeFileSync(
    path.join(relsDir, '.rels'),
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
    `</Relationships>\n`,
    'utf8'
  );

  fs.writeFileSync(
    path.join(xlDir, 'workbook.xml'),
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ` +
    `xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
    `<sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets>` +
    `</workbook>\n`,
    'utf8'
  );

  fs.writeFileSync(
    path.join(xlRelsDir, 'workbook.xml.rels'),
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>` +
    `</Relationships>\n`,
    'utf8'
  );

  fs.writeFileSync(path.join(xlSheetsDir, 'sheet1.xml'), rowsToXlsxSheetXml(rows), 'utf8');

  try {
    await helpers.exec('7z', ['a', '-tzip', xlsxPath, '.'], { cwd: packDir });
  } catch {
    await helpers.exec('zip', ['-r', xlsxPath, '.'], { cwd: packDir });
  }

  if (!fs.existsSync(xlsxPath)) {
    throw new Error('Failed to create XLSX output');
  }
  return xlsxPath;
};

const rowsToXlsHtml = (rows) => {
  const body = rows.map((row) =>
    `<tr>${row.map((cell) => `<td>${escapeXml(cell)}</td>`).join('')}</tr>`
  ).join('\n');
  return `<!doctype html><html><head><meta charset="UTF-8"></head><body><table>${body}</table></body></html>\n`;
};

const extractPdfRows = async (helpers, { inputPath, workDir, baseName }) => {
  const txtPath = path.join(workDir, `${baseName}.txt`);
  await helpers.extractPdfText(inputPath, txtPath, workDir);
  const lines = fs.readFileSync(txtPath, 'utf8').replace(/\r\n/g, '\n').split('\n').filter(Boolean);
  return [['line'], ...lines.map((line) => [line])];
};

const convertPdfToSpreadsheet = async (helpers, {
  inputPath,
  workDir,
  baseName,
  outputExt
}) => {
  const rows = await extractPdfRows(helpers, { inputPath, workDir, baseName });
  const csvPath = path.join(workDir, `${baseName}_pdf_rows.csv`);
  fs.writeFileSync(csvPath, stringifyDelimited(rows, ','), 'utf8');

  try {
    return await helpers.convertViaLibreOffice({
      inputPath: csvPath,
      workDir,
      to: outputExt,
      baseName,
      inputFilter: CSV_CALC_FILTER_COMMA
    });
  } catch {
    const tsvPath = path.join(workDir, `${baseName}_pdf_rows.tsv`);
    fs.writeFileSync(tsvPath, stringifyDelimited(rows, '\t'), 'utf8');
    try {
      return await helpers.convertViaLibreOffice({
        inputPath: tsvPath,
        workDir,
        to: outputExt,
        baseName,
        inputFilter: CSV_CALC_FILTER_TAB
      });
    } catch (tabError) {
      if (outputExt === 'xlsx') {
        try {
          return await writeSimpleXlsx(helpers, { rows, workDir, baseName });
        } catch {
          throw tabError;
        }
      }

      const xlsPath = path.join(workDir, `${baseName}.xls`);
      fs.writeFileSync(xlsPath, rowsToXlsHtml(rows), 'utf8');
      if (fs.existsSync(xlsPath)) return xlsPath;
      throw tabError;
    }
  }
};

const tryCommands = async (helpers, commands) => {
  let lastError = null;
  for (const [cmd, args, options] of commands) {
    try {
      await helpers.exec(cmd, args, options || {});
      return;
    } catch (error) {
      lastError = error;
    }
  }
  if (lastError) throw lastError;
};

const isMissingDependencyError = (error, command) => {
  const message = String(error?.message || '');
  const stderr = String(error?.stderr || '');
  const target = String(command || '').trim();
  if (!target) return message.includes('Missing dependency');
  return message.includes(`Missing dependency: ${target}`) || stderr.includes('not found');
};

const convertRasterToSvg = async (inputPath, outputPath) => {
  const mimeMap = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
    bmp: 'image/bmp',
    tif: 'image/tiff',
    tiff: 'image/tiff',
    avif: 'image/avif'
  };
  const ext = getExt(inputPath);
  const mime = mimeMap[ext] || 'application/octet-stream';
  const base64 = fs.readFileSync(inputPath).toString('base64');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000">\n  <image href="data:${mime};base64,${base64}" width="1000" height="1000"/>\n</svg>\n`;
  fs.writeFileSync(outputPath, svg, 'utf8');
};

const convertPdfToImage = async (helpers, { inputPath, workDir, baseName, outputExt, highRes = false }) => {
  const outPrefix = path.join(workDir, `${baseName}_page`);
  const formatFlag = outputExt === 'jpg' ? '-jpeg' : '-png';
  const outputPath = `${outPrefix}.${outputExt}`;
  const ppmArgs = [formatFlag, '-singlefile'];
  if (highRes) ppmArgs.push('-rx', '300', '-ry', '300');
  ppmArgs.push(inputPath, outPrefix);
  try {
    await helpers.exec('pdftoppm', ppmArgs);
    if (fs.existsSync(outputPath)) return outputPath;
  } catch {
    // fallback to ImageMagick below
  }
  await helpers.execMagick([inputPath, outputPath]);
  return outputPath;
};

const convertArchiveTool = async (helpers, { outputExt, inputPath, workDir, baseName }) => {
  const extractDir = path.join(workDir, 'extract');
  fs.mkdirSync(extractDir, { recursive: true });
  await helpers.exec('7z', ['x', '-y', inputPath, `-o${extractDir}`]);

  const outputPath = path.join(workDir, `${baseName}.${outputExt}`);
  if (outputExt === 'zip') {
    await helpers.exec('7z', ['a', '-tzip', outputPath, '.'], { cwd: extractDir });
    return [outputPath];
  }
  if (outputExt === '7z') {
    await helpers.exec('7z', ['a', '-t7z', outputPath, '.'], { cwd: extractDir });
    return [outputPath];
  }
  if (outputExt === 'rar') {
    await helpers.exec('7z', ['a', '-tRAR', outputPath, '.'], { cwd: extractDir });
    return [outputPath];
  }
  if (outputExt === 'tar') {
    await helpers.exec('tar', ['-cf', outputPath, '-C', extractDir, '.']);
    return [outputPath];
  }
  if (outputExt === 'tar.gz') {
    await helpers.exec('tar', ['-czf', outputPath, '-C', extractDir, '.']);
    return [outputPath];
  }
  if (outputExt === 'gz' || outputExt === 'bz2' || outputExt === 'xz') {
    const tarPath = path.join(workDir, `${baseName}.tar`);
    await helpers.exec('tar', ['-cf', tarPath, '-C', extractDir, '.']);
    const typeFlag = outputExt === 'gz' ? '-tgzip' : outputExt === 'bz2' ? '-tbzip2' : '-txz';
    await helpers.exec('7z', ['a', typeFlag, outputPath, tarPath]);
    return [outputPath];
  }
  if (outputExt === 'iso') {
    await tryCommands(helpers, [
      ['genisoimage', ['-quiet', '-o', outputPath, extractDir]],
      ['mkisofs', ['-quiet', '-o', outputPath, extractDir]],
      ['xorriso', ['-as', 'mkisofs', '-o', outputPath, extractDir]],
      ['7z', ['a', '-tiso', outputPath, '.'], { cwd: extractDir }]
    ]);
    return [outputPath];
  }
  throw new Error(`Archive output format is not supported: ${outputExt}`);
};

const convertDataTool = async (helpers, { tool, outputExt, inputPath, workDir, baseName }) => {
  const outputPath = path.join(workDir, `${baseName}.${outputExt}`);
  const inputText = fs.readFileSync(inputPath, 'utf8');

  if (tool === 'json-csv') {
    const parsed = JSON.parse(inputText);
    fs.writeFileSync(outputPath, stringifyDelimited(objectsToRows(parsed), ','), 'utf8');
    return [outputPath];
  }
  if (tool === 'csv-json') {
    fs.writeFileSync(outputPath, JSON.stringify(delimitedToObjects(parseDelimited(inputText, ',')), null, 2), 'utf8');
    return [outputPath];
  }
  if (tool === 'json-xml') {
    fs.writeFileSync(outputPath, jsonToXml(JSON.parse(inputText), 'root'), 'utf8');
    return [outputPath];
  }
  if (tool === 'xml-json') {
    fs.writeFileSync(outputPath, JSON.stringify(xmlToJson(inputText), null, 2), 'utf8');
    return [outputPath];
  }
  if (tool === 'yaml-json') {
    fs.writeFileSync(outputPath, JSON.stringify(yamlToJson(inputText), null, 2), 'utf8');
    return [outputPath];
  }
  if (tool === 'json-yaml') {
    fs.writeFileSync(outputPath, `${jsonToYaml(JSON.parse(inputText))}\n`, 'utf8');
    return [outputPath];
  }
  if (tool === 'xml-csv') {
    const parsed = xmlToJson(inputText);
    fs.writeFileSync(outputPath, stringifyDelimited(objectsToRows(parsed?.root || parsed), ','), 'utf8');
    return [outputPath];
  }
  if (tool === 'csv-xml') {
    fs.writeFileSync(outputPath, jsonToXml({ row: delimitedToObjects(parseDelimited(inputText, ',')) }, 'rows'), 'utf8');
    return [outputPath];
  }
  if (tool === 'markdown-html') {
    fs.writeFileSync(outputPath, markdownToHtml(inputText), 'utf8');
    return [outputPath];
  }
  if (tool === 'html-markdown') {
    fs.writeFileSync(outputPath, `${htmlToMarkdown(inputText)}\n`, 'utf8');
    return [outputPath];
  }
  if (tool === 'markdown-pdf') {
    const htmlPath = path.join(workDir, `${baseName}.html`);
    fs.writeFileSync(htmlPath, markdownToHtml(inputText), 'utf8');
    const out = await helpers.convertViaLibreOffice({ inputPath: htmlPath, workDir, to: 'pdf', baseName });
    return [out];
  }
  if (tool === 'html-txt') {
    fs.writeFileSync(outputPath, `${htmlToText(inputText)}\n`, 'utf8');
    return [outputPath];
  }
  if (tool === 'txt-html') {
    fs.writeFileSync(outputPath, `<!doctype html><html><body><pre>${escapeXml(inputText)}</pre></body></html>\n`, 'utf8');
    return [outputPath];
  }
  if (tool === 'sql-csv') {
    fs.writeFileSync(outputPath, sqlToCsv(inputText), 'utf8');
    return [outputPath];
  }
  if (tool === 'csv-sql') {
    fs.writeFileSync(outputPath, `${csvToSql(inputText)}\n`, 'utf8');
    return [outputPath];
  }
  if (tool === 'base64-file') {
    fs.writeFileSync(outputPath, Buffer.from(String(inputText || '').replace(/\s+/g, ''), 'base64'));
    return [outputPath];
  }
  if (tool === 'file-base64') {
    fs.writeFileSync(outputPath, `${fs.readFileSync(inputPath).toString('base64')}\n`, 'utf8');
    return [outputPath];
  }
  if (tool === 'log-csv') {
    const lines = String(inputText || '').replace(/\r\n/g, '\n').split('\n').filter(Boolean);
    fs.writeFileSync(outputPath, stringifyDelimited([['line'], ...lines.map((line) => [line])], ','), 'utf8');
    return [outputPath];
  }
  if (tool === 'csv-tsv-data') {
    fs.writeFileSync(outputPath, stringifyDelimited(parseDelimited(inputText, ','), '\t'), 'utf8');
    return [outputPath];
  }
  if (tool === 'tsv-json') {
    fs.writeFileSync(outputPath, JSON.stringify(delimitedToObjects(parseDelimited(inputText, '\t')), null, 2), 'utf8');
    return [outputPath];
  }
  if (tool === 'json-tsv') {
    fs.writeFileSync(outputPath, stringifyDelimited(objectsToRows(JSON.parse(inputText)), '\t'), 'utf8');
    return [outputPath];
  }
  if (tool === 'toml-json' || tool === 'ini-json') {
    fs.writeFileSync(outputPath, JSON.stringify(parseIniLike(inputText), null, 2), 'utf8');
    return [outputPath];
  }
  if (tool === 'json-toml' || tool === 'json-ini') {
    fs.writeFileSync(outputPath, `${toIniLike(JSON.parse(inputText))}\n`, 'utf8');
    return [outputPath];
  }

  throw new Error(`Data conversion is not supported for tool ${tool}`);
};

const convertMediaTool = async (helpers, {
  tool,
  inputPath,
  workDir,
  baseName,
  outputExt,
  videoArgs,
  videoTrimArgs,
  audioArgs
}) => {
  if (tool === 'mp4-jpg-frames' || tool === 'mp4-png-frames') {
    const frameExt = tool === 'mp4-jpg-frames' ? 'jpg' : 'png';
    const frameDir = path.join(workDir, 'frames');
    fs.mkdirSync(frameDir, { recursive: true });
    await helpers.exec('ffmpeg', ['-y', ...(videoTrimArgs?.pre || []), '-i', inputPath, ...(videoTrimArgs?.post || []), path.join(frameDir, `frame-%05d.${frameExt}`)]);
    const zipPath = path.join(workDir, `${baseName}_${frameExt}_frames.zip`);
    await helpers.exec('7z', ['a', '-tzip', zipPath, '.'], { cwd: frameDir });
    return [zipPath];
  }

  if (tool === 'mp4-hls' || tool === 'mp4-dash') {
    const streamDir = path.join(workDir, tool === 'mp4-hls' ? 'hls' : 'dash');
    fs.mkdirSync(streamDir, { recursive: true });
    if (tool === 'mp4-hls') {
      await helpers.exec('ffmpeg', ['-y', ...(videoTrimArgs?.pre || []), '-i', inputPath, ...(videoTrimArgs?.post || []), '-c:v', 'libx264', '-c:a', 'aac', '-f', 'hls', '-hls_time', '6', '-hls_playlist_type', 'vod', path.join(streamDir, 'index.m3u8')]);
    } else {
      await helpers.exec('ffmpeg', ['-y', ...(videoTrimArgs?.pre || []), '-i', inputPath, ...(videoTrimArgs?.post || []), '-map', '0', '-c:v', 'libx264', '-c:a', 'aac', '-f', 'dash', path.join(streamDir, 'manifest.mpd')]);
    }
    const zipPath = path.join(workDir, `${baseName}_${tool === 'mp4-hls' ? 'hls' : 'dash'}.zip`);
    await helpers.exec('7z', ['a', '-tzip', zipPath, '.'], { cwd: streamDir });
    return [zipPath];
  }

  const outputPath = path.join(workDir, `${baseName}.${outputExt}`);
  if (tool === 'mp4-prores') {
    await helpers.exec('ffmpeg', ['-y', ...(videoTrimArgs?.pre || []), '-i', inputPath, ...(videoTrimArgs?.post || []), '-c:v', 'prores_ks', '-profile:v', '3', '-c:a', 'pcm_s16le', outputPath]);
    return [outputPath];
  }
  if (tool === 'mp4-vp9') {
    await helpers.exec('ffmpeg', ['-y', ...(videoTrimArgs?.pre || []), '-i', inputPath, ...(videoTrimArgs?.post || []), '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '33', '-c:a', 'libopus', outputPath]);
    return [outputPath];
  }
  if (outputExt === 'gif') {
    await helpers.exec('ffmpeg', ['-y', ...(videoTrimArgs?.pre || []), '-i', inputPath, ...(videoTrimArgs?.post || []), '-vf', 'fps=10,scale=640:-1:flags=lanczos', outputPath]);
    return [outputPath];
  }

  if (AUDIO_EXTS.has(outputExt)) {
    const codecByExt = {
      mp3: ['-c:a', 'libmp3lame'],
      wav: ['-c:a', 'pcm_s16le'],
      flac: ['-c:a', 'flac'],
      aac: ['-c:a', 'aac'],
      m4a: ['-c:a', 'aac'],
      ogg: ['-c:a', 'libvorbis'],
      wma: ['-c:a', 'wmav2'],
      aiff: ['-c:a', 'pcm_s16be'],
      amr: ['-c:a', 'libopencore_amrnb'],
      opus: ['-c:a', 'libopus'],
      m4r: ['-c:a', 'aac']
    };
    const forceBitrate = tool === 'mp3-320kbps' ? '320k' : tool === 'mp3-128kbps' ? '128k' : null;
    const bitArgs = forceBitrate ? ['-b:a', forceBitrate] : [];
    const formatArgs = outputExt === 'm4r' ? ['-f', 'ipod'] : [];
    await helpers.exec('ffmpeg', ['-y', ...audioArgs.pre, '-i', inputPath, ...audioArgs.post, ...codecByExt[outputExt], ...bitArgs, ...formatArgs, outputPath]);
    return [outputPath];
  }

  if (VIDEO_EXTS.has(outputExt)) {
    const codecArgsByExt = {
      mp4: ['-c:v', 'libx264', '-c:a', 'aac'],
      mov: ['-c:v', 'libx264', '-c:a', 'aac'],
      mkv: ['-c:v', 'libx264', '-c:a', 'aac'],
      avi: ['-c:v', 'mpeg4', '-c:a', 'libmp3lame'],
      webm: ['-c:v', 'libvpx-vp9', '-c:a', 'libopus'],
      flv: ['-c:v', 'libx264', '-c:a', 'aac'],
      wmv: ['-c:v', 'wmv2', '-c:a', 'wmav2'],
      m4v: ['-c:v', 'libx264', '-c:a', 'aac'],
      ogv: ['-c:v', 'libtheora', '-c:a', 'libvorbis']
    };
    await helpers.exec('ffmpeg', ['-y', ...(videoTrimArgs?.pre || []), '-i', inputPath, ...(videoTrimArgs?.post || []), ...videoArgs, ...codecArgsByExt[outputExt], outputPath]);
    return [outputPath];
  }

  throw new Error(`Media conversion is not supported for output ${outputExt}`);
};

const convertDocumentTool = async (helpers, {
  tool,
  inputPath,
  workDir,
  baseName,
  inputExt,
  outputExt,
  imageArgs
}) => {
  if (tool === 'pdf-word') {
    const txtPath = path.join(workDir, `${baseName}.txt`);
    await helpers.extractPdfText(inputPath, txtPath, workDir);
    helpers.ensureUtf8Bom(txtPath);
    const out = await helpers.convertViaLibreOffice({
      inputPath: txtPath,
      workDir,
      to: 'docx',
      baseName,
      inputFilter: 'Text (encoded):UTF8,LF,,,'
    });
    return [out];
  }

  if (tool === 'pdf-txt') {
    const outputPath = path.join(workDir, `${baseName}.txt`);
    await helpers.extractPdfText(inputPath, outputPath, workDir);
    return [outputPath];
  }

  if (inputExt === 'pdf' && (outputExt === 'xls' || outputExt === 'xlsx')) {
    const outputPath = await convertPdfToSpreadsheet(helpers, {
      inputPath,
      workDir,
      baseName,
      outputExt
    });
    return [outputPath];
  }

  if (inputExt === 'pdf' && (outputExt === 'png' || outputExt === 'jpg')) {
    const outputPath = await convertPdfToImage(helpers, {
      inputPath,
      workDir,
      baseName,
      outputExt,
      highRes: tool === 'pdf-png-hires'
    });
    return [outputPath];
  }

  if (inputExt === 'pdf' && outputExt === 'svg') {
    const outputPath = path.join(workDir, `${baseName}.svg`);
    try {
      await helpers.exec('pdftocairo', ['-svg', '-singlefile', inputPath, path.join(workDir, baseName)]);
      if (fs.existsSync(outputPath)) return [outputPath];
    } catch {
      // fallback below
    }
    const pngPath = await convertPdfToImage(helpers, { inputPath, workDir, baseName, outputExt: 'png' });
    await convertRasterToSvg(pngPath, outputPath);
    return [outputPath];
  }

  if (inputExt === 'svg' && outputExt === 'pdf') {
    const outputPath = path.join(workDir, `${baseName}.pdf`);
    try {
      await helpers.exec('rsvg-convert', ['-f', 'pdf', '-o', outputPath, inputPath]);
    } catch {
      await helpers.execMagick([inputPath, outputPath]);
    }
    return [outputPath];
  }

  if (IMAGE_EXTS.has(inputExt) && outputExt === 'pdf') {
    const outputPath = path.join(workDir, `${baseName}.pdf`);
    await helpers.execMagick([inputPath, ...imageArgs, outputPath]);
    return [outputPath];
  }

  if (inputExt === 'csv' && outputExt === 'tsv') {
    const rows = parseDelimited(fs.readFileSync(inputPath, 'utf8'), ',');
    const outputPath = path.join(workDir, `${baseName}.tsv`);
    fs.writeFileSync(outputPath, stringifyDelimited(rows, '\t'), 'utf8');
    return [outputPath];
  }
  if (inputExt === 'tsv' && outputExt === 'csv') {
    const rows = parseDelimited(fs.readFileSync(inputPath, 'utf8'), '\t');
    const outputPath = path.join(workDir, `${baseName}.csv`);
    fs.writeFileSync(outputPath, stringifyDelimited(rows, ','), 'utf8');
    return [outputPath];
  }

  if (inputExt === 'pdf' && outputExt === 'csv') {
    const txtPath = path.join(workDir, `${baseName}.txt`);
    await helpers.extractPdfText(inputPath, txtPath, workDir);
    const lines = fs.readFileSync(txtPath, 'utf8').replace(/\r\n/g, '\n').split('\n').filter(Boolean);
    const outputPath = path.join(workDir, `${baseName}.csv`);
    fs.writeFileSync(outputPath, stringifyDelimited([['line'], ...lines.map((line) => [line])], ','), 'utf8');
    return [outputPath];
  }

  if (inputExt === 'txt' && outputExt === 'html') {
    const text = fs.readFileSync(inputPath, 'utf8');
    const outputPath = path.join(workDir, `${baseName}.html`);
    fs.writeFileSync(outputPath, `<!doctype html><html><body><pre>${escapeXml(text)}</pre></body></html>\n`, 'utf8');
    return [outputPath];
  }
  if ((inputExt === 'html' || inputExt === 'htm') && outputExt === 'txt') {
    const text = fs.readFileSync(inputPath, 'utf8');
    const outputPath = path.join(workDir, `${baseName}.txt`);
    fs.writeFileSync(outputPath, `${htmlToText(text)}\n`, 'utf8');
    return [outputPath];
  }

  if (inputExt === 'epub' || outputExt === 'epub' || inputExt === 'mobi' || outputExt === 'mobi') {
    const outputPath = path.join(workDir, `${baseName}.${outputExt}`);
    try {
      await tryCommands(helpers, [['ebook-convert', [inputPath, outputPath]]]);
      return [outputPath];
    } catch (error) {
      if (!isMissingDependencyError(error, 'ebook-convert')) throw error;

      if (inputExt === 'epub' && outputExt === 'pdf') {
        try {
          const fallbackOut = await helpers.convertViaLibreOffice({ inputPath, workDir, to: 'pdf', baseName });
          return [fallbackOut];
        } catch {
          // Keep canonical dependency error below.
        }
      }

      if (inputExt === 'pdf' && outputExt === 'epub') {
        try {
          const fallbackOut = await helpers.convertViaLibreOffice({ inputPath, workDir, to: 'epub', baseName });
          return [fallbackOut];
        } catch {
          // Keep canonical dependency error below.
        }
      }

      const missing = new Error('Temporary unavailable: ebook conversion dependency is missing');
      missing.code = 'DEPENDENCY_MISSING_EBOOK_CONVERT';
      throw missing;
    }
  }

  const out = await helpers.convertViaLibreOffice({ inputPath, workDir, to: outputExt, baseName });
  return [out];
};

const convertImageTool = async (helpers, {
  inputPath,
  workDir,
  baseName,
  inputExt,
  outputExt,
  imageArgs
}) => {
  if (inputExt === 'svg' && outputExt !== 'svg') {
    const outputPath = path.join(workDir, `${baseName}.${outputExt}`);
    if (outputExt === 'jpg') {
      const tempPng = path.join(workDir, `${baseName}_svg.png`);
      try {
        await helpers.exec('rsvg-convert', ['-o', tempPng, inputPath]);
        await helpers.execMagick([tempPng, ...imageArgs, outputPath]);
      } catch {
        await helpers.execMagick([inputPath, ...imageArgs, outputPath]);
      }
      return [outputPath];
    }
    if (outputExt === 'pdf') {
      try {
        await helpers.exec('rsvg-convert', ['-f', 'pdf', '-o', outputPath, inputPath]);
      } catch {
        await helpers.execMagick([inputPath, outputPath]);
      }
      return [outputPath];
    }
    try {
      await helpers.exec('rsvg-convert', ['-o', outputPath, inputPath]);
    } catch {
      await helpers.execMagick([inputPath, ...imageArgs, outputPath]);
    }
    return [outputPath];
  }

  if (outputExt === 'svg') {
    const outputPath = path.join(workDir, `${baseName}.svg`);
    if (inputExt === 'pdf') {
      const pngPath = await convertPdfToImage(helpers, { inputPath, workDir, baseName, outputExt: 'png' });
      await convertRasterToSvg(pngPath, outputPath);
    } else {
      await convertRasterToSvg(inputPath, outputPath);
    }
    return [outputPath];
  }

  if (inputExt === 'pdf' && (outputExt === 'png' || outputExt === 'jpg')) {
    const outputPath = await convertPdfToImage(helpers, { inputPath, workDir, baseName, outputExt });
    return [outputPath];
  }

  const outputPath = path.join(workDir, `${baseName}.${outputExt}`);
  await helpers.execMagick([inputPath, ...imageArgs, outputPath]);
  return [outputPath];
};

const convertTool = async ({ tool, inputPath, workDir, settings, meta, helpers }) => {
  if (!meta) return null;
  const baseName = getBaseName(inputPath);
  const outputExt = meta.outputExt;
  const inputExt = getExt(inputPath);
  const imageArgs = helpers.buildImageArgs(settings?.image);
  const videoArgs = helpers.buildVideoArgs(settings?.video);
  const videoTrimArgs = helpers.buildMediaTrimArgs(settings?.video);
  const audioArgs = helpers.buildAudioArgs(settings?.audio);

  if (meta.type === 'data') {
    return convertDataTool(helpers, { tool, outputExt, inputPath, workDir, baseName });
  }

  if (meta.type === 'archive') {
    return convertArchiveTool(helpers, { outputExt, inputPath, workDir, baseName });
  }

  if (meta.type === 'video' || meta.type === 'audio' || VIDEO_EXTS.has(outputExt) || AUDIO_EXTS.has(outputExt)) {
    return convertMediaTool(helpers, { tool, inputPath, workDir, baseName, outputExt, videoArgs, videoTrimArgs, audioArgs });
  }

  if (meta.type === 'image' || (IMAGE_EXTS.has(inputExt) && (IMAGE_EXTS.has(outputExt) || outputExt === 'pdf' || outputExt === 'svg'))) {
    return convertImageTool(helpers, { inputPath, workDir, baseName, inputExt, outputExt, imageArgs });
  }

  return convertDocumentTool(helpers, { tool, inputPath, workDir, baseName, inputExt, outputExt, imageArgs });
};

module.exports = {
  convertTool
};
