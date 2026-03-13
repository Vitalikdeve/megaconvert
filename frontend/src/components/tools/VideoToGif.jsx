import React from 'react';
import { Film } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import ToolPlaceholder from './ToolPlaceholder.jsx';

export default function VideoToGif() {
  const { t } = useTranslation();

  return (
    <ToolPlaceholder
      icon={Film}
      badge={t('toolVideoToGifBadge')}
      title={t('toolVideoToGifTitle')}
      description={t('toolVideoToGifDescription')}
    />
  );
}
