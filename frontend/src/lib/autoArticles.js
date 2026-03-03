const LANGUAGE_TEXT = {
  en: {
    updateTitle: 'MegaConvert Platform Update',
    updateExcerpt: 'Product updates, reliability improvements, and new conversion capabilities.',
    updateCategory: 'Updates',
    updateSections: [
      {
        heading: 'What was improved',
        paragraphs: [
          'This release improves conversion stability, queue handling, and observability.',
          'We also optimized user feedback flows: clearer loading, success, and error states.'
        ],
        bullets: [
          'Faster processing in peak periods',
          'More stable retries for failed jobs',
          'Cleaner UX around upload and download'
        ]
      },
      {
        heading: 'Why it matters',
        paragraphs: [
          'Updates focus on practical reliability so users can complete conversions without interruption.',
          'The platform now handles heavy workloads more predictably.'
        ],
        bullets: [
          'Lower failure rate',
          'Better response under load',
          'More transparent operational status'
        ]
      }
    ],
    guideTitle: 'How to convert {from} to {to}',
    guideExcerpt: 'Step-by-step guide for reliable {from} to {to} conversion with quality checks.',
    guideCategoryPrefix: 'Guides',
    guideSections: ({ from, to }) => ([
      {
        heading: '1. Prepare the source file',
        paragraphs: [
          `Check the original ${from} file before conversion to avoid quality loss and formatting issues.`,
          'Use clean source files and avoid repeated re-encoding when possible.'
        ],
        bullets: [
          `Validate ${from} file integrity`,
          'Remove broken or incomplete assets',
          'Keep source quality as high as possible'
        ]
      },
      {
        heading: '2. Convert and verify output',
        paragraphs: [
          `Run conversion to ${to} and verify structure, readability, and compatibility.`,
          'For business documents, review headings, tables, and special symbols.'
        ],
        bullets: [
          `Check ${to} opens on desktop and mobile`,
          'Confirm formatting and metadata',
          'Re-run conversion with adjusted settings if needed'
        ]
      },
      {
        heading: '3. Final QA checklist',
        paragraphs: [
          'Before sharing the result, complete a short quality check.',
          'A repeatable QA checklist prevents silent errors in production workflows.'
        ],
        bullets: [
          'File opens correctly',
          'Content is readable and complete',
          'File size and quality match destination requirements'
        ]
      }
    ])
  },
  ru: {
    updateTitle: 'Обновление платформы MegaConvert',
    updateExcerpt: 'Обновления продукта, улучшения надежности и новые возможности конвертации.',
    updateCategory: 'Обновления',
    updateSections: [
      {
        heading: 'Что улучшили',
        paragraphs: [
          'В этом релизе улучшены стабильность конвертации, обработка очередей и наблюдаемость.',
          'Также улучшен пользовательский фидбек: понятные состояния загрузки, успеха и ошибок.'
        ],
        bullets: [
          'Быстрее обработка в пиковые моменты',
          'Надежнее ретраи при сбоях',
          'Понятнее UX загрузки и скачивания'
        ]
      },
      {
        heading: 'Почему это важно',
        paragraphs: [
          'Фокус обновлений на практической надежности, чтобы пользователь завершал задачу без срывов.',
          'Платформа предсказуемее работает под нагрузкой.'
        ],
        bullets: [
          'Ниже доля ошибок',
          'Лучше ответ под нагрузкой',
          'Прозрачнее операционный статус'
        ]
      }
    ],
    guideTitle: 'Как конвертировать {from} в {to}',
    guideExcerpt: 'Пошаговый гайд по надежной конвертации {from} в {to} с проверкой качества.',
    guideCategoryPrefix: 'Гайды',
    guideSections: ({ from, to }) => ([
      {
        heading: '1. Подготовьте исходный файл',
        paragraphs: [
          `Проверьте исходный файл ${from} до конвертации, чтобы избежать потери качества и проблем с форматированием.`,
          'Используйте чистые исходники и избегайте многократной перекодировки.'
        ],
        bullets: [
          `Проверьте целостность ${from}`,
          'Уберите поврежденные или неполные данные',
          'Сохраняйте максимальное качество источника'
        ]
      },
      {
        heading: '2. Конвертируйте и проверьте результат',
        paragraphs: [
          `Запустите конвертацию в ${to} и проверьте структуру, читаемость и совместимость.`,
          'Для документов отдельно проверьте заголовки, таблицы и спецсимволы.'
        ],
        bullets: [
          `Проверьте открытие ${to} на desktop и mobile`,
          'Проверьте форматирование и метаданные',
          'При необходимости повторите с другими настройками'
        ]
      },
      {
        heading: '3. Финальный QA-чеклист',
        paragraphs: [
          'Перед отправкой результата выполните короткую проверку качества.',
          'Повторяемый чеклист предотвращает скрытые ошибки в рабочих сценариях.'
        ],
        bullets: [
          'Файл корректно открывается',
          'Контент читаемый и полный',
          'Размер и качество соответствуют задаче'
        ]
      }
    ])
  }
};

const FALLBACK_LANG = 'en';
const BLOG_DATE_FORMAT_OPTIONS = { year: 'numeric', month: 'long', day: 'numeric' };
const BLOG_LOCALE = {
  en: 'en-US',
  ru: 'ru-RU',
  es: 'es-ES',
  de: 'de-DE',
  fr: 'fr-FR',
  pt: 'pt-PT',
  it: 'it-IT',
  nl: 'nl-NL',
  pl: 'pl-PL',
  tr: 'tr-TR',
  zh: 'zh-CN',
  'zh-tw': 'zh-TW',
  ar: 'ar-SA',
  ja: 'ja-JP',
  hi: 'hi-IN',
  ko: 'ko-KR',
  be: 'be-BY'
};

const MULTI_LANG_LABELS = {
  en: { updateTitle: 'MegaConvert Platform Update', updateCategory: 'Updates', guideTitle: 'How to convert {from} to {to}', guideCategoryPrefix: 'Guides' },
  ru: { updateTitle: 'Обновление платформы MegaConvert', updateCategory: 'Обновления', guideTitle: 'Как конвертировать {from} в {to}', guideCategoryPrefix: 'Гайды' },
  es: { updateTitle: 'Actualización de MegaConvert', updateCategory: 'Actualizaciones', guideTitle: 'Cómo convertir {from} a {to}', guideCategoryPrefix: 'Guías' },
  de: { updateTitle: 'MegaConvert Plattform-Update', updateCategory: 'Updates', guideTitle: 'So konvertieren Sie {from} zu {to}', guideCategoryPrefix: 'Anleitungen' },
  fr: { updateTitle: 'Mise à jour MegaConvert', updateCategory: 'Mises à jour', guideTitle: 'Comment convertir {from} en {to}', guideCategoryPrefix: 'Guides' },
  pt: { updateTitle: 'Atualização do MegaConvert', updateCategory: 'Atualizações', guideTitle: 'Como converter {from} para {to}', guideCategoryPrefix: 'Guias' },
  it: { updateTitle: 'Aggiornamento MegaConvert', updateCategory: 'Aggiornamenti', guideTitle: 'Come convertire {from} in {to}', guideCategoryPrefix: 'Guide' },
  nl: { updateTitle: 'MegaConvert platformupdate', updateCategory: 'Updates', guideTitle: 'Zo converteer je {from} naar {to}', guideCategoryPrefix: 'Gidsen' },
  pl: { updateTitle: 'Aktualizacja MegaConvert', updateCategory: 'Aktualizacje', guideTitle: 'Jak przekonwertować {from} na {to}', guideCategoryPrefix: 'Poradniki' },
  tr: { updateTitle: 'MegaConvert Güncellemesi', updateCategory: 'Güncellemeler', guideTitle: '{from} dosyası {to} formatına nasıl çevrilir', guideCategoryPrefix: 'Kılavuzlar' },
  zh: { updateTitle: 'MegaConvert 平台更新', updateCategory: '更新', guideTitle: '如何将 {from} 转换为 {to}', guideCategoryPrefix: '指南' },
  'zh-tw': { updateTitle: 'MegaConvert 平台更新', updateCategory: '更新', guideTitle: '如何將 {from} 轉換為 {to}', guideCategoryPrefix: '指南' },
  ar: { updateTitle: 'تحديث منصة MegaConvert', updateCategory: 'التحديثات', guideTitle: 'كيفية تحويل {from} إلى {to}', guideCategoryPrefix: 'أدلة' },
  ja: { updateTitle: 'MegaConvert プラットフォーム更新', updateCategory: '更新', guideTitle: '{from} を {to} に変換する方法', guideCategoryPrefix: 'ガイド' },
  hi: { updateTitle: 'MegaConvert प्लेटफॉर्म अपडेट', updateCategory: 'अपडेट', guideTitle: '{from} को {to} में कैसे बदलें', guideCategoryPrefix: 'गाइड' },
  ko: { updateTitle: 'MegaConvert 플랫폼 업데이트', updateCategory: '업데이트', guideTitle: '{from}를 {to}(으)로 변환하는 방법', guideCategoryPrefix: '가이드' },
  be: { updateTitle: 'Абнаўленне платформы MegaConvert', updateCategory: 'Абнаўленні', guideTitle: 'Як канвертаваць {from} у {to}', guideCategoryPrefix: 'Гайды' }
};

const buildGenericLanguageText = (lang) => {
  const labels = MULTI_LANG_LABELS[lang] || MULTI_LANG_LABELS.en;
  const base = LANGUAGE_TEXT.en;
  return {
    ...base,
    updateTitle: labels.updateTitle,
    updateCategory: labels.updateCategory,
    guideTitle: labels.guideTitle,
    guideCategoryPrefix: labels.guideCategoryPrefix
  };
};

const getText = (lang) => LANGUAGE_TEXT[lang] || buildGenericLanguageText(lang);
const toSlug = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');

const formatDate = (lang, date) => {
  try {
    return new Intl.DateTimeFormat(BLOG_LOCALE[lang] || 'en-US', BLOG_DATE_FORMAT_OPTIONS).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
};

const getReadTime = (sections = []) => {
  const words = sections.reduce((sum, section) => {
    const paragraphs = Array.isArray(section.paragraphs) ? section.paragraphs : [];
    const bullets = Array.isArray(section.bullets) ? section.bullets : [];
    const text = [...paragraphs, ...bullets].join(' ');
    return sum + text.split(/\s+/).filter(Boolean).length;
  }, 0);
  const minutes = Math.max(3, Math.ceil(words / 170));
  return `${minutes} min read`;
};

export const toMarkdownFromSections = (sections = []) => {
  return sections.map((section) => {
    const heading = `## ${section.heading || ''}`.trim();
    const paragraphs = (Array.isArray(section.paragraphs) ? section.paragraphs : []).join('\n\n');
    const bullets = (Array.isArray(section.bullets) ? section.bullets : [])
      .map((item) => `- ${item}`)
      .join('\n');
    return [heading, paragraphs, bullets].filter(Boolean).join('\n\n');
  }).join('\n\n').trim();
};

export const generateAutoUpdateArticles = (lang = 'en', count = 6) => {
  const text = getText(lang);
  const now = new Date();
  return Array.from({ length: Math.max(1, count) }, (_, index) => {
    const date = new Date(now.getTime());
    date.setDate(date.getDate() - (index * 7));
    const title = `${text.updateTitle} #${count - index}`;
    return {
      slug: `update-${lang}-${toSlug(title)}`,
      title,
      excerpt: text.updateExcerpt,
      date: formatDate(lang, date),
      readTime: getReadTime(text.updateSections),
      category: text.updateCategory,
      toolId: '',
      sections: text.updateSections
    };
  });
};

export const generateAutoConversionArticles = (lang = 'en', conversions = []) => {
  const text = getText(lang);
  return (Array.isArray(conversions) ? conversions : []).map((conversion) => {
    const from = String(conversion?.from || '').toUpperCase() || 'FILE';
    const to = String(conversion?.to || '').toUpperCase() || 'FILE';
    const title = text.guideTitle.replace('{from}', from).replace('{to}', to);
    const sections = text.guideSections({ from, to });
    return {
      slug: `guide-${lang}-${String(conversion?.slug || `${from}-${to}`)}`,
      title,
      excerpt: text.guideExcerpt.replace('{from}', from).replace('{to}', to),
      date: formatDate(lang, new Date()),
      readTime: getReadTime(sections),
      category: `${text.guideCategoryPrefix} · ${String(conversion?.category || 'tools')}`,
      toolId: String(conversion?.id || ''),
      sections
    };
  });
};
