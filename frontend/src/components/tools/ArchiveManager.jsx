import React from 'react';
import { Archive } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import ToolPlaceholder from './ToolPlaceholder.jsx';

export default function ArchiveManager() {
  const { t } = useTranslation();

  return (
    <ToolPlaceholder
      icon={Archive}
      badge={t('toolArchiveManagerBadge')}
      title={t('toolArchiveManagerTitle')}
      description={t('toolArchiveManagerDescription')}
    />
  );
}
