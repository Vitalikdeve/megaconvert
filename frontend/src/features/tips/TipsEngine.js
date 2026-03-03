export const getSmartTips = ({ fileType, status, queueDepth = 0 }) => {
  const tips = [];

  if (status === 'error') {
    tips.push('Retry with a smaller file or another output format.');
  }
  if (queueDepth > 20) {
    tips.push('Queue is busy. You can continue and monitor status in dashboard.');
  }
  if (fileType === 'pdf') {
    tips.push('For editable output choose DOCX if text layer exists.');
  }
  if (fileType === 'image') {
    tips.push('Use WEBP for web delivery and JPG for broad compatibility.');
  }
  if (fileType === 'video') {
    tips.push('Use MP4/H264 for best compatibility and playback speed.');
  }

  return tips.slice(0, 3);
};

