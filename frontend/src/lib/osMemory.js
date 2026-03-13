export const LAST_TOOL_KEY = 'megaconvert.os.lastTool.v1';
export const OCR_SESSION_KEY = 'megaconvert.smartocr.session.v1';
export const PDF_EDITOR_HANDOFF_KEY = 'megaconvert.handoff.pdf-editor.v1';
export const OCR_FILE_HANDOFF_KEY = 'megaconvert.handoff.smart-ocr.v1';

const tempMemory = new Map();

export function readStoredJson(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function writeStoredJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function writeTempMemory(key, value) {
  if (!key) {
    return false;
  }

  tempMemory.set(key, value);
  return true;
}

export function readTempMemory(key, fallback = null) {
  if (!key || !tempMemory.has(key)) {
    return fallback;
  }

  return tempMemory.get(key);
}

export function consumeTempMemory(key, fallback = null) {
  if (!key || !tempMemory.has(key)) {
    return fallback;
  }

  const value = tempMemory.get(key);
  tempMemory.delete(key);
  return value;
}

export function clearTempMemory(key) {
  if (!key) {
    return false;
  }

  return tempMemory.delete(key);
}
