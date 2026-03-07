import React from 'react';
import FeaturePlaceholderPage from './FeaturePlaceholderPage.jsx';

export default function SmartOcrPage() {
  return (
    <FeaturePlaceholderPage
      eyebrow="AI / OCR"
      title="Умный OCR на клиенте"
      description="Заготовка под распознавание текста из изображений и PDF-страниц в браузере пользователя с tesseract.js, без передачи исходников на VPS."
      stack={['tesseract.js', 'Canvas preprocessing', 'Language packs lazy-load']}
      milestones={[
        'Роут и UI-заглушка готовы.',
        'Следующий шаг: pipeline pre-processing (contrast, denoise, deskew).',
        'Следующий шаг: потоковый вывод текста и confidence map.'
      ]}
    />
  );
}

