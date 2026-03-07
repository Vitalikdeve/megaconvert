import React from 'react';
import FeaturePlaceholderPage from './FeaturePlaceholderPage.jsx';

export default function PdfEditorPage() {
  return (
    <FeaturePlaceholderPage
      eyebrow="PDF"
      title="Визуальный PDF-редактор"
      description="Заглушка под drag-and-drop редактор для склейки, разделения и удаления страниц через pdf-lib с акцентом на клиентскую обработку."
      stack={['pdf-lib', 'Drag & Drop board', 'Thumbnail virtualization']}
      milestones={[
        'Роут и UI-заглушка готовы.',
        'Следующий шаг: canvas thumbnails + reorder interactions.',
        'Следующий шаг: экспорт нового PDF в один клик.'
      ]}
    />
  );
}

