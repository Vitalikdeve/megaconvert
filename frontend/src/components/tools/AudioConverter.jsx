import React from 'react';
import { Music } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import ToolPlaceholder from './ToolPlaceholder.jsx';

export default function AudioConverter() {
  const { t } = useTranslation();

  return (
    <ToolPlaceholder
      icon={Music}
      badge={t('toolAudioConverterBadge')}
      title={t('toolAudioConverterTitle')}
      description={t('toolAudioConverterDescription')}
    />
  );
}
