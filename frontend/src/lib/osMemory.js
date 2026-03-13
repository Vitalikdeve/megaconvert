export const LAST_TOOL_KEY = 'megaconvert.os.lastTool.v1';
export const OCR_SESSION_KEY = 'megaconvert.smartocr.session.v1';

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
