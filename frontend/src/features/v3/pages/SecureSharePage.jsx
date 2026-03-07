import React from 'react';
import FeaturePlaceholderPage from './FeaturePlaceholderPage.jsx';

export default function SecureSharePage() {
  return (
    <FeaturePlaceholderPage
      eyebrow="Tools / Sharing"
      title="Secure Share (24h links)"
      description="Каркас для коротких одноразовых ссылок с TTL 24 часа. Основная логика хранения и валидации будет lightweight на сервере, а UX и крипто-подготовка на клиенте."
      stack={['Short token routing', 'TTL policy', 'Signed metadata']}
      milestones={[
        'Роут и UI-заглушка готовы.',
        'Следующий шаг: генерация короткого токена и lifecycle.',
        'Следующий шаг: страница статуса ссылки (active/expired).'
      ]}
    />
  );
}

