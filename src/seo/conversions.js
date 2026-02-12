const CONVERSIONS = [
  { id: 'pdf-word', slug: 'pdf-to-word', from: 'PDF', to: 'Word', category: 'documents' },
  { id: 'pdf-excel', slug: 'pdf-to-excel', from: 'PDF', to: 'Excel', category: 'documents' },
  { id: 'pdf-pptx', slug: 'pdf-to-powerpoint', from: 'PDF', to: 'PowerPoint', category: 'documents' },
  { id: 'word-pdf', slug: 'word-to-pdf', from: 'Word', to: 'PDF', category: 'documents' },
  { id: 'excel-pdf', slug: 'excel-to-pdf', from: 'Excel', to: 'PDF', category: 'documents' },
  { id: 'pptx-pdf', slug: 'powerpoint-to-pdf', from: 'PowerPoint', to: 'PDF', category: 'documents' },
  { id: 'pdf-txt', slug: 'pdf-to-txt', from: 'PDF', to: 'TXT', category: 'documents' },
  { id: 'txt-pdf', slug: 'txt-to-pdf', from: 'TXT', to: 'PDF', category: 'documents' },
  { id: 'image-pdf', slug: 'image-to-pdf', from: 'Image', to: 'PDF', category: 'images' },
  { id: 'pdf-images', slug: 'pdf-to-images', from: 'PDF', to: 'Images', category: 'images' },
  { id: 'png-jpg', slug: 'png-to-jpg', from: 'PNG', to: 'JPG', category: 'images' },
  { id: 'jpg-png', slug: 'jpg-to-png', from: 'JPG', to: 'PNG', category: 'images' },
  { id: 'jpg-webp', slug: 'jpg-to-webp', from: 'JPG', to: 'WEBP', category: 'images' },
  { id: 'png-webp', slug: 'png-to-webp', from: 'PNG', to: 'WEBP', category: 'images' },
  { id: 'heic-jpg', slug: 'heic-to-jpg', from: 'HEIC', to: 'JPG', category: 'images' },
  { id: 'avif-jpg', slug: 'avif-to-jpg', from: 'AVIF', to: 'JPG', category: 'images' },
  { id: 'avif-png', slug: 'avif-to-png', from: 'AVIF', to: 'PNG', category: 'images' },
  { id: 'svg-png', slug: 'svg-to-png', from: 'SVG', to: 'PNG', category: 'images' },
  { id: 'svg-jpg', slug: 'svg-to-jpg', from: 'SVG', to: 'JPG', category: 'images' },
  { id: 'jpg-pdf', slug: 'jpg-to-pdf', from: 'JPG', to: 'PDF', category: 'documents' },
  { id: 'compress-pdf', slug: 'compress-pdf', from: 'PDF', to: 'Compressed PDF', category: 'documents' },
  { id: 'mp4-mp3', slug: 'mp4-to-mp3', from: 'MP4', to: 'MP3', category: 'video' },
  { id: 'mp4-gif', slug: 'mp4-to-gif', from: 'MP4', to: 'GIF', category: 'video' },
  { id: 'mov-mp4', slug: 'mov-to-mp4', from: 'MOV', to: 'MP4', category: 'video' },
  { id: 'mkv-mp4', slug: 'mkv-to-mp4', from: 'MKV', to: 'MP4', category: 'video' },
  { id: 'avi-mp4', slug: 'avi-to-mp4', from: 'AVI', to: 'MP4', category: 'video' },
  { id: 'video-webm', slug: 'video-to-webm', from: 'Video', to: 'WEBM', category: 'video' },
  { id: 'compress-video', slug: 'compress-video', from: 'Video', to: 'Compressed Video', category: 'video' },
  { id: 'mp3-wav', slug: 'mp3-to-wav', from: 'MP3', to: 'WAV', category: 'audio' },
  { id: 'wav-mp3', slug: 'wav-to-mp3', from: 'WAV', to: 'MP3', category: 'audio' },
  { id: 'm4a-mp3', slug: 'm4a-to-mp3', from: 'M4A', to: 'MP3', category: 'audio' },
  { id: 'flac-mp3', slug: 'flac-to-mp3', from: 'FLAC', to: 'MP3', category: 'audio' },
  { id: 'ogg-mp3', slug: 'ogg-to-mp3', from: 'OGG', to: 'MP3', category: 'audio' },
  { id: 'audio-aac', slug: 'audio-to-aac', from: 'Audio', to: 'AAC', category: 'audio' },
  { id: 'zip-rar', slug: 'zip-to-rar', from: 'ZIP', to: 'RAR', category: 'archives' },
  { id: 'rar-zip', slug: 'rar-to-zip', from: 'RAR', to: 'ZIP', category: 'archives' },
  { id: '7z-zip', slug: '7z-to-zip', from: '7Z', to: 'ZIP', category: 'archives' },
  { id: 'zip-tar', slug: 'zip-to-tar', from: 'ZIP', to: 'TAR', category: 'archives' },
  { id: 'ocr', slug: 'ocr-image-to-text', from: 'Image', to: 'Text', category: 'documents' },
  { id: 'cad-pdf', slug: 'cad-to-pdf', from: 'CAD', to: 'PDF', category: 'documents' }
];

const getConversionBySlug = (slug) => CONVERSIONS.find((c) => c.slug === slug);

const getRelatedConversions = (category, excludeSlug, limit = 8) => {
  return CONVERSIONS.filter((c) => c.category === category && c.slug !== excludeSlug).slice(0, limit);
};

export { CONVERSIONS, getConversionBySlug, getRelatedConversions };
