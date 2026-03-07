import React from 'react';
import FeaturePlaceholderPage from './FeaturePlaceholderPage.jsx';

export default function ExifScrubberPage() {
  return (
    <FeaturePlaceholderPage
      eyebrow="Privacy"
      title="EXIF Scrubber"
      description="Каркас приватного режима для удаления EXIF и служебных метаданных из фотографий перед скачиванием."
      stack={['EXIF parser', 'Metadata strip pipeline', 'Privacy toggle UX']}
      milestones={[
        'Роут и UI-заглушка готовы.',
        'Следующий шаг: детектор и список найденных метаданных.',
        'Следующий шаг: переключатель Privacy Mode в export pipeline.'
      ]}
    />
  );
}

