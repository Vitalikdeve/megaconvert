import React from 'react';
import FeaturePlaceholderPage from './FeaturePlaceholderPage.jsx';

export default function ImageOptimizerPage() {
  return (
    <FeaturePlaceholderPage
      eyebrow="Tools / Images"
      title="Интерактивное сжатие изображений"
      description="Каркас страницы для сравнения До/После, контроля качества и целевого веса через browser-image-compression и визуальный слайдер."
      stack={['browser-image-compression', 'Before/After slider', 'Realtime size estimator']}
      milestones={[
        'Роут и UI-заглушка готовы.',
        'Следующий шаг: интерактивный quality slider и live-preview.',
        'Следующий шаг: автопрофили для web/social/print.'
      ]}
    />
  );
}

