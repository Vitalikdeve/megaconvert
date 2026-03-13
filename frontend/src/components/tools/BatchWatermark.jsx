import React from 'react';
import { Stamp } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import ToolPlaceholder from './ToolPlaceholder.jsx';

export default function BatchWatermark() {
  const { t } = useTranslation();

  return (
    <ToolPlaceholder
      icon={Stamp}
      badge={t('toolBatchWatermarkBadge')}
      title={t('toolBatchWatermarkTitle')}
      description={t('toolBatchWatermarkDescription')}
    />
  );
}
