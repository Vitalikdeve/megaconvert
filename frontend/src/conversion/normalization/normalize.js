const removeDiacritics = (value) => value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');

const sanitizeBaseName = (name) => {
  const withoutDiacritics = removeDiacritics(name);
  const ascii = withoutDiacritics.replace(/[^a-zA-Z0-9._-]+/g, '_');
  const collapsed = ascii.replace(/_+/g, '_').replace(/^_+|_+$/g, '');
  return collapsed || 'file';
};

export const normalizeFileName = (name, maxLength = 80) => {
  const parts = name.split('.');
  const ext = parts.length > 1 ? parts.pop().toLowerCase() : '';
  const base = sanitizeBaseName(parts.join('.') || 'file');
  const trimmedBase = base.slice(0, Math.max(1, maxLength - (ext ? ext.length + 1 : 0)));
  return ext ? `${trimmedBase}.${ext}` : trimmedBase;
};

export const normalizeFiles = (files, maxLength) => {
  const seen = new Map();
  return files.map((file) => {
    const safeBase = normalizeFileName(file.name, maxLength);
    const count = seen.get(safeBase) || 0;
    seen.set(safeBase, count + 1);
    if (count === 0) {
      return {
        file,
        originalName: file.name,
        safeName: safeBase,
        size: file.size,
        type: file.type || 'application/octet-stream'
      };
    }
    const parts = safeBase.split('.');
    const ext = parts.length > 1 ? `.${parts.pop()}` : '';
    const base = parts.join('.') || 'file';
    const deduped = `${base}_${count + 1}${ext}`;
    return {
      file,
      originalName: file.name,
      safeName: deduped,
      size: file.size,
      type: file.type || 'application/octet-stream'
    };
  });
};
