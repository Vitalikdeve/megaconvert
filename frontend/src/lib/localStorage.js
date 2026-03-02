export const storageGetJson = (key, fallbackValue) => {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallbackValue;
  } catch {
    return fallbackValue;
  }
};

export const storageSetJson = (key, value) => {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
};

export const storageGetString = (key, fallbackValue = '') => {
  try {
    const value = window.localStorage.getItem(key);
    return value == null ? fallbackValue : String(value);
  } catch {
    return fallbackValue;
  }
};

export const storageSetString = (key, value) => {
  try {
    window.localStorage.setItem(key, String(value));
    return true;
  } catch {
    return false;
  }
};

