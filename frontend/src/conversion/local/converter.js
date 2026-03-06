import { ConversionError } from '../core/errors';

const EXECUTION_MODES = new Set(['hybrid', 'local', 'server']);
const LOCAL_SUPPORTED_TOOL_IDS = new Set([
  'json-csv',
  'csv-json',
  'json-xml',
  'xml-json',
  'yaml-json',
  'json-yaml',
  'xml-csv',
  'csv-xml',
  'markdown-html',
  'html-markdown',
  'html-txt',
  'txt-html',
  'sql-csv',
  'csv-sql',
  'base64-file',
  'file-base64',
  'log-csv',
  'csv-tsv-data',
  'tsv-json',
  'json-tsv',
  'toml-json',
  'json-toml',
  'ini-json',
  'json-ini'
]);

const TEXT_MIME_BY_EXT = {
  txt: 'text/plain;charset=utf-8',
  csv: 'text/csv;charset=utf-8',
  tsv: 'text/tab-separated-values;charset=utf-8',
  json: 'application/json;charset=utf-8',
  xml: 'application/xml;charset=utf-8',
  html: 'text/html;charset=utf-8',
  md: 'text/markdown;charset=utf-8',
  yaml: 'application/x-yaml;charset=utf-8',
  toml: 'application/toml;charset=utf-8',
  ini: 'text/plain;charset=utf-8',
  sql: 'text/plain;charset=utf-8'
};

const normalizeMode = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (EXECUTION_MODES.has(normalized)) return normalized;
  return '';
};

const sanitizeFileName = (value, fallback = 'converted.bin') => {
  const raw = String(value || '').trim();
  if (!raw) return fallback;
  const withoutReservedChars = raw.replace(/[<>:"/\\|?*]/g, '_');
  let cleaned = '';
  for (const ch of withoutReservedChars) {
    cleaned += ch.charCodeAt(0) < 32 ? '_' : ch;
  }
  cleaned = cleaned.replace(/\s+/g, '_');
  return cleaned || fallback;
};

const decodeUriSafe = (value) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const getInputName = (fileInfo) => {
  if (!fileInfo) return 'input';
  return String(fileInfo.originalName || fileInfo.safeName || fileInfo.file?.name || 'input').trim() || 'input';
};

const getOutputName = (inputName, outputExt) => {
  const safeInput = sanitizeFileName(inputName, 'converted');
  const ext = String(outputExt || 'bin').trim().toLowerCase() || 'bin';
  const dotExt = ext.startsWith('.') ? ext : `.${ext}`;
  const lower = safeInput.toLowerCase();
  const base = lower.endsWith(dotExt)
    ? safeInput.slice(0, -dotExt.length)
    : safeInput.replace(/\.[^.]+$/g, '');
  const resolvedBase = base || 'converted';
  return `${resolvedBase}.${ext}`;
};

const asTextBlob = (text, ext) => new Blob([String(text ?? '')], {
  type: TEXT_MIME_BY_EXT[ext] || 'text/plain;charset=utf-8'
});

const asBinaryBlob = (bytes) => new Blob([bytes], {
  type: 'application/octet-stream'
});

const bytesToBase64 = (bytes) => {
  let result = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    result += String.fromCharCode(...chunk);
  }
  return btoa(result);
};

const base64ToBytes = (value) => {
  const normalized = String(value || '').replace(/\s+/g, '');
  if (!normalized) return new Uint8Array([]);
  const binary = atob(normalized);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
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

const createLocalJobId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `local-${crypto.randomUUID()}`;
  }
  return `local-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
};

const createDownloadUrl = (blob, outputName) => {
  const safeName = sanitizeFileName(outputName, 'converted.bin');
  const objectUrl = URL.createObjectURL(blob);
  return `${objectUrl}#${encodeURIComponent(safeName)}`;
};

const runDataConversion = async (toolId, fileInfo, outputExt) => {
  const file = fileInfo.file;
  const inputName = getInputName(fileInfo);
  const outputName = getOutputName(inputName, outputExt);

  if (toolId === 'file-base64') {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const base64 = `${bytesToBase64(bytes)}\n`;
    return { blob: asTextBlob(base64, outputExt), outputName };
  }

  const inputText = await file.text();
  if (toolId === 'json-csv') {
    const parsed = JSON.parse(inputText);
    return { blob: asTextBlob(stringifyDelimited(objectsToRows(parsed), ','), outputExt), outputName };
  }
  if (toolId === 'csv-json') {
    return { blob: asTextBlob(JSON.stringify(delimitedToObjects(parseDelimited(inputText, ',')), null, 2), outputExt), outputName };
  }
  if (toolId === 'json-xml') {
    return { blob: asTextBlob(jsonToXml(JSON.parse(inputText), 'root'), outputExt), outputName };
  }
  if (toolId === 'xml-json') {
    return { blob: asTextBlob(JSON.stringify(xmlToJson(inputText), null, 2), outputExt), outputName };
  }
  if (toolId === 'yaml-json') {
    return { blob: asTextBlob(JSON.stringify(yamlToJson(inputText), null, 2), outputExt), outputName };
  }
  if (toolId === 'json-yaml') {
    return { blob: asTextBlob(`${jsonToYaml(JSON.parse(inputText))}\n`, outputExt), outputName };
  }
  if (toolId === 'xml-csv') {
    const parsed = xmlToJson(inputText);
    return { blob: asTextBlob(stringifyDelimited(objectsToRows(parsed?.root || parsed), ','), outputExt), outputName };
  }
  if (toolId === 'csv-xml') {
    return { blob: asTextBlob(jsonToXml({ row: delimitedToObjects(parseDelimited(inputText, ',')) }, 'rows'), outputExt), outputName };
  }
  if (toolId === 'markdown-html') {
    return { blob: asTextBlob(markdownToHtml(inputText), outputExt), outputName };
  }
  if (toolId === 'html-markdown') {
    return { blob: asTextBlob(`${htmlToMarkdown(inputText)}\n`, outputExt), outputName };
  }
  if (toolId === 'html-txt') {
    return { blob: asTextBlob(`${htmlToText(inputText)}\n`, outputExt), outputName };
  }
  if (toolId === 'txt-html') {
    return { blob: asTextBlob(`<!doctype html><html><body><pre>${escapeXml(inputText)}</pre></body></html>\n`, outputExt), outputName };
  }
  if (toolId === 'sql-csv') {
    return { blob: asTextBlob(sqlToCsv(inputText), outputExt), outputName };
  }
  if (toolId === 'csv-sql') {
    return { blob: asTextBlob(`${csvToSql(inputText)}\n`, outputExt), outputName };
  }
  if (toolId === 'base64-file') {
    return { blob: asBinaryBlob(base64ToBytes(inputText)), outputName };
  }
  if (toolId === 'log-csv') {
    const lines = String(inputText || '').replace(/\r\n/g, '\n').split('\n').filter(Boolean);
    return { blob: asTextBlob(stringifyDelimited([['line'], ...lines.map((line) => [line])], ','), outputExt), outputName };
  }
  if (toolId === 'csv-tsv-data') {
    return { blob: asTextBlob(stringifyDelimited(parseDelimited(inputText, ','), '\t'), outputExt), outputName };
  }
  if (toolId === 'tsv-json') {
    return { blob: asTextBlob(JSON.stringify(delimitedToObjects(parseDelimited(inputText, '\t')), null, 2), outputExt), outputName };
  }
  if (toolId === 'json-tsv') {
    return { blob: asTextBlob(stringifyDelimited(objectsToRows(JSON.parse(inputText)), '\t'), outputExt), outputName };
  }
  if (toolId === 'toml-json' || toolId === 'ini-json') {
    return { blob: asTextBlob(JSON.stringify(parseIniLike(inputText), null, 2), outputExt), outputName };
  }
  if (toolId === 'json-toml' || toolId === 'json-ini') {
    return { blob: asTextBlob(`${toIniLike(JSON.parse(inputText))}\n`, outputExt), outputName };
  }
  throw new Error(`Local converter is not implemented for tool: ${toolId}`);
};

export const resolveExecutionMode = (settings) => {
  const fromSettings = normalizeMode(settings?.executionMode || settings?.execution?.mode || settings?.runtime?.mode);
  if (fromSettings) return fromSettings;
  const fromEnv = normalizeMode(import.meta.env.VITE_CONVERSION_EXECUTION_MODE);
  return fromEnv || 'hybrid';
};

export const tryRunLocalConversion = async ({
  toolId,
  processor,
  files,
  batchMode = false,
  executionMode = 'hybrid',
  logger
}) => {
  if (executionMode === 'server') return null;
  if (!processor || !Array.isArray(files) || files.length !== 1 || batchMode) {
    if (executionMode === 'local') {
      throw new ConversionError('LOCAL_CONVERSION_UNSUPPORTED', 'Local mode supports only one file at a time.');
    }
    return null;
  }
  if (!LOCAL_SUPPORTED_TOOL_IDS.has(toolId)) {
    if (executionMode === 'local') {
      throw new ConversionError('LOCAL_CONVERSION_UNSUPPORTED', `Local conversion is not available for ${toolId}.`);
    }
    return null;
  }

  try {
    const result = await runDataConversion(toolId, files[0], processor.output);
    const mimeType = result.blob.type || TEXT_MIME_BY_EXT[processor.output] || 'application/octet-stream';
    const outputMeta = {
      local: true,
      outputName: result.outputName,
      contentType: mimeType,
      size: result.blob.size
    };
    return {
      local: true,
      jobId: createLocalJobId(),
      downloadUrl: createDownloadUrl(result.blob, result.outputName),
      outputMeta
    };
  } catch (error) {
    if (executionMode === 'local') {
      throw new ConversionError('LOCAL_CONVERSION_FAILED', error?.message || 'Local conversion failed.', {
        cause: error?.message || String(error)
      });
    }
    logger?.warn('local_conversion_failed_fallback_server', {
      tool: toolId,
      reason: error?.message || String(error)
    });
    return null;
  }
};

export const extractLocalNameFromUrl = (value) => {
  const raw = String(value || '');
  const hash = raw.split('#')[1] || '';
  if (!hash) return '';
  return sanitizeFileName(decodeUriSafe(hash), '');
};
