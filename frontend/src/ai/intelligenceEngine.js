const LEARNING_STORAGE_KEY = 'mc_ai_learning_v1';

const toLower = (value) => String(value || '').trim().toLowerCase();

const normalizeExt = (name) => {
  const tokens = String(name || '').split('.');
  return tokens.length > 1 ? toLower(tokens.pop()) : '';
};

const formatSizeMb = (bytes) => {
  const value = Number(bytes || 0) / (1024 * 1024);
  return `${value.toFixed(1)} MB`;
};

const safeRead = () => {
  if (typeof window === 'undefined') {
    return { preferredTargets: {}, actionCounters: {}, intents: [] };
  }
  try {
    const raw = window.localStorage.getItem(LEARNING_STORAGE_KEY);
    if (!raw) return { preferredTargets: {}, actionCounters: {}, intents: [] };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return { preferredTargets: {}, actionCounters: {}, intents: [] };
    }
    return {
      preferredTargets: parsed.preferredTargets && typeof parsed.preferredTargets === 'object' ? parsed.preferredTargets : {},
      actionCounters: parsed.actionCounters && typeof parsed.actionCounters === 'object' ? parsed.actionCounters : {},
      intents: Array.isArray(parsed.intents) ? parsed.intents.slice(0, 50) : []
    };
  } catch {
    return { preferredTargets: {}, actionCounters: {}, intents: [] };
  }
};

const safeWrite = (value) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LEARNING_STORAGE_KEY, JSON.stringify(value));
  } catch {
    // ignore storage failures
  }
};

export const readAssistantLearningHistory = () => safeRead();

export const registerAssistantFeedback = ({ ext, intent, actionKind, targetFormat }) => {
  const history = safeRead();
  const normalizedExt = toLower(ext);
  const normalizedIntent = toLower(intent);
  const normalizedAction = toLower(actionKind);
  const normalizedTarget = toLower(targetFormat);

  if (normalizedExt && normalizedTarget) {
    history.preferredTargets[normalizedExt] = normalizedTarget;
  }
  if (normalizedAction) {
    history.actionCounters[normalizedAction] = Number(history.actionCounters[normalizedAction] || 0) + 1;
  }
  if (normalizedIntent) {
    history.intents = [normalizedIntent, ...history.intents.filter((item) => item !== normalizedIntent)].slice(0, 12);
  }
  safeWrite(history);
};

const detectIntent = ({ ext, toolType, sizeMb }) => {
  if (['pdf', 'doc', 'docx', 'odt', 'txt', 'rtf'].includes(ext)) {
    return {
      intent: 'editing',
      confidence: 0.92,
      explanation: 'Файл содержит текстовую структуру, вероятна цель редактирования.'
    };
  }
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
    return {
      intent: 'archive',
      confidence: 0.84,
      explanation: 'Архивный формат обычно требует упаковки, хранения или передачи.'
    };
  }
  if (toolType === 'video' || toolType === 'audio' || sizeMb >= 15) {
    return {
      intent: 'optimize',
      confidence: 0.86,
      explanation: 'Крупный медиафайл обычно требует оптимизации размера и скорости.'
    };
  }
  if (toolType === 'image') {
    return {
      intent: 'send',
      confidence: 0.79,
      explanation: 'Изображения чаще готовят для отправки и web-публикации.'
    };
  }
  return {
    intent: 'convert',
    confidence: 0.7,
    explanation: 'По умолчанию выбран сценарий быстрой конвертации.'
  };
};

const getStructure = (ext, toolType) => {
  if (['pdf', 'doc', 'docx', 'odt', 'rtf', 'txt', 'csv', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext)) return 'Текстовый слой';
  if (toolType === 'image') return 'Растровая/векторная графика';
  if (toolType === 'video') return 'Видео поток';
  if (toolType === 'audio') return 'Аудио поток';
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return 'Архив контейнер';
  return 'Неопределено';
};

const getQualityLabel = (sizeMb) => {
  if (sizeMb >= 40) return 'Очень высокое';
  if (sizeMb >= 10) return 'Высокое';
  if (sizeMb >= 3) return 'Среднее';
  return 'Базовое';
};

const estimateReduction = (toolType, ext) => {
  if (toolType === 'image') return 34;
  if (toolType === 'video') return 45;
  if (toolType === 'audio') return 31;
  if (ext === 'pdf') return 25;
  return 18;
};

const resolveTargetFormat = ({ ext, toolType, intent, learning }) => {
  const remembered = learning.preferredTargets?.[ext];
  if (remembered) return remembered;
  if (intent === 'editing' && ext === 'pdf') return 'docx';
  if (intent === 'send' && toolType === 'image') return 'webp';
  if (intent === 'optimize' && toolType === 'video') return 'mp4';
  if (intent === 'optimize' && toolType === 'audio') return 'mp3';
  if (toolType === 'doc') return 'pdf';
  if (toolType === 'image') return 'jpg';
  if (toolType === 'video') return 'mp4';
  if (toolType === 'audio') return 'mp3';
  return 'pdf';
};

export const createAutomationWorkflow = ({ ext, targetFormat }) => ([
  { id: 'upload', label: 'Upload', state: 'ready' },
  { id: 'convert', label: `Convert to ${String(targetFormat || 'PDF').toUpperCase()}`, state: 'ready' },
  { id: 'compress', label: 'Compress', state: 'ready' },
  { id: 'rename', label: `Rename (*.${toLower(ext) || 'file'})`, state: 'ready' }
]);

export const createIntelligencePlan = ({
  file,
  tool,
  aiMode = 'balanced',
  aiPriority = 'quality',
  resolveToolByFormats
}) => {
  if (!file || !tool) {
    return {
      state: 'idle',
      entry: '',
      context: null,
      intent: null,
      decision: null,
      insights: [],
      actions: [],
      predictiveActions: [],
      workflow: [],
      suggestions: { edit: '', web: '', small: '' },
      explanations: [],
      meta: { insight: '', structure: '', quality: '', sizeReduction: null },
      learningHint: '',
      automationHint: '',
      targetFormat: 'auto'
    };
  }

  const ext = normalizeExt(file.name);
  const sizeMb = Number(file.size || 0) / (1024 * 1024);
  const learning = readAssistantLearningHistory();
  const intentResult = detectIntent({ ext, toolType: tool.type, sizeMb });
  const targetFormat = resolveTargetFormat({
    ext,
    toolType: tool.type,
    intent: intentResult.intent,
    learning
  });
  const matchedTool = resolveToolByFormats(ext, targetFormat);
  const context = {
    file_type: ext || 'unknown',
    file_metadata: {
      name: file.name || 'unknown',
      size_bytes: Number(file.size || 0),
      size_human: formatSizeMb(file.size)
    },
    user_history: learning,
    intent_prediction: intentResult.intent
  };

  const decision = {
    strategy: aiPriority === 'speed'
      ? 'speed_first'
      : (aiPriority === 'size' ? 'size_first' : 'quality_first'),
    mode: aiMode,
    selected_target: targetFormat
  };

  const reduction = estimateReduction(tool.type, ext);
  const structure = getStructure(ext, tool.type);
  const quality = getQualityLabel(sizeMb);

  const actions = [];
  const explanations = [];
  const pushAction = (action) => {
    actions.push(action);
    explanations.push(`${action.title}: ${action.explain}`);
  };

  pushAction({
    id: `convert-${ext}-${targetFormat}`,
    kind: 'convert',
    title: `Конвертировать в ${String(targetFormat).toUpperCase()}`,
    desc: 'Оптимальный целевой формат для текущей задачи.',
    tag: 'recommended',
    toolId: matchedTool?.id || null,
    explain: `Выбрано по intent=${intentResult.intent} и истории пользователя.`
  });

  pushAction({
    id: 'compress',
    kind: 'compress',
    title: 'Сжать с контролем качества',
    desc: 'Баланс размера и читаемости/деталей.',
    tag: 'smallest',
    toolId: null,
    explain: `Оценка оптимизации: до ${reduction}% уменьшения размера.`
  });

  pushAction({
    id: 'optimize',
    kind: 'optimize',
    title: 'Подготовить для web',
    desc: 'Оптимизация под быструю загрузку и стабильную доставку.',
    tag: 'fastest',
    toolId: null,
    explain: 'Рекомендация на основе скорости доставки и совместимости браузеров.'
  });

  pushAction({
    id: 'automation',
    kind: 'automation',
    title: 'Создать automation pipeline',
    desc: 'Сохранить шаги в workflow для повторного запуска.',
    tag: 'recommended',
    toolId: null,
    explain: 'Автоматизация сокращает ручные действия в повторяющихся задачах.'
  });

  const predictiveActions = [
    'После конвертации, вероятно, потребуется отправка файла.',
    'Следующим шагом обычно выбирают публичную ссылку или экспорт в рабочее пространство.'
  ];

  return {
    state: 'ready',
    entry: 'Файл проанализирован. Примените рекомендованный сценарий.',
    context,
    intent: intentResult,
    decision,
    insights: [
      { label: 'Тип', value: ext ? ext.toUpperCase() : 'UNKNOWN' },
      { label: 'Структура', value: structure },
      { label: 'Размер', value: formatSizeMb(file.size) },
      { label: 'Качество', value: quality },
      { label: 'Intent', value: `${intentResult.intent} (${Math.round(intentResult.confidence * 100)}%)` }
    ],
    actions,
    predictiveActions,
    workflow: createAutomationWorkflow({ ext, targetFormat }),
    suggestions: {
      edit: intentResult.intent === 'editing' ? String(targetFormat).toUpperCase() : (tool.type === 'doc' ? 'DOCX' : 'PDF'),
      web: tool.type === 'image' ? 'WEBP' : (tool.type === 'video' ? 'MP4' : 'PDF'),
      small: tool.type === 'audio' ? 'MP3 (128k)' : `${String(targetFormat).toUpperCase()}`
    },
    explanations,
    meta: {
      insight: intentResult.explanation,
      structure,
      quality,
      sizeReduction: reduction
    },
    learningHint: learning.preferredTargets?.[ext]
      ? `Для .${ext} уже учтено ваше предпочтение: ${String(learning.preferredTargets[ext]).toUpperCase()}.`
      : `Для .${ext || 'file'} будет запомнен выбранный целевой формат.`,
    automationHint: 'Можно включить workflow: Upload -> Convert -> Compress -> Rename.',
    targetFormat: targetFormat || 'auto'
  };
};
