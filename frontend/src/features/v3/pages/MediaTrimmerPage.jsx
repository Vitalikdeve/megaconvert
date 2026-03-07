import React from 'react';
import FeaturePlaceholderPage from './FeaturePlaceholderPage.jsx';

export default function MediaTrimmerPage() {
  return (
    <FeaturePlaceholderPage
      eyebrow="Media"
      title="Медиа Триммер"
      description="Заготовка для визуального таймлайна обрезки аудио/видео до запуска конвертации, полностью на стороне клиента."
      stack={['Waveform/Timeline UI', 'Range handles', 'Client-side preview']}
      milestones={[
        'Роут и UI-заглушка готовы.',
        'Следующий шаг: waveform/timeline отрисовка.',
        'Следующий шаг: экспорт фрагмента в pipeline конвертации.'
      ]}
    />
  );
}

