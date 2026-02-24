const asAscii = (bytes, start, end) => String.fromCharCode(...bytes.slice(start, end));

export const readMagicBytes = async (file, length = 32) => {
  const buffer = await file.slice(0, length).arrayBuffer();
  return new Uint8Array(buffer);
};

export const detectFormatFromBytes = (bytes) => {
  if (!bytes || bytes.length < 4) return null;
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) return 'pdf';
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) return 'png';
  if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) return 'jpg';
  if (asAscii(bytes, 0, 4) === 'RIFF' && asAscii(bytes, 8, 12) === 'WEBP') return 'webp';
  if (asAscii(bytes, 0, 4) === 'RIFF' && asAscii(bytes, 8, 12) === 'WAVE') return 'wav';
  if (asAscii(bytes, 0, 3) === 'ID3') return 'mp3';
  if (asAscii(bytes, 4, 8) === 'ftyp') {
    const brand = asAscii(bytes, 8, 12).trim();
    const brandLower = brand.toLowerCase();
    const brandUpper = brand.toUpperCase();
    if (brandLower === 'qt') return 'mov';
    if (brandUpper === 'M4R') return 'm4r';
    if (brandUpper === 'M4V') return 'm4v';
    if (['M4A', 'M4B', 'M4P'].includes(brandUpper)) return 'm4a';
    if (brandLower.startsWith('3gp')) return '3gp';
    if (['isom', 'iso2', 'mp41', 'mp42'].includes(brandLower)) return 'mp4';
    if (['heic', 'heix', 'hevc', 'hevx', 'mif1'].includes(brandLower)) return 'heic';
  }
  return null;
};

export const detectFormat = async (file) => {
  const bytes = await readMagicBytes(file, 32);
  return detectFormatFromBytes(bytes);
};
