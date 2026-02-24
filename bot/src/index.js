const path = require('path');
const express = require('express');
const dotenv = require('dotenv');
const { Telegraf, Markup } = require('telegraf');
const { JsonStore } = require('./store');
const {
  fetchAccountBilling,
  uploadInputViaProxy,
  createConversionJob,
  fetchConversionJob,
  downloadFileBuffer
} = require('./apiClient');
const {
  BUTTON_KEYS,
  LANGUAGE_CHOICES,
  buildKeyboards,
  getButtonLabelMap,
  buildLanguageKeyboard
} = require('./keyboards');
const {
  DEFAULT_LANGUAGE,
  SUPPORTED_LANGUAGES,
  normalizeLanguage,
  t,
  getLanguageLabel
} = require('./i18n');

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const BOT_TOKEN = String(process.env.TELEGRAM_BOT_TOKEN || '').trim();
const SUPPORT_CHAT_ID = Number(process.env.TELEGRAM_SUPPORT_CHAT_ID || 0);
const API_BASE_URL = String(process.env.API_BASE_URL || 'https://megaconvert-api.fly.dev').trim();
const INTERNAL_LINK_SECRET = String(process.env.INTERNAL_LINK_SECRET || '').trim();
const INTERNAL_LINK_PORT = Math.max(1, Number(process.env.INTERNAL_LINK_PORT || 8788));
const LINK_CODE_TTL_SEC = Math.max(60, Number(process.env.LINK_CODE_TTL_SEC || 600));
const BOT_DATA_FILE = String(process.env.BOT_DATA_FILE || './data/bot-store.json').trim();
const NOTIFICATION_POLL_MS = Math.max(5000, Number(process.env.NOTIFICATION_POLL_MS || 15000));
const DAILY_TICK_MS = Math.max(30000, Number(process.env.DAILY_TICK_MS || 60000));
const BOT_CONVERTER_MAX_MB = Math.max(5, Number(process.env.BOT_CONVERTER_MAX_MB || 50));

if (!BOT_TOKEN) throw new Error('Missing TELEGRAM_BOT_TOKEN');

const store = new JsonStore(BOT_DATA_FILE);
const bot = new Telegraf(BOT_TOKEN);
const pendingAdminReplies = new Map();
const timers = [];

let runtimeSupportChatId = Number.isFinite(SUPPORT_CHAT_ID) && SUPPORT_CHAT_ID !== 0
  ? SUPPORT_CHAT_ID
  : Number(store.getMeta('supportChatId', 0) || 0);

const readText = (ctx) => String(ctx.message?.text || '').trim();
const isPrivateChat = (ctx) => ctx.chat?.type === 'private';
const isSupportChat = (ctx) => Number(ctx.chat?.id || 0) === Number(runtimeSupportChatId || 0);
const hasSupportChatConfigured = () => Number(runtimeSupportChatId || 0) !== 0;
const adminReplyMetaKey = (adminId) => `adminReplyTarget:${adminId}`;
const digestEnabledMetaKey = (userId) => `digestEnabled:${userId}`;
const digestHourMetaKey = (userId) => `digestHour:${userId}`;
const digestSentMetaKey = (userId, dateKey) => `digestSent:${userId}:${dateKey}`;
const CONVERTER_POLL_MS = 2500;
const CONVERTER_MAX_POLLS = 140;

const CONVERTER_DEFS = [
  { id: 'jpg-png', key: 'jpgPng', inputExts: ['jpg', 'jpeg'], outputExt: 'png' },
  { id: 'png-jpg', key: 'pngJpg', inputExts: ['png'], outputExt: 'jpg' },
  { id: 'pdf-jpg', key: 'pdfJpg', inputExts: ['pdf'], outputExt: 'jpg' },
  { id: 'jpg-pdf', key: 'jpgPdf', inputExts: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'tif', 'tiff', 'avif', 'heic', 'heif'], outputExt: 'pdf' },
  { id: 'mp4-mp3', key: 'mp4Mp3', inputExts: ['mp4'], outputExt: 'mp3' },
  { id: 'wav-mp3', key: 'wavMp3', inputExts: ['wav'], outputExt: 'mp3' },
  { id: 'mov-mp4', key: 'movMp4', inputExts: ['mov'], outputExt: 'mp4' },
  { id: 'mp4-gif', key: 'mp4Gif', inputExts: ['mp4'], outputExt: 'gif' },
  { id: 'rar-zip', key: 'rarZip', inputExts: ['rar'], outputExt: 'zip' },
  { id: 'jpg-webp', key: 'jpgWebp', inputExts: ['jpg', 'jpeg'], outputExt: 'webp' }
];

const CONVERTER_MAP = new Map(CONVERTER_DEFS.map((item) => [item.id, item]));

const userDisplay = (from) => [from?.first_name, from?.last_name].filter(Boolean).join(' ').trim() || (from?.username ? `@${from.username}` : `id:${from?.id || 'unknown'}`);
const nowDateKey = () => new Date().toISOString().slice(0, 10);
const uiCache = new Map();
const parseSupportedLanguage = (input) => {
  const raw = String(input || '').trim().toLowerCase().replace(/_/g, '-');
  if (!raw) return '';
  if (SUPPORTED_LANGUAGES.includes(raw)) return raw;
  const shortCode = raw.split('-')[0];
  if (SUPPORTED_LANGUAGES.includes(shortCode)) return shortCode;
  return '';
};

const resolveLanguageByUserId = (userId) => {
  const state = store.getUserState(String(userId || ''));
  const stored = String(state.lang || '').trim();
  return stored ? normalizeLanguage(stored) : DEFAULT_LANGUAGE;
};

const setUserLanguage = (userId, language, source = 'manual') => {
  const key = String(userId || '').trim();
  if (!key) return DEFAULT_LANGUAGE;
  const parsed = parseSupportedLanguage(language);
  const code = parsed || DEFAULT_LANGUAGE;
  store.setUserState(key, {
    lang: code,
    langSource: source === 'manual' ? 'manual' : 'auto'
  });
  return code;
};

const detectTelegramLanguage = (ctx) => normalizeLanguage(String(ctx?.from?.language_code || DEFAULT_LANGUAGE));

const resolveUserLanguage = (ctx) => {
  const userId = String(ctx?.from?.id || '').trim();
  if (!userId) return DEFAULT_LANGUAGE;
  const state = store.getUserState(userId);
  const storedRaw = String(state.lang || '').trim();
  const stored = storedRaw ? normalizeLanguage(storedRaw) : '';
  const source = String(state.langSource || 'auto').toLowerCase();
  const detected = detectTelegramLanguage(ctx);

  if (!stored) {
    return setUserLanguage(userId, detected, 'auto');
  }
  if (source !== 'manual' && detected && detected !== stored) {
    return setUserLanguage(userId, detected, 'auto');
  }
  return stored;
};

const getUiForLanguage = (language) => {
  const code = normalizeLanguage(language || DEFAULT_LANGUAGE);
  const cached = uiCache.get(code);
  if (cached) return cached;
  const translate = (key, vars = {}) => t(code, key, vars);
  const keyboards = buildKeyboards(translate);
  const buttonLabels = getButtonLabelMap(translate);
  const reverseButtonLabels = new Map(Object.entries(buttonLabels).map(([buttonKey, label]) => [label, buttonKey]));
  const payload = { code, translate, keyboards, buttonLabels, reverseButtonLabels };
  uiCache.set(code, payload);
  return payload;
};

const getUiForCtx = (ctx) => getUiForLanguage(resolveUserLanguage(ctx));
const tr = (ctx, key, vars = {}) => getUiForCtx(ctx).translate(key, vars);

const resolveMenuAction = (ctx, text) => {
  const raw = String(text || '').trim();
  if (!raw) return '';
  const current = resolveUserLanguage(ctx);
  const candidates = [current, ...SUPPORTED_LANGUAGES.filter((x) => x !== current)];
  for (const code of candidates) {
    const ui = getUiForLanguage(code);
    const action = ui.reverseButtonLabels.get(raw);
    if (action) return action;
  }
  return '';
};

const languageChoiceLabel = (code) => {
  const normalized = normalizeLanguage(code);
  const fromList = LANGUAGE_CHOICES.find((item) => item.code === normalized);
  return fromList?.label || getLanguageLabel(normalized);
};

const mainKeyboard = (ctx) => getUiForCtx(ctx).keyboards.mainKeyboard;
const linkKeyboard = (ctx) => getUiForCtx(ctx).keyboards.linkKeyboard;
const supportKeyboard = (ctx) => getUiForCtx(ctx).keyboards.supportKeyboard;
const helpKeyboard = (ctx) => getUiForCtx(ctx).keyboards.helpKeyboard;
const planKeyboard = (ctx) => getUiForCtx(ctx).keyboards.planKeyboard;
const linkedAccountKeyboard = (ctx) => getUiForCtx(ctx).keyboards.linkedAccountKeyboard;
const controlKeyboard = (ctx) => getUiForCtx(ctx).keyboards.controlKeyboard;
const ticketsKeyboard = (ctx) => getUiForCtx(ctx).keyboards.ticketsKeyboard;
const vaultKeyboard = (ctx) => getUiForCtx(ctx).keyboards.vaultKeyboard;
const automationKeyboard = (ctx) => getUiForCtx(ctx).keyboards.automationKeyboard;
const analyticsKeyboard = (ctx) => getUiForCtx(ctx).keyboards.analyticsKeyboard;
const simulatorKeyboard = (ctx) => getUiForCtx(ctx).keyboards.simulatorKeyboard;
const languageKeyboard = (ctx) => {
  const lang = resolveUserLanguage(ctx);
  const closeLabel = getUiForLanguage(lang).translate('language.closeButton');
  return buildLanguageKeyboard(lang, closeLabel);
};

const safeReply = async (ctx, text, keyboard = mainKeyboard) => {
  const resolvedKeyboard = typeof keyboard === 'function' ? keyboard(ctx) : keyboard;
  return ctx.reply(text, resolvedKeyboard);
};

const waitMs = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const mimeToExt = (mimeType) => {
  const m = String(mimeType || '').toLowerCase().trim();
  if (m.includes('pdf')) return 'pdf';
  if (m.includes('jpeg') || m.includes('jpg')) return 'jpg';
  if (m.includes('png')) return 'png';
  if (m.includes('webp')) return 'webp';
  if (m.includes('gif')) return 'gif';
  if (m.includes('bmp')) return 'bmp';
  if (m.includes('heic') || m.includes('heif')) return 'heic';
  if (m.includes('avif')) return 'avif';
  if (m.includes('mp4')) return 'mp4';
  if (m.includes('quicktime')) return 'mov';
  if (m.includes('mpeg')) return 'mp3';
  if (m.includes('wav')) return 'wav';
  if (m.includes('zip')) return 'zip';
  if (m.includes('rar')) return 'rar';
  return '';
};

const getFileExt = (fileName = '', mimeType = '') => {
  const extFromName = path.extname(String(fileName || '')).replace('.', '').trim().toLowerCase();
  return extFromName || mimeToExt(mimeType);
};

const getConverterLabel = (ctx, converterId) => {
  const converter = CONVERTER_MAP.get(String(converterId || '').trim());
  if (!converter) return String(converterId || 'Converter');
  return tr(ctx, `converter.tools.${converter.key}`);
};

const getConverterInputHint = (ctx, converterId) => {
  const converter = CONVERTER_MAP.get(String(converterId || '').trim());
  if (!converter || !Array.isArray(converter.inputExts) || !converter.inputExts.length) return '-';
  return converter.inputExts.map((ext) => String(ext).toUpperCase()).join(', ');
};

const buildConvertersKeyboard = (ctx, selectedId = '') => {
  const rows = [];
  for (let i = 0; i < CONVERTER_DEFS.length; i += 2) {
    const left = CONVERTER_DEFS[i];
    const right = CONVERTER_DEFS[i + 1];
    const buttons = [];
    const leftLabel = `${selectedId === left.id ? '✅ ' : ''}${tr(ctx, `converter.tools.${left.key}`)}`;
    buttons.push(Markup.button.callback(leftLabel, `conv:set:${left.id}`));
    if (right) {
      const rightLabel = `${selectedId === right.id ? '✅ ' : ''}${tr(ctx, `converter.tools.${right.key}`)}`;
      buttons.push(Markup.button.callback(rightLabel, `conv:set:${right.id}`));
    }
    rows.push(buttons);
  }
  rows.push([Markup.button.callback(tr(ctx, 'converter.closeButton'), 'conv:close')]);
  return Markup.inlineKeyboard(rows);
};

const ensureAccountLinked = async (ctx) => {
  const link = store.getLink(String(ctx?.from?.id || ''));
  if (link) return link;
  await safeReply(ctx, tr(ctx, 'messages.converterNeedLink'), linkKeyboard);
  return null;
};

const pickInputFile = (ctx) => {
  const msg = ctx?.message || {};
  if (msg.document?.file_id) {
    return {
      fileId: String(msg.document.file_id),
      fileName: String(msg.document.file_name || 'input.bin'),
      mimeType: String(msg.document.mime_type || 'application/octet-stream'),
      size: Number(msg.document.file_size || 0)
    };
  }
  if (Array.isArray(msg.photo) && msg.photo.length) {
    const best = msg.photo[msg.photo.length - 1];
    return {
      fileId: String(best.file_id),
      fileName: `photo_${Date.now()}.jpg`,
      mimeType: 'image/jpeg',
      size: Number(best.file_size || 0)
    };
  }
  if (msg.video?.file_id) {
    return {
      fileId: String(msg.video.file_id),
      fileName: String(msg.video.file_name || `video_${Date.now()}.mp4`),
      mimeType: String(msg.video.mime_type || 'video/mp4'),
      size: Number(msg.video.file_size || 0)
    };
  }
  if (msg.audio?.file_id) {
    const fallbackExt = mimeToExt(msg.audio.mime_type) || 'mp3';
    return {
      fileId: String(msg.audio.file_id),
      fileName: String(msg.audio.file_name || `audio_${Date.now()}.${fallbackExt}`),
      mimeType: String(msg.audio.mime_type || 'audio/mpeg'),
      size: Number(msg.audio.file_size || 0)
    };
  }
  if (msg.voice?.file_id) {
    return {
      fileId: String(msg.voice.file_id),
      fileName: `voice_${Date.now()}.ogg`,
      mimeType: 'audio/ogg',
      size: Number(msg.voice.file_size || 0)
    };
  }
  return null;
};

const getApiErrorMessage = (ctx, error) => {
  const msg = String(error?.message || '').trim();
  if (!msg) return tr(ctx, 'messages.converterFailedUnknown');
  return msg;
};

const deriveOutputFileName = (converter, sourceName, downloadUrl, outputMeta) => {
  const metaName = String(outputMeta?.outputName || outputMeta?.name || '').trim();
  if (metaName) return metaName;
  const rawUrl = String(downloadUrl || '').trim();
  if (rawUrl) {
    const withoutQuery = rawUrl.split('?')[0];
    const tail = decodeURIComponent(withoutQuery.split('/').pop() || '').trim();
    if (tail && tail.includes('.')) return tail;
  }
  const base = path.parse(String(sourceName || 'converted').trim() || 'converted').name || 'converted';
  return `${base}.${converter.outputExt || 'bin'}`;
};

const waitForConversionResult = async ({ apiBaseUrl, jobId, onProgress }) => {
  let previousProgress = -1;
  for (let i = 0; i < CONVERTER_MAX_POLLS; i += 1) {
    const status = await fetchConversionJob({ apiBaseUrl, jobId });
    const state = String(status?.status || '').toLowerCase();
    const progress = Number(status?.progress || 0);
    if (Number.isFinite(progress) && progress !== previousProgress) {
      previousProgress = progress;
      if (typeof onProgress === 'function') await onProgress(progress);
    }
    if (state === 'completed') return status;
    if (state === 'failed') {
      const failed = new Error(String(status?.error?.message || 'Conversion failed'));
      failed.status = 422;
      failed.payload = status?.error || null;
      throw failed;
    }
    await waitMs(CONVERTER_POLL_MS);
  }
  throw new Error('Conversion timeout');
};

const getReplyTarget = (adminId) => {
  const key = String(adminId || '');
  const mem = pendingAdminReplies.get(key);
  if (mem?.telegramUserId) return mem;
  const raw = store.getMeta(adminReplyMetaKey(key), null);
  if (!raw || typeof raw !== 'object' || !raw.telegramUserId) return null;
  return { telegramUserId: String(raw.telegramUserId), ticketId: String(raw.ticketId || '') };
};

const setReplyTarget = (adminId, target) => {
  const key = String(adminId || '');
  const payload = { telegramUserId: String(target?.telegramUserId || ''), ticketId: String(target?.ticketId || '') };
  if (!payload.telegramUserId) return;
  pendingAdminReplies.set(key, payload);
  store.setMeta(adminReplyMetaKey(key), payload);
};

const clearReplyTarget = (adminId) => {
  const key = String(adminId || '');
  pendingAdminReplies.delete(key);
  store.setMeta(adminReplyMetaKey(key), null);
};

const queueNotification = (telegramUserId, kind, title, message, meta = {}) => {
  store.queueNotification({ telegramUserId, kind, title, message, meta });
};

const runRules = async (userId, eventType, payload = {}) => {
  const rules = store.listRules(userId).filter((r) => r.enabled !== false);
  for (const rule of rules) {
    const trigger = String(rule.trigger || 'any');
    if (trigger !== 'any'
      && !(trigger === 'on_message' && eventType === 'support_message')
      && !(trigger === 'on_ticket' && eventType === 'ticket_created')
      && !(trigger === 'on_note' && eventType === 'note_created')
      && !(trigger === 'daily_digest' && eventType === 'daily_digest')) continue;
    const c = rule.condition || {};
    if (c.keyword && !String(payload.text || '').toLowerCase().includes(String(c.keyword).toLowerCase())) continue;
    if (c.ticketKind && String(payload.kind || '').toLowerCase() !== String(c.ticketKind).toLowerCase()) continue;
    if (c.counter && Number.isFinite(Number(c.gte))) {
      const summary = store.getActivitySummary(userId);
      if (Number(summary?.counters?.[c.counter] || 0) < Number(c.gte)) continue;
    }
    const lang = resolveLanguageByUserId(userId);
    const msg = String(rule?.action?.template || t(lang, 'messages.ruleTriggeredDefault'));
    queueNotification(userId, 'rule', `${t(lang, 'buttons.AUTOMATION')}: ${rule.name}`, msg, { ruleId: rule.id, eventType });
    store.markRuleFired(userId, rule.id);
  }
};

const trackEvent = async (ctxOrUserId, eventType, payload = {}) => {
  const userId = typeof ctxOrUserId === 'string' ? ctxOrUserId : String(ctxOrUserId?.from?.id || '');
  if (!userId) return;
  const stats = store.logActivity(userId, eventType, payload);
  if (typeof ctxOrUserId === 'object' && Array.isArray(stats?.newBadges)) {
    for (const badge of stats.newBadges) {
      await safeReply(ctxOrUserId, tr(ctxOrUserId, 'messages.achievementUnlocked', { title: badge.title }));
    }
  }
  await runRules(userId, eventType, payload);
};

const formatBenefit = (ctx, benefit) => {
  const k = String(benefit?.kind || '');
  const p = benefit?.payload || {};
  if (k === 'lifetime') return tr(ctx, 'messages.benefitLifetime', { plan: String(p.plan || 'pro') });
  if (k === 'trial') return tr(ctx, 'messages.benefitTrial', { days: Number(p.trial_days || 0) });
  if (k === 'credits') return tr(ctx, 'messages.benefitCredits', { credits: Number(p.credits || 0) });
  return k || tr(ctx, 'messages.benefitDefault');
};

async function showMainMenu(ctx) {
  if (!hasSupportChatConfigured() && isPrivateChat(ctx)) {
    runtimeSupportChatId = Number(ctx.chat?.id || 0);
    if (runtimeSupportChatId) store.setMeta('supportChatId', runtimeSupportChatId);
  }
  store.clearUserState(ctx.from.id);
  await safeReply(ctx, tr(ctx, 'messages.mainMenu'), mainKeyboard);
  await trackEvent(ctx, 'menu_open');
}

async function showHelp(ctx) {
  await safeReply(ctx, tr(ctx, 'messages.help'), helpKeyboard);
}

async function showAccount(ctx) {
  const userId = String(ctx.from.id);
  const link = store.getLink(userId);
  if (!link) {
    await safeReply(ctx, tr(ctx, 'messages.accountNotLinked'), linkKeyboard);
    return;
  }

  let plan = 'Free';
  let status = 'active';
  try {
    const billing = await fetchAccountBilling({ apiBaseUrl: API_BASE_URL, appUserId: link.appUserId, sessionId: `tg-${userId}` });
    plan = String(billing?.plan?.title || 'Free');
    status = String(billing?.plan?.status || 'active');
  } catch (e) {
    if (Number(e?.status || 0) >= 500) {
      await safeReply(ctx, tr(ctx, 'messages.serviceUnavailable'), linkedAccountKeyboard);
      return;
    }
  }

  await safeReply(ctx, tr(ctx, 'messages.account', { email: link.email || '-', plan, status }), linkedAccountKeyboard);
}

async function showPlan(ctx) {
  const userId = String(ctx.from.id);
  const link = store.getLink(userId);
  if (!link) {
    await safeReply(ctx, tr(ctx, 'messages.linkAccountFirst'), linkKeyboard);
    return;
  }

  try {
    const billing = await fetchAccountBilling({ apiBaseUrl: API_BASE_URL, appUserId: link.appUserId, sessionId: `tg-${userId}` });
    const benefits = Array.isArray(billing?.active_benefits) ? billing.active_benefits : [];
    const lines = benefits.length
      ? benefits.slice(0, 6).map((b) => `• ${formatBenefit(ctx, b)}`)
      : [tr(ctx, 'messages.noBenefits')];
    await safeReply(
      ctx,
      [tr(ctx, 'messages.planTitle', { plan: String(billing?.plan?.title || 'Free Plan') }), tr(ctx, 'messages.benefitsTitle'), ...lines].join('\n'),
      planKeyboard
    );
  } catch (e) {
    await safeReply(ctx, tr(ctx, 'messages.planLoadFailed', { error: e?.message || 'error' }), planKeyboard);
  }
}

async function showControlCenter(ctx) {
  const userId = String(ctx.from.id);
  const summary = store.getActivitySummary(userId);
  const game = store.getGamification(userId);
  const open = store.listUserTickets(userId, { status: 'open', limit: 999 }).length;
  const notes = store.listNotes(userId, { limit: 999 }).length;
  await safeReply(
    ctx,
    tr(ctx, 'messages.controlCenter', {
      open,
      notes,
      events7d: summary.last7d,
      level: game.level,
      xp: game.xp
    }),
    controlKeyboard
  );
}

async function showTickets(ctx) {
  await safeReply(ctx, tr(ctx, 'messages.ticketsIntro'), ticketsKeyboard);
}

async function listTickets(ctx) {
  const rows = store.listUserTickets(String(ctx.from.id), { limit: 10 });
  if (!rows.length) {
    await safeReply(ctx, tr(ctx, 'messages.ticketsEmpty'), ticketsKeyboard);
    return;
  }
  await safeReply(ctx, [tr(ctx, 'messages.ticketsHeader'), ...rows.map((t) => `• ${t.id} | ${t.status} | ${t.kind}`)].join('\n'), ticketsKeyboard);
}

async function showVault(ctx) {
  await safeReply(ctx, tr(ctx, 'messages.vaultIntro'), vaultKeyboard);
}

async function listNotes(ctx) {
  const rows = store.listNotes(String(ctx.from.id), { limit: 10 });
  if (!rows.length) {
    await safeReply(ctx, tr(ctx, 'messages.notesEmpty'), vaultKeyboard);
    return;
  }
  await safeReply(ctx, [tr(ctx, 'messages.notesHeader'), ...rows.map((n) => `• ${n.id}: ${n.text}`)].join('\n'), vaultKeyboard);
}

async function showAutomation(ctx) {
  await safeReply(ctx, tr(ctx, 'messages.automationIntro'), automationKeyboard);
}
async function listRules(ctx) {
  const rules = store.listRules(String(ctx.from.id));
  if (!rules.length) {
    await safeReply(ctx, tr(ctx, 'messages.rulesEmpty'), automationKeyboard);
    return;
  }
  await safeReply(
    ctx,
    [
      tr(ctx, 'messages.rulesHeader'),
      ...rules.map((r) => `• ${r.id} | ${r.enabled ? 'ON' : 'OFF'} | ${r.trigger} | ${r.name}`),
      tr(ctx, 'messages.rulesFooter')
    ].join('\n'),
    automationKeyboard
  );
}

async function listWorkflows(ctx) {
  const rows = store.listWorkflows(String(ctx.from.id));
  if (!rows.length) {
    await safeReply(ctx, tr(ctx, 'messages.workflowsEmpty'), automationKeyboard);
    return;
  }
  await safeReply(
    ctx,
    [
      tr(ctx, 'messages.workflowsHeader'),
      ...rows.map((w) => `• ${w.id} | ${w.enabled ? 'ON' : 'OFF'} | ${w.name}`),
      tr(ctx, 'messages.workflowsFooter')
    ].join('\n'),
    automationKeyboard
  );
}

async function showAnalytics(ctx) {
  const s = store.getActivitySummary(String(ctx.from.id));
  const top = Object.entries(s.counters || {}).sort((a, b) => Number(b[1]) - Number(a[1])).slice(0, 8);
  const lines = [
    tr(ctx, 'messages.analyticsTitle'),
    tr(ctx, 'messages.analyticsTotal', { count: s.totalEvents }),
    tr(ctx, 'messages.analytics24h', { count: s.last24h }),
    tr(ctx, 'messages.analytics7d', { count: s.last7d }),
    tr(ctx, 'messages.analyticsTop')
  ];
  for (const [k, v] of top) lines.push(`• ${k}: ${v}`);
  await safeReply(ctx, lines.join('\n'), analyticsKeyboard);
  await trackEvent(ctx, 'analytics_open');
}

async function showAssistant(ctx) {
  const p = store.getAssistantInsights(String(ctx.from.id));
  await safeReply(ctx, [tr(ctx, 'messages.assistantTitle'), ...p.insights.slice(0, 5).map((i) => `• ${i}`)].join('\n'), analyticsKeyboard);
}

async function showProgress(ctx) {
  const g = store.getGamification(String(ctx.from.id));
  const badges = Array.isArray(g.badges) && g.badges.length ? g.badges.map((x) => `• ${x.title}`) : [tr(ctx, 'messages.progressNoBadges')];
  await safeReply(
    ctx,
    [
      tr(ctx, 'messages.progressTitle'),
      tr(ctx, 'messages.progressLevel', { value: g.level }),
      tr(ctx, 'messages.progressXp', { value: g.xp }),
      tr(ctx, 'messages.progressStreak', { value: g.streakDays }),
      tr(ctx, 'messages.progressBadges'),
      ...badges
    ].join('\n'),
    analyticsKeyboard
  );
}

async function showNotifications(ctx) {
  const rows = store.listNotifications(String(ctx.from.id), 10);
  if (!rows.length) {
    await safeReply(ctx, tr(ctx, 'messages.notificationsEmpty'), controlKeyboard);
    return;
  }
  await safeReply(
    ctx,
    [tr(ctx, 'messages.notificationsHeader'), ...rows.map((n) => `• [${n.kind}] ${n.title ? `${n.title}: ` : ''}${n.message}`)].join('\n'),
    controlKeyboard
  );
}

async function showSimulator(ctx) {
  await safeReply(ctx, tr(ctx, 'messages.simulatorIntro'), simulatorKeyboard);
}

async function showConverters(ctx) {
  const linked = await ensureAccountLinked(ctx);
  if (!linked) return;
  await safeReply(
    ctx,
    [tr(ctx, 'converter.title'), tr(ctx, 'converter.choose')].join('\n'),
    buildConvertersKeyboard(ctx)
  );
}

async function setConverterMode(ctx, converterId) {
  const converter = CONVERTER_MAP.get(String(converterId || '').trim());
  if (!converter) {
    await safeReply(ctx, tr(ctx, 'messages.converterUnsupported'), mainKeyboard);
    return;
  }
  const linked = await ensureAccountLinked(ctx);
  if (!linked) return;

  store.setUserState(String(ctx.from.id), {
    mode: 'await_converter_file',
    topic: 'converter',
    draft: { converterId: converter.id }
  });

  await safeReply(
    ctx,
    tr(ctx, 'messages.converterSelectedPrompt', {
      converter: getConverterLabel(ctx, converter.id),
      expected: getConverterInputHint(ctx, converter.id),
      maxMb: BOT_CONVERTER_MAX_MB
    }),
    mainKeyboard
  );
}

async function handleConverterFile(ctx, state) {
  const userId = String(ctx.from.id);
  const converterId = String(state?.draft?.converterId || '').trim();
  const converter = CONVERTER_MAP.get(converterId);
  if (!converter) {
    store.clearUserState(userId);
    await safeReply(ctx, tr(ctx, 'messages.converterUnsupported'), mainKeyboard);
    return;
  }

  const linked = await ensureAccountLinked(ctx);
  if (!linked) return;

  const input = pickInputFile(ctx);
  if (!input) {
    await safeReply(ctx, tr(ctx, 'messages.converterFileExpected'), mainKeyboard);
    return;
  }

  const ext = getFileExt(input.fileName, input.mimeType);
  if (!converter.inputExts.includes(ext)) {
    await safeReply(
      ctx,
      tr(ctx, 'messages.converterWrongFormat', {
        expected: getConverterInputHint(ctx, converter.id),
        got: (ext || '?').toUpperCase()
      }),
      mainKeyboard
    );
    return;
  }

  const maxBytes = BOT_CONVERTER_MAX_MB * 1024 * 1024;
  const inputSize = Number(input.size || 0);
  if (inputSize > maxBytes) {
    await safeReply(ctx, tr(ctx, 'messages.converterTooLarge', { maxMb: BOT_CONVERTER_MAX_MB }), mainKeyboard);
    return;
  }

  const statusMessage = await safeReply(
    ctx,
    tr(ctx, 'messages.converterUploadStart', { converter: getConverterLabel(ctx, converter.id) }),
    mainKeyboard
  );
  const statusMessageId = Number(statusMessage?.message_id || 0);

  const updateStatus = async (text) => {
    if (!statusMessageId) {
      await safeReply(ctx, text, mainKeyboard);
      return;
    }
    try {
      await ctx.telegram.editMessageText(ctx.chat.id, statusMessageId, undefined, text);
    } catch {
      // noop
    }
  };

  try {
    const tgFileUrl = await ctx.telegram.getFileLink(input.fileId);
    const fileResp = await fetch(String(tgFileUrl));
    if (!fileResp.ok) throw new Error(`Telegram file download failed (${fileResp.status})`);
    const inputBuffer = Buffer.from(await fileResp.arrayBuffer());
    if (!inputBuffer.length) throw new Error('Downloaded file is empty');
    if (inputBuffer.length > maxBytes) {
      throw new Error(tr(ctx, 'messages.converterTooLarge', { maxMb: BOT_CONVERTER_MAX_MB }));
    }

    await updateStatus(tr(ctx, 'messages.converterUploading'));
    const uploaded = await uploadInputViaProxy({
      apiBaseUrl: API_BASE_URL,
      fileName: input.fileName,
      contentType: input.mimeType,
      fileBuffer: inputBuffer
    });

    await updateStatus(tr(ctx, 'messages.converterQueued', { converter: getConverterLabel(ctx, converter.id) }));
    const created = await createConversionJob({
      apiBaseUrl: API_BASE_URL,
      tool: converter.id,
      inputKey: uploaded.inputKey,
      originalName: input.fileName,
      inputFormat: ext,
      inputSize: inputBuffer.length,
      settings: {}
    });

    let lastProgressNotice = -1;
    const done = await waitForConversionResult({
      apiBaseUrl: API_BASE_URL,
      jobId: created.jobId,
      onProgress: async (progress) => {
        const rounded = Math.round(Number(progress || 0));
        if (rounded >= 10 && rounded < 100 && (rounded - lastProgressNotice) >= 20) {
          lastProgressNotice = rounded;
          await updateStatus(tr(ctx, 'messages.converterProgress', {
            converter: getConverterLabel(ctx, converter.id),
            progress: Math.max(1, Math.min(99, rounded))
          }));
        }
      }
    });

    const downloadUrl = String(done?.downloadUrl || '').trim();
    if (!downloadUrl) throw new Error('Conversion completed without download url');

    await updateStatus(tr(ctx, 'messages.converterDownloadStart'));
    const outBuffer = await downloadFileBuffer({ apiBaseUrl: API_BASE_URL, downloadUrl });
    const outName = deriveOutputFileName(converter, input.fileName, downloadUrl, done?.outputMeta);

    await ctx.replyWithDocument(
      { source: outBuffer, filename: outName },
      mainKeyboard(ctx)
    );

    store.clearUserState(userId);
    await trackEvent(ctx, 'converter_run', { converterId: converter.id, inputExt: ext });
    await safeReply(ctx, tr(ctx, 'messages.converterDone', { fileName: outName }), mainKeyboard);
  } catch (error) {
    store.clearUserState(userId);
    await safeReply(ctx, tr(ctx, 'messages.converterFailed', { error: getApiErrorMessage(ctx, error) }), mainKeyboard);
  }
}

async function startLinkFlow(ctx) {
  store.setUserState(String(ctx.from.id), { mode: 'await_link_code', topic: '', draft: {} });
  await safeReply(ctx, tr(ctx, 'messages.linkCodePrompt'), linkKeyboard);
}

async function handleLinkCode(ctx) {
  const result = store.claimLinkCodeByTelegram(readText(ctx).replace(/\s+/g, '').toUpperCase(), String(ctx.from.id));
  if (result.ok) {
    store.clearUserState(String(ctx.from.id));
    await safeReply(ctx, tr(ctx, 'messages.accountLinked'), linkedAccountKeyboard);
    return;
  }
  await safeReply(ctx, tr(ctx, 'messages.invalidCode'), linkKeyboard);
}

const enterMode = async (ctx, mode, topic = '') => {
  store.setUserState(String(ctx.from.id), { mode, topic, draft: {} });
};

const parseRule = (text) => {
  const parts = String(text || '').split('|').map((s) => s.trim());
  if (parts.length < 4) return null;
  const trig = String(parts[1] || '').toLowerCase();
  const trigger = ['message', 'msg'].includes(trig) ? 'on_message'
    : ['ticket', 'issue'].includes(trig) ? 'on_ticket'
      : ['note'].includes(trig) ? 'on_note'
        : ['daily', 'digest'].includes(trig) ? 'daily_digest'
          : trig === 'any' ? 'any' : '';
  if (!trigger) return null;
  const condition = {};
  for (const chunk of parts[2].split(',').map((s) => s.trim()).filter(Boolean)) {
    const [k, v] = chunk.split('=').map((s) => s.trim());
    if (!k || !v) continue;
    if (k === 'gte') condition.gte = Number(v);
    else if (k === 'counter') condition.counter = v;
    else if (k === 'keyword') condition.keyword = v;
    else if (k === 'kind') condition.ticketKind = v;
  }
  return { name: parts[0], trigger, condition, action: { type: 'notify', template: parts.slice(3).join(' | ') } };
};

const parseNote = (text) => {
  const tags = [];
  const out = String(text || '')
    .replace(/#([a-zA-Z0-9_-]+)/g, (_, x) => {
      tags.push(String(x || '').toLowerCase());
      return '';
    })
    .replace(/\s+/g, ' ')
    .trim();
  return { text: out || String(text || '').trim(), tags };
};

async function forwardToSupport(ctx, topic) {
  if (!hasSupportChatConfigured()) {
    runtimeSupportChatId = Number(ctx.chat?.id || 0);
    if (runtimeSupportChatId) store.setMeta('supportChatId', runtimeSupportChatId);
  }
  if (!hasSupportChatConfigured()) {
    await safeReply(ctx, tr(ctx, 'messages.serviceUnavailable'));
    return;
  }

  const userId = String(ctx.from.id);
  const text = String(ctx.message?.text || ctx.message?.caption || '').trim() || '[media]';
  const ticketRes = store.createTicket({ telegramUserId: userId, kind: topic, message: text, fromDisplay: userDisplay(ctx.from) });
  const ticket = ticketRes.ok ? ticketRes.ticket : null;

  const header = [
    `📩 Новое обращение (${topic})`,
    `Пользователь: ${userDisplay(ctx.from)} @${ctx.from?.username || '-'}`,
    `Telegram id: ${userId}`,
    `Тикет: ${ticket?.id || '-'}`,
    `#uid:${userId}`,
    ticket?.id ? `#ticket:${ticket.id}` : ''
  ].filter(Boolean).join('\n');

  const buttons = [[Markup.button.callback('Ответить', `reply:${userId}:${ticket?.id || ''}`)]];
  if (ticket?.id) buttons.push([Markup.button.callback('Закрыть тикет', `ticket_close:${ticket.id}`)]);
  await ctx.telegram.sendMessage(runtimeSupportChatId, header, Markup.inlineKeyboard(buttons));

  if (ctx.message?.text) await ctx.telegram.sendMessage(runtimeSupportChatId, `Сообщение:\n${ctx.message.text}`);
  else await ctx.telegram.forwardMessage(runtimeSupportChatId, ctx.chat.id, ctx.message.message_id);

  store.clearUserState(userId);
  await trackEvent(ctx, 'support_message', { topic, text, kind: topic });
  await runRules(userId, 'ticket_created', { kind: topic, text, ticketId: ticket?.id || '' });
  await safeReply(ctx, tr(ctx, 'messages.ticketSent', { ticket: ticket?.id || '-' }), mainKeyboard);
}

async function sendSupportReply(ctx, targetId, replyText, ticketId = '') {
  const userLang = resolveLanguageByUserId(String(targetId));
  const userMainKeyboard = getUiForLanguage(userLang).keyboards.mainKeyboard;
  await ctx.telegram.sendMessage(String(targetId), t(userLang, 'messages.supportReply', { text: replyText }), userMainKeyboard);
  if (ticketId) {
    store.addTicketMessage(ticketId, {
      authorType: 'support',
      authorId: String(ctx.from?.id || ''),
      text: replyText
    });
  }
}

async function handleSupportMessage(ctx) {
  const text = readText(ctx);
  const adminId = String(ctx.from?.id || '');
  if (!adminId) return;

  if (text.toLowerCase() === '/cancelreply') {
    clearReplyTarget(adminId);
    await ctx.reply('Режим ответа выключен.');
    return;
  }

  if (text.toLowerCase() === '/ticketlist') {
    const rows = store.listOpenTickets(15);
    await ctx.reply(rows.length ? ['Открытые тикеты:', ...rows.map((t) => `• ${t.id} | ${t.status} | uid:${t.telegramUserId}`)].join('\n') : 'Открытых тикетов нет.');
    return;
  }

  const closeMatch = text.match(/^\/ticketclose\s+([A-Za-z0-9_-]+)$/i);
  if (closeMatch) {
    const ticket = store.getTicket(closeMatch[1]);
    if (!ticket) {
      await ctx.reply('Тикет не найден.');
      return;
    }
    store.setTicketStatus(ticket.id, 'closed', adminId);
    const ticketLang = resolveLanguageByUserId(String(ticket.telegramUserId));
    queueNotification(
      String(ticket.telegramUserId),
      'ticket',
      t(ticketLang, 'buttons.CLOSE_TICKET'),
      t(ticketLang, 'messages.ticketClosedBySupport', { ticket: ticket.id })
    );
    await ctx.reply(`Тикет ${ticket.id} закрыт.`);
    return;
  }
  const ticketReply = text.match(/^\/ticketreply\s+([A-Za-z0-9_-]+)\s+([\s\S]+)$/i);
  if (ticketReply) {
    const ticket = store.getTicket(ticketReply[1]);
    if (!ticket) {
      await ctx.reply('Тикет не найден.');
      return;
    }
    await sendSupportReply(ctx, ticket.telegramUserId, ticketReply[2], ticket.id);
    await ctx.reply(`Ответ отправлен по тикету ${ticket.id}.`);
    return;
  }

  const cmdReply = text.match(/^\/reply\s+(\d+)(?:\s+([\s\S]+))?$/i);
  if (cmdReply) {
    if (!cmdReply[2]) {
      setReplyTarget(adminId, { telegramUserId: cmdReply[1], ticketId: '' });
      await ctx.reply(`Режим ответа активирован для ${cmdReply[1]}.\nОтмена: /cancelreply`);
      return;
    }
    await sendSupportReply(ctx, cmdReply[1], cmdReply[2], '');
    await ctx.reply(`Ответ отправлен пользователю ${cmdReply[1]}.`);
    return;
  }

  const source = String(ctx.message?.reply_to_message?.text || ctx.message?.reply_to_message?.caption || '');
  const fromReply = {
    telegramUserId: (source.match(/#uid:(\d+)/i) || [])[1] || '',
    ticketId: (source.match(/#ticket:([A-Za-z0-9_-]+)/i) || [])[1] || ''
  };
  const fromPending = getReplyTarget(adminId);
  const target = {
    telegramUserId: fromReply.telegramUserId || fromPending?.telegramUserId || '',
    ticketId: fromReply.ticketId || fromPending?.ticketId || ''
  };

  if (!target.telegramUserId) return;

  if (ctx.message?.text) {
    await sendSupportReply(ctx, target.telegramUserId, ctx.message.text, target.ticketId);
  } else {
    const userLang = resolveLanguageByUserId(String(target.telegramUserId));
    const userMainKeyboard = getUiForLanguage(userLang).keyboards.mainKeyboard;
    await ctx.telegram.sendMessage(target.telegramUserId, t(userLang, 'messages.supportReplyCaption'), userMainKeyboard);
    await ctx.telegram.copyMessage(target.telegramUserId, ctx.chat.id, ctx.message.message_id);
    if (target.ticketId) {
      store.addTicketMessage(target.ticketId, {
        authorType: 'support',
        authorId: adminId,
        text: '[media]'
      });
    }
  }

  if (fromPending?.telegramUserId) clearReplyTarget(adminId);
  await ctx.reply(`Ответ отправлен пользователю ${target.telegramUserId}.`);
}

async function runUserCommand(ctx, text) {
  const userId = String(ctx.from.id);
  const languageCmd = text.match(/^\/language(?:\s+([a-zA-Z_-]{2,12}))?$/i);
  if (languageCmd) {
    const arg = String(languageCmd[1] || '').trim();
    if (arg) {
      const parsed = parseSupportedLanguage(arg);
      if (!parsed) {
        await safeReply(ctx, tr(ctx, 'messages.unsupportedLanguageCode'), languageKeyboard(ctx));
        return true;
      }
      const selected = setUserLanguage(userId, parsed, 'manual');
      const label = languageChoiceLabel(selected);
      await safeReply(ctx, tr(ctx, 'language.updated', { language: label }), mainKeyboard);
      return true;
    }
    await safeReply(
      ctx,
      [
        tr(ctx, 'language.chooseTitle'),
        tr(ctx, 'language.current', { language: languageChoiceLabel(resolveUserLanguage(ctx)) }),
        tr(ctx, 'language.chooseHint')
      ].join('\n'),
      languageKeyboard(ctx)
    );
    return true;
  }

  const delRule = text.match(/^\/delrule\s+([A-Za-z0-9_-]+)$/i);
  if (delRule) {
    await safeReply(
      ctx,
      store.deleteRule(userId, delRule[1]) ? tr(ctx, 'messages.ruleDeleted') : tr(ctx, 'messages.ruleNotFound'),
      automationKeyboard
    );
    return true;
  }

  const toggleRule = text.match(/^\/togglerule\s+([A-Za-z0-9_-]+)\s+(on|off)$/i);
  if (toggleRule) {
    await safeReply(
      ctx,
      store.toggleRule(userId, toggleRule[1], toggleRule[2] === 'on') ? tr(ctx, 'messages.ruleStatusUpdated') : tr(ctx, 'messages.ruleNotFound'),
      automationKeyboard
    );
    return true;
  }

  const runWf = text.match(/^\/runwf\s+([A-Za-z0-9_-]+)$/i);
  if (runWf) {
    const wf = store.listWorkflows(userId).find((x) => x.id === runWf[1] && x.enabled !== false);
    if (!wf) {
      await safeReply(ctx, tr(ctx, 'messages.workflowNotFound'), automationKeyboard);
      return true;
    }
    for (const step of wf.steps || []) {
      if (String(step.type) === 'notify') {
        queueNotification(userId, 'workflow', `Workflow: ${wf.name}`, String(step.template || tr(ctx, 'messages.workflowStepDone')));
      }
    }
    store.markWorkflowRun(userId, wf.id);
    await safeReply(ctx, tr(ctx, 'messages.workflowStarted', { workflow: wf.id }), automationKeyboard);
    return true;
  }

  const delWf = text.match(/^\/delwf\s+([A-Za-z0-9_-]+)$/i);
  if (delWf) {
    await safeReply(
      ctx,
      store.deleteWorkflow(userId, delWf[1]) ? tr(ctx, 'messages.workflowDeleted') : tr(ctx, 'messages.workflowNotFound'),
      automationKeyboard
    );
    return true;
  }

  return false;
}

async function handleMenu(ctx, text) {
  const action = resolveMenuAction(ctx, text);
  switch (action) {
    case BUTTON_KEYS.BACK:
      await showMainMenu(ctx);
      return true;
    case BUTTON_KEYS.HELP:
      await showHelp(ctx);
      return true;
    case BUTTON_KEYS.ACCOUNT:
      await showAccount(ctx);
      return true;
    case BUTTON_KEYS.PLAN:
      await showPlan(ctx);
      return true;
    case BUTTON_KEYS.CONVERTERS:
      await showConverters(ctx);
      return true;
    case BUTTON_KEYS.SUPPORT:
      await safeReply(ctx, tr(ctx, 'messages.supportPrompt'), supportKeyboard);
      return true;
    case BUTTON_KEYS.MESSAGE:
      await enterMode(ctx, 'await_message', 'support');
      await safeReply(ctx, tr(ctx, 'messages.messagePrompt'), supportKeyboard);
      return true;
    case BUTTON_KEYS.ISSUE:
      await enterMode(ctx, 'await_message', 'issue');
      await safeReply(ctx, tr(ctx, 'messages.issuePrompt'), supportKeyboard);
      return true;
    case BUTTON_KEYS.LINK:
      await startLinkFlow(ctx);
      return true;
    case BUTTON_KEYS.UNLINK:
      store.unlink(String(ctx.from.id));
      await safeReply(ctx, tr(ctx, 'messages.accountUnlinked'), mainKeyboard);
      return true;
    case BUTTON_KEYS.CONTROL:
    case BUTTON_KEYS.DASHBOARD:
      await showControlCenter(ctx);
      return true;
    case BUTTON_KEYS.TICKETS:
      await showTickets(ctx);
      return true;
    case BUTTON_KEYS.NEW_TICKET:
      await enterMode(ctx, 'await_ticket_message', 'support');
      await safeReply(ctx, tr(ctx, 'messages.newTicketPrompt'), ticketsKeyboard);
      return true;
    case BUTTON_KEYS.MY_TICKETS:
      await listTickets(ctx);
      return true;
    case BUTTON_KEYS.CLOSE_TICKET:
      await enterMode(ctx, 'await_ticket_close_id');
      await safeReply(ctx, tr(ctx, 'messages.ticketClosePrompt'), ticketsKeyboard);
      return true;
    case BUTTON_KEYS.VAULT:
      await showVault(ctx);
      return true;
    case BUTTON_KEYS.ADD_NOTE:
      await enterMode(ctx, 'await_note_create');
      await safeReply(ctx, tr(ctx, 'messages.noteCreatePrompt'), vaultKeyboard);
      return true;
    case BUTTON_KEYS.LIST_NOTES:
      await listNotes(ctx);
      return true;
    case BUTTON_KEYS.SEARCH_NOTES:
      await enterMode(ctx, 'await_note_search');
      await safeReply(ctx, tr(ctx, 'messages.noteSearchPrompt'), vaultKeyboard);
      return true;
    case BUTTON_KEYS.DELETE_NOTE:
      await enterMode(ctx, 'await_note_delete_id');
      await safeReply(ctx, tr(ctx, 'messages.noteDeletePrompt'), vaultKeyboard);
      return true;
    case BUTTON_KEYS.AUTOMATION:
      await showAutomation(ctx);
      return true;
    case BUTTON_KEYS.ADD_RULE:
      await enterMode(ctx, 'await_rule_create');
      await safeReply(ctx, tr(ctx, 'messages.ruleCreatePrompt'), automationKeyboard);
      return true;
    case BUTTON_KEYS.LIST_RULES:
      await listRules(ctx);
      return true;
    case BUTTON_KEYS.ADD_WORKFLOW:
      await enterMode(ctx, 'await_workflow_create');
      await safeReply(ctx, tr(ctx, 'messages.workflowCreatePrompt'), automationKeyboard);
      return true;
    case BUTTON_KEYS.LIST_WORKFLOWS:
      await listWorkflows(ctx);
      return true;
    case BUTTON_KEYS.ENABLE_DIGEST:
      store.setMeta(digestEnabledMetaKey(String(ctx.from.id)), true);
      await safeReply(ctx, tr(ctx, 'messages.digestEnabled'), automationKeyboard);
      return true;
    case BUTTON_KEYS.DISABLE_DIGEST:
      store.setMeta(digestEnabledMetaKey(String(ctx.from.id)), false);
      await safeReply(ctx, tr(ctx, 'messages.digestDisabled'), automationKeyboard);
      return true;
    case BUTTON_KEYS.ANALYTICS:
      await showAnalytics(ctx);
      return true;
    case BUTTON_KEYS.ASSISTANT:
      await showAssistant(ctx);
      return true;
    case BUTTON_KEYS.GAMIFICATION:
      await showProgress(ctx);
      return true;
    case BUTTON_KEYS.SHOW_NOTIFICATIONS:
      await showNotifications(ctx);
      return true;
    case BUTTON_KEYS.SIMULATOR:
      await showSimulator(ctx);
      return true;
    case BUTTON_KEYS.RUN_SIMULATOR:
      await enterMode(ctx, 'await_simulator_input');
      await safeReply(ctx, tr(ctx, 'messages.simulatorInputPrompt'), simulatorKeyboard);
      return true;
    case BUTTON_KEYS.LANGUAGE:
      await safeReply(
        ctx,
        [
          tr(ctx, 'language.chooseTitle'),
          tr(ctx, 'language.current', { language: languageChoiceLabel(resolveUserLanguage(ctx)) }),
          tr(ctx, 'language.chooseHint')
        ].join('\n'),
        languageKeyboard(ctx)
      );
      return true;
    default:
      return false;
  }
}

bot.catch((error, ctx) => {
  console.error('[bot_error]', {
    chatId: ctx?.chat?.id || null,
    userId: ctx?.from?.id || null,
    error: error?.message || String(error)
  });
});

bot.start(async (ctx) => {
  if (!isPrivateChat(ctx)) return;
  const userId = String(ctx.from?.id || '');
  const state = store.getUserState(userId);
  const hasLanguage = Boolean(String(state.lang || '').trim());
  const selected = resolveUserLanguage(ctx);
  if (!hasLanguage) {
    await safeReply(
      ctx,
      [
        tr(ctx, 'language.chooseTitle'),
        tr(ctx, 'language.current', { language: languageChoiceLabel(selected) }),
        tr(ctx, 'language.chooseHint')
      ].join('\n'),
      languageKeyboard(ctx)
    );
  }
  await showMainMenu(ctx);
});

bot.command('menu', async (ctx) => {
  if (isPrivateChat(ctx)) await showMainMenu(ctx);
});

bot.command('help', async (ctx) => {
  if (isPrivateChat(ctx)) await showHelp(ctx);
});

bot.command('language', async (ctx) => {
  if (!isPrivateChat(ctx)) return;
  await safeReply(
    ctx,
    [
      tr(ctx, 'language.chooseTitle'),
      tr(ctx, 'language.current', { language: languageChoiceLabel(resolveUserLanguage(ctx)) }),
      tr(ctx, 'language.chooseHint')
    ].join('\n'),
    languageKeyboard(ctx)
  );
});

bot.action(/^lang:set:([a-z]{2,3})$/i, async (ctx) => {
  const code = String(ctx.match?.[1] || '').trim();
  const userId = String(ctx.from?.id || '').trim();
  if (!userId) {
    await ctx.answerCbQuery('User not found', { show_alert: true });
    return;
  }
  const parsed = parseSupportedLanguage(code);
  if (!parsed) {
    await ctx.answerCbQuery('Unsupported language', { show_alert: true });
    return;
  }
  const selected = setUserLanguage(userId, parsed, 'manual');
  const label = languageChoiceLabel(selected);
  await ctx.answerCbQuery(label);
  await ctx.editMessageText(
    [t(selected, 'language.chooseTitle'), t(selected, 'language.updated', { language: label }), t(selected, 'language.chooseHint')].join('\n'),
    buildLanguageKeyboard(selected, t(selected, 'language.closeButton'))
  );
});

bot.action('lang:close', async (ctx) => {
  try {
    await ctx.deleteMessage();
  } catch {
    // noop
  }
  await ctx.answerCbQuery();
});

bot.action(/^conv:set:([a-z0-9-]+)$/i, async (ctx) => {
  if (!isPrivateChat(ctx)) {
    await ctx.answerCbQuery('Private chat only', { show_alert: true });
    return;
  }
  const converterId = String(ctx.match?.[1] || '').trim();
  if (!CONVERTER_MAP.has(converterId)) {
    await ctx.answerCbQuery(tr(ctx, 'messages.converterUnsupported'), { show_alert: true });
    return;
  }

  await ctx.answerCbQuery(getConverterLabel(ctx, converterId));
  try {
    await ctx.editMessageText(
      [tr(ctx, 'converter.title'), tr(ctx, 'converter.choose')].join('\n'),
      buildConvertersKeyboard(ctx, converterId)
    );
  } catch {
    // noop
  }
  await setConverterMode(ctx, converterId);
});

bot.action('conv:close', async (ctx) => {
  try {
    await ctx.deleteMessage();
  } catch {
    // noop
  }
  await ctx.answerCbQuery();
});

bot.action(/^reply:(\d+)(?::([A-Za-z0-9_-]*))?$/, async (ctx) => {
  if (!isSupportChat(ctx)) {
    await ctx.answerCbQuery('Только в чате поддержки.', { show_alert: true });
    return;
  }
  const target = String(ctx.match?.[1] || '');
  const ticketId = String(ctx.match?.[2] || '');
  if (!target) {
    await ctx.answerCbQuery('Пользователь не найден');
    return;
  }
  setReplyTarget(String(ctx.from.id), { telegramUserId: target, ticketId });
  await ctx.answerCbQuery(`Режим ответа: ${target}`);
  await ctx.reply(`Режим ответа активирован для ${target}.\nТикет: ${ticketId || '-'}\nОтмена: /cancelreply`);
});

bot.action(/^ticket_close:([A-Za-z0-9_-]+)$/, async (ctx) => {
  if (!isSupportChat(ctx)) {
    await ctx.answerCbQuery('Только в чате поддержки.', { show_alert: true });
    return;
  }
  const ticket = store.getTicket(String(ctx.match?.[1] || ''));
  if (!ticket) {
    await ctx.answerCbQuery('Тикет не найден', { show_alert: true });
    return;
  }
  store.setTicketStatus(ticket.id, 'closed', String(ctx.from?.id || ''));
  const ticketLang = resolveLanguageByUserId(String(ticket.telegramUserId));
  queueNotification(
    String(ticket.telegramUserId),
    'ticket',
    t(ticketLang, 'buttons.CLOSE_TICKET'),
    t(ticketLang, 'messages.ticketClosedBySupport', { ticket: ticket.id })
  );
  await ctx.answerCbQuery(`Тикет ${ticket.id} закрыт`);
});
bot.on('message', async (ctx) => {
  const adminId = String(ctx.from?.id || '');
  if ((adminId && getReplyTarget(adminId)) || isSupportChat(ctx)) {
    const text = readText(ctx);
    if (!isPrivateChat(ctx) || text.startsWith('/reply ') || text.startsWith('/ticket') || text.toLowerCase() === '/cancelreply' || ctx.message?.reply_to_message || getReplyTarget(adminId)) {
      await handleSupportMessage(ctx);
      return;
    }
  }

  if (!isPrivateChat(ctx)) return;

  const text = readText(ctx);
  if (text.startsWith('/')) {
    const handled = await runUserCommand(ctx, text);
    if (handled) return;
    return;
  }

  const menuHandled = await handleMenu(ctx, text);
  if (menuHandled) return;

  const state = store.getUserState(String(ctx.from.id));

  if (state.mode === 'await_link_code') {
    await handleLinkCode(ctx);
    return;
  }

  if (state.mode === 'await_message' || state.mode === 'await_ticket_message') {
    await forwardToSupport(ctx, state.topic || 'support');
    return;
  }

  if (state.mode === 'await_converter_file') {
    await handleConverterFile(ctx, state);
    return;
  }

  if (state.mode === 'await_ticket_close_id') {
    const ticket = store.getTicket(text);
    if (!ticket || String(ticket.telegramUserId) !== String(ctx.from.id)) {
      await safeReply(ctx, tr(ctx, 'messages.ticketNotFound'), ticketsKeyboard);
      return;
    }
    store.setTicketStatus(ticket.id, 'closed', String(ctx.from.id));
    store.clearUserState(String(ctx.from.id));
    await safeReply(ctx, tr(ctx, 'messages.ticketClosed', { ticket: ticket.id }), ticketsKeyboard);
    return;
  }

  if (state.mode === 'await_note_create') {
    const note = parseNote(text);
    const result = store.addNote(String(ctx.from.id), note);
    if (!result.ok) {
      await safeReply(ctx, tr(ctx, 'messages.noteSaveFailed'), vaultKeyboard);
      return;
    }
    store.clearUserState(String(ctx.from.id));
    await trackEvent(ctx, 'note_created', { text: note.text });
    await safeReply(ctx, tr(ctx, 'messages.noteSaved', { note: result.note.id }), vaultKeyboard);
    return;
  }

  if (state.mode === 'await_note_search') {
    const notes = store.listNotes(String(ctx.from.id), { query: text, limit: 10 });
    store.clearUserState(String(ctx.from.id));
    await safeReply(
      ctx,
      notes.length ? [tr(ctx, 'messages.searchResults'), ...notes.map((n) => `• ${n.id}: ${n.text}`)].join('\n') : tr(ctx, 'messages.nothingFound'),
      vaultKeyboard
    );
    return;
  }

  if (state.mode === 'await_note_delete_id') {
    const ok = store.deleteNote(String(ctx.from.id), text);
    store.clearUserState(String(ctx.from.id));
    await safeReply(ctx, ok ? tr(ctx, 'messages.noteDeleted') : tr(ctx, 'messages.noteMissing'), vaultKeyboard);
    return;
  }

  if (state.mode === 'await_rule_create') {
    const rule = parseRule(text);
    if (!rule) {
      await safeReply(ctx, tr(ctx, 'messages.invalidRuleFormat'), automationKeyboard);
      return;
    }
    const created = store.addRule(String(ctx.from.id), rule);
    store.clearUserState(String(ctx.from.id));
    await trackEvent(ctx, 'rule_created', { ruleId: created.id });
    await safeReply(ctx, tr(ctx, 'messages.ruleCreated', { rule: created.id }), automationKeyboard);
    return;
  }

  if (state.mode === 'await_workflow_create') {
    const name = String(text || '').trim().toLowerCase();
    const wf = name === 'trial_guard'
      ? { name: 'Trial Guard', steps: [{ type: 'notify', template: 'Проверьте trial и промокоды.' }] }
      : name === 'support_digest'
        ? { name: 'Support Digest', steps: [{ type: 'notify', template: 'Проверьте открытые тикеты за 24ч.' }] }
        : name === 'vault_guard'
          ? { name: 'Vault Guard', steps: [{ type: 'notify', template: 'Проверьте заметки Data Vault.' }] }
          : null;
    if (!wf) {
      await safeReply(ctx, tr(ctx, 'messages.unknownTemplate'), automationKeyboard);
      return;
    }
    const created = store.addWorkflow(String(ctx.from.id), wf);
    store.clearUserState(String(ctx.from.id));
    await trackEvent(ctx, 'workflow_created', { workflowId: created.id });
    await safeReply(ctx, tr(ctx, 'messages.workflowCreated', { workflow: created.id }), automationKeyboard);
    return;
  }

  if (state.mode === 'await_simulator_input') {
    const p = { users: 100, conversion: 3.5, arpu: 19, retention: 55 };
    for (const chunk of String(text).split(/[;,]/).map((s) => s.trim()).filter(Boolean)) {
      const [k, v] = chunk.split('=').map((s) => s.trim());
      const n = Number(String(v || '').replace(',', '.'));
      if (!k || !Number.isFinite(n)) continue;
      if (k === 'users') p.users = Math.max(1, Math.round(n));
      if (k === 'conversion') p.conversion = Math.max(0, n);
      if (k === 'arpu') p.arpu = Math.max(0, n);
      if (k === 'retention') p.retention = Math.max(0, Math.min(100, n));
    }
    const conv = Math.round((p.users * p.conversion) / 100);
    const retained = Math.round((conv * p.retention) / 100);
    const mrr = retained * p.arpu;
    store.clearUserState(String(ctx.from.id));
    await trackEvent(ctx, 'simulator_run', p);
    await safeReply(ctx, tr(ctx, 'messages.simulationResult', { activations: conv, retained, mrr }), simulatorKeyboard);
    return;
  }

  await safeReply(ctx, tr(ctx, 'messages.unknownMessage'), mainKeyboard);
});

const internalApi = express();
internalApi.use(express.json({ limit: '256kb' }));

internalApi.get('/health', (req, res) => {
  res.json({ ok: true, now: new Date().toISOString() });
});

internalApi.post('/internal/link/code/register', (req, res) => {
  if (!INTERNAL_LINK_SECRET) {
    return res.status(503).json({ ok: false, code: 'LINK_SECRET_NOT_CONFIGURED' });
  }
  const secret = String(req.headers['x-link-secret'] || '').trim();
  if (!secret || secret !== INTERNAL_LINK_SECRET) {
    return res.status(401).json({ ok: false, code: 'UNAUTHORIZED' });
  }

  const body = req.body || {};
  const registered = store.registerExternalLinkCode({
    code: body.code,
    appUserId: body.app_user_id || body.appUserId,
    email: body.email,
    ttlSec: body.ttl_sec || LINK_CODE_TTL_SEC
  });
  if (!registered.ok) {
    return res.status(400).json(registered);
  }
  return res.json({ ok: true, code: registered.code, expires_at: registered.expiresAt });
});

internalApi.post('/internal/link/complete', async (req, res) => {
  if (!INTERNAL_LINK_SECRET) {
    return res.status(503).json({ ok: false, code: 'LINK_SECRET_NOT_CONFIGURED' });
  }
  const secret = String(req.headers['x-link-secret'] || '').trim();
  if (!secret || secret !== INTERNAL_LINK_SECRET) {
    return res.status(401).json({ ok: false, code: 'UNAUTHORIZED' });
  }

  const body = req.body || {};
  const result = store.consumeLinkCode(body.code, {
    appUserId: body.app_user_id || body.appUserId,
    email: body.email
  });
  if (!result.ok) {
    return res.status(400).json(result);
  }

  try {
    const userLang = resolveLanguageByUserId(String(result.telegramUserId));
    const userKeyboard = getUiForLanguage(userLang).keyboards.linkedAccountKeyboard;
    await bot.telegram.sendMessage(result.telegramUserId, t(userLang, 'messages.linkNotifySuccess'), userKeyboard);
  } catch (error) {
    console.error('[link_notify_failed]', error?.message || String(error));
  }

  return res.json({ ok: true, telegram_user_id: result.telegramUserId, linked_at: result.link.linkedAt });
});

const processNotifications = async () => {
  const due = store.popDueNotifications({ now: Date.now(), limit: 25 });
  for (const row of due) {
    try {
      const prefix = row.kind === 'ticket' ? '🎫' : row.kind === 'rule' ? '🤖' : row.kind === 'workflow' ? '🔁' : '🔔';
      const title = row.title ? `${row.title}\n` : '';
      const userMainKeyboard = getUiForLanguage(resolveLanguageByUserId(String(row.telegramUserId))).keyboards.mainKeyboard;
      await bot.telegram.sendMessage(String(row.telegramUserId), `${prefix} ${title}${row.message}`, userMainKeyboard);
    } catch (error) {
      console.error('[notification_send_failed]', error?.message || String(error));
    }
  }
};

const processDailyTick = async () => {
  const now = new Date();
  const hour = now.getHours();
  const minute = now.getMinutes();
  const dateKey = nowDateKey();

  for (const userId of store.listKnownUserIds()) {
    if (!Boolean(store.getMeta(digestEnabledMetaKey(userId), false))) continue;
    const digestHour = Number(store.getMeta(digestHourMetaKey(userId), 9) || 9);
    if (hour !== digestHour || minute > 5) continue;
    const marker = digestSentMetaKey(userId, dateKey);
    if (Boolean(store.getMeta(marker, false))) continue;

    const summary = store.getActivitySummary(userId);
    const open = store.listUserTickets(userId, { status: 'open', limit: 999 }).length;
    const lang = resolveLanguageByUserId(userId);
    queueNotification(
      userId,
      'daily',
      t(lang, 'messages.dailyDigestTitle'),
      t(lang, 'messages.dailyDigestBody', { last24h: summary.last24h, last7d: summary.last7d, open })
    );
    store.setMeta(marker, true);
    await runRules(userId, 'daily_digest', { summary, openTickets: open });
  }
};

const server = internalApi.listen(INTERNAL_LINK_PORT, () => {
  console.log(`[internal_api] listening on :${INTERNAL_LINK_PORT}`);
});

timers.push(setInterval(() => {
  processNotifications().catch((error) => {
    console.error('[notification_worker_error]', error?.message || String(error));
  });
}, NOTIFICATION_POLL_MS));

timers.push(setInterval(() => {
  processDailyTick().catch((error) => {
    console.error('[daily_tick_error]', error?.message || String(error));
  });
}, DAILY_TICK_MS));

bot.launch().then(() => {
  console.log('[telegram_bot] started');
  console.log(`[telegram_bot] support_chat_id=${runtimeSupportChatId || 'auto (first private /start)'}`);
});

const shutdown = (signal) => {
  console.log(`[shutdown] signal=${signal}`);
  for (const timer of timers) clearInterval(timer);
  try {
    bot.stop(signal);
  } catch {
    // noop
  }
  server.close(() => process.exit(0));
};

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));
