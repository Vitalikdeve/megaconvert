import React from 'react';
import { useTranslation } from 'react-i18next';

const PreviewViewer = ({ fileUrl, type }) => {
  const { t } = useTranslation();

  if (!fileUrl) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-slate-400">
        {t('sharedUi.previewViewer.unavailable')}
      </div>
    );
  }
  if (type === 'image') {
    return (
      <img
        src={fileUrl}
        alt={t('sharedUi.previewViewer.imageAlt')}
        loading="lazy"
        decoding="async"
        className="w-full rounded-2xl border border-white/10"
      />
    );
  }
  if (type === 'pdf') {
    return (
      <iframe
        title={t('sharedUi.previewViewer.pdfTitle')}
        src={fileUrl}
        className="w-full h-[420px] rounded-2xl border border-white/10 bg-white"
      />
    );
  }
  if (type === 'doc') {
    const viewer = `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(fileUrl)}`;
    return (
      <iframe
        title={t('sharedUi.previewViewer.docTitle')}
        src={viewer}
        className="w-full h-[420px] rounded-2xl border border-white/10 bg-white"
      />
    );
  }
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-slate-400">
      {t('sharedUi.previewViewer.unsupported')}
    </div>
  );
};

export default PreviewViewer;
