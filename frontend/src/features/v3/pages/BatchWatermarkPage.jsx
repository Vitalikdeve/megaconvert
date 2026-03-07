import React from 'react';
import FeaturePlaceholderPage from './FeaturePlaceholderPage.jsx';

export default function BatchWatermarkPage() {
  return (
    <FeaturePlaceholderPage
      eyebrow="Tools / Batch"
      title="Пакетный Watermark"
      description="Заглушка для массового ресайза и наложения текста/логотипа на группу изображений с упаковкой результата в ZIP."
      stack={['Canvas composition', 'Batch queue', 'ZIP export']}
      milestones={[
        'Роут и UI-заглушка готовы.',
        'Следующий шаг: шаблоны watermark для текста/логотипа.',
        'Следующий шаг: пакетный экспорт и прогресс по каждому файлу.'
      ]}
    />
  );
}

