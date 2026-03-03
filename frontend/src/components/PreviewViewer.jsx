import React from 'react';

const PreviewViewer = ({ fileUrl, type }) => {
  if (!fileUrl) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-slate-400">
        Превью недоступно.
      </div>
    );
  }
  if (type === 'image') {
    return (
      <img
        src={fileUrl}
        alt="Preview"
        loading="lazy"
        decoding="async"
        className="w-full rounded-2xl border border-white/10"
      />
    );
  }
  if (type === 'pdf') {
    return (
      <iframe
        title="PDF Preview"
        src={fileUrl}
        className="w-full h-[420px] rounded-2xl border border-white/10 bg-white"
      />
    );
  }
  if (type === 'doc') {
    const viewer = `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(fileUrl)}`;
    return (
      <iframe
        title="Doc Preview"
        src={viewer}
        className="w-full h-[420px] rounded-2xl border border-white/10 bg-white"
      />
    );
  }
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-slate-400">
      Формат не поддерживает встроенное превью.
    </div>
  );
};

export default PreviewViewer;
