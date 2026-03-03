const path = require('path');
const express = require('express');
const dotenv = require('dotenv');
const { Telegraf, Markup } = require('telegraf');
const { JsonStore } = require('./store');
const {
  fetchAccountBilling,
  redeemPromoCode,
  uploadInputViaProxy,
  createConversionJob,
  fetchConversionJob,
  downloadFileBuffer
} = require('./apiClient');
const { TOOL_DEFS } = require('./utils/tools');
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
const API_BASE_URL = String(process.env.API_BASE_URL || 'http://localhost:3000').trim();
const INTERNAL_LINK_SECRET = String(process.env.INTERNAL_LINK_SECRET || '').trim();
const INTERNAL_LINK_PORT = Math.max(1, Number(process.env.INTERNAL_LINK_PORT || 8788));
const LINK_CODE_TTL_SEC = Math.max(60, Number(process.env.LINK_CODE_TTL_SEC || 600));
const BOT_DATA_FILE = String(process.env.BOT_DATA_FILE || './data/bot-store.json').trim();
const NOTIFICATION_POLL_MS = Math.max(5000, Number(process.env.NOTIFICATION_POLL_MS || 15000));
const BOT_CONVERTER_MAX_MB = Math.max(5, Number(process.env.BOT_CONVERTER_MAX_MB || 50));
const GROQ_API_KEY = String(process.env.GROQ_API_KEY || '').trim();
const GROQ_MODEL = String(process.env.GROQ_MODEL || 'llama-3.1-8b-instant').trim();
const AI_COOLDOWN_SEC = Math.max(1, Number(process.env.AI_COOLDOWN_SEC || 8));
const AI_MAX_INPUT_CHARS = Math.max(200, Number(process.env.AI_MAX_INPUT_CHARS || 2000));
const AI_TIMEOUT_MS = 30000;
const ADMIN_IDS = String(process.env.ADMIN_IDS || '')
  .split(',')
  .map((x) => String(x || '').trim())
  .filter(Boolean);

if (!BOT_TOKEN) throw new Error('Missing TELEGRAM_BOT_TOKEN');

const store = new JsonStore(BOT_DATA_FILE);
const bot = new Telegraf(BOT_TOKEN);
const pendingAdminReplies = new Map();
const timers = [];

let runtimeSupportChatId = Number.isFinite(SUPPORT_CHAT_ID) && SUPPORT_CHAT_ID !== 0
  ? SUPPORT_CHAT_ID
  : Number(store.getMeta('supportChatId', 0) || 0);

const readText = (ctx) => String(ctx.message?.text || '').trim();
const readCaption = (ctx) => String(ctx.message?.caption || '').trim();
const isPrivateChat = (ctx) => ctx.chat?.type === 'private';
const isSupportChat = (ctx) => Number(ctx.chat?.id || 0) === Number(runtimeSupportChatId || 0);
const hasSupportChatConfigured = () => Number(runtimeSupportChatId || 0) !== 0;
const adminReplyMetaKey = (adminId) => `adminReplyTarget:${adminId}`;
const recentConvertersMetaKey = (userId) => `recentConverters:${userId}`;
const favoriteConvertersMetaKey = (userId) => `favoriteConverters:${userId}`;
const referredByMetaKey = (userId) => `referredBy:${userId}`;
const referralCountMetaKey = (userId) => `referralCount:${userId}`;
const CONVERTER_POLL_MS = 2500;
const CONVERTER_MAX_POLLS = 140;
const CONVERTERS_PER_PAGE = 12;
const aiCooldownUntil = new Map();
const aiHistoryMetaKey = (userId) => `aiHistory:${userId}`;

const CONVERTER_DEFS = (Array.isArray(TOOL_DEFS) ? TOOL_DEFS : [])
  .map((item) => ({
    id: String(item?.id || '').trim().toLowerCase(),
    from: String(item?.from || '').trim().toUpperCase(),
    to: String(item?.to || '').trim().toUpperCase(),
    inputExts: Array.isArray(item?.inputExts)
      ? Array.from(new Set(item.inputExts.map((ext) => String(ext || '').trim().toLowerCase()).filter(Boolean)))
      : [],
    outputExt: String(item?.outputExt || '').trim().toLowerCase()
  }))
  .filter((item) => item.id && item.from && item.to && item.inputExts.length && item.outputExt);

const CONVERTER_MAP = new Map(CONVERTER_DEFS.map((item) => [item.id, item]));
const todayKey = () => new Date().toISOString().slice(0, 10);

const userDisplay = (from) => [from?.first_name, from?.last_name].filter(Boolean).join(' ').trim() || (from?.username ? `@${from.username}` : `id:${from?.id || 'unknown'}`);
const isAdminUserId = (userId) => ADMIN_IDS.includes(String(userId || '').trim());
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
const ticketsKeyboard = (ctx) => getUiForCtx(ctx).keyboards.ticketsKeyboard;
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
const withTimeout = async (promise, timeoutMs) => {
  let timer = null;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('timeout')), timeoutMs);
      })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
};

const getAiHistory = (userId) => {
  const raw = store.getMeta(aiHistoryMetaKey(userId), []);
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((row) => row && (row.role === 'user' || row.role === 'assistant') && typeof row.content === 'string')
    .slice(-8);
};

const setAiHistory = (userId, rows) => {
  store.setMeta(aiHistoryMetaKey(userId), Array.isArray(rows) ? rows.slice(-8) : []);
};

const clearAiHistory = (userId) => {
  setAiHistory(userId, []);
};

const getAiSystemPrompt = (ctx) => {
  const lang = resolveUserLanguage(ctx);
  const langLabel = languageChoiceLabel(lang);
  return [
    'You are MegaConvert assistant in Telegram bot.',
    `Reply in ${langLabel}.`,
    'Keep answers concise and practical.',
    'If user asks conversion question, include direct command examples.',
    'Do not invent paid features.'
  ].join(' ');
};

const askAssistant = async (ctx, prompt) => {
  if (!GROQ_API_KEY) {
    await safeReply(ctx, tr(ctx, 'messages.assistantUnavailable'), mainKeyboard);
    return;
  }
  const userId = String(ctx.from?.id || '').trim();
  const now = Date.now();
  const cooldownUntil = Number(aiCooldownUntil.get(userId) || 0);
  if (cooldownUntil > now) {
    const waitSec = Math.max(1, Math.ceil((cooldownUntil - now) / 1000));
    await safeReply(ctx, tr(ctx, 'messages.assistantRateLimited', { seconds: waitSec }), mainKeyboard);
    return;
  }
  aiCooldownUntil.set(userId, now + (AI_COOLDOWN_SEC * 1000));

  const cleanPrompt = String(prompt || '').trim();
  if (!cleanPrompt) {
    await safeReply(ctx, tr(ctx, 'messages.assistantPrompt'), mainKeyboard);
    return;
  }
  if (cleanPrompt.length > AI_MAX_INPUT_CHARS) {
    await safeReply(ctx, `Max input length is ${AI_MAX_INPUT_CHARS} chars.`, mainKeyboard);
    return;
  }

  const statusMsg = await safeReply(ctx, tr(ctx, 'messages.assistantThinking'), mainKeyboard);
  const history = getAiHistory(userId);
  const body = {
    model: GROQ_MODEL,
    temperature: 0.3,
    max_tokens: 900,
    messages: [
      { role: 'system', content: getAiSystemPrompt(ctx) },
      ...history,
      { role: 'user', content: cleanPrompt }
    ]
  };

  try {
    const response = await withTimeout(fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${GROQ_API_KEY}`
      },
      body: JSON.stringify(body)
    }), AI_TIMEOUT_MS);

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const errorText = String(payload?.error?.message || `HTTP ${response.status}`);
      throw new Error(errorText);
    }

    const answer = String(payload?.choices?.[0]?.message?.content || '').trim();
    if (!answer) throw new Error('empty response');
    setAiHistory(userId, [...history, { role: 'user', content: cleanPrompt }, { role: 'assistant', content: answer }]);

    const outText = answer.length > 3500 ? `${answer.slice(0, 3500)}...` : answer;
    try {
      await ctx.telegram.editMessageText(ctx.chat.id, statusMsg.message_id, undefined, outText, mainKeyboard(ctx));
    } catch {
      await safeReply(ctx, outText, mainKeyboard);
    }
  } catch (error) {
    const msg = String(error?.message || 'unknown error');
    try {
      await ctx.telegram.editMessageText(
        ctx.chat.id,
        statusMsg.message_id,
        undefined,
        tr(ctx, 'messages.assistantError', { error: msg }),
        mainKeyboard(ctx)
      );
    } catch {
      await safeReply(ctx, tr(ctx, 'messages.assistantError', { error: msg }), mainKeyboard);
    }
  }
};

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
  if (!converter) return String(converterId || 'Converter').toUpperCase();
  return `${converter.from} -> ${converter.to}`;
};

const getConverterInputHint = (ctx, converterId) => {
  const converter = CONVERTER_MAP.get(String(converterId || '').trim());
  if (!converter || !Array.isArray(converter.inputExts) || !converter.inputExts.length) return '-';
  return converter.inputExts.map((ext) => String(ext).toUpperCase()).join(', ');
};

const findConverterPage = (converterId = '') => {
  const idx = CONVERTER_DEFS.findIndex((item) => item.id === String(converterId || '').trim());
  if (idx < 0) return 0;
  return Math.floor(idx / CONVERTERS_PER_PAGE);
};

const buildConvertersKeyboard = (ctx, selectedId = '', pageInput = 0) => {
  const totalPages = Math.max(1, Math.ceil(CONVERTER_DEFS.length / CONVERTERS_PER_PAGE));
  const safePage = Math.max(0, Math.min(totalPages - 1, Number(pageInput || 0)));
  const start = safePage * CONVERTERS_PER_PAGE;
  const visible = CONVERTER_DEFS.slice(start, start + CONVERTERS_PER_PAGE);
  const rows = [];
  for (let i = 0; i < visible.length; i += 2) {
    const left = visible[i];
    const right = visible[i + 1];
    const buttons = [];
    const leftLabel = `${selectedId === left.id ? '✅ ' : ''}${getConverterLabel(ctx, left.id)}`;
    buttons.push(Markup.button.callback(leftLabel, `conv:set:${left.id}`));
    if (right) {
      const rightLabel = `${selectedId === right.id ? '✅ ' : ''}${getConverterLabel(ctx, right.id)}`;
      buttons.push(Markup.button.callback(rightLabel, `conv:set:${right.id}`));
    }
    rows.push(buttons);
  }
  if (totalPages > 1) {
    const navRow = [];
    if (safePage > 0) navRow.push(Markup.button.callback('◀️', `conv:page:${safePage - 1}`));
    navRow.push(Markup.button.callback(`${safePage + 1}/${totalPages}`, `conv:page:${safePage}`));
    if (safePage < totalPages - 1) navRow.push(Markup.button.callback('▶️', `conv:page:${safePage + 1}`));
    rows.push(navRow);
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

const getGlobalConverterStats = () => {
  const raw = store.getMeta('globalConverterStats', {});
  return raw && typeof raw === 'object' ? raw : {};
};

const bumpGlobalConverterStat = (converterId) => {
  const id = String(converterId || '').trim().toLowerCase();
  if (!id) return;
  const current = getGlobalConverterStats();
  current[id] = Number(current[id] || 0) + 1;
  store.setMeta('globalConverterStats', current);
};

const parseReferralPayload = (payload = '') => {
  const raw = String(payload || '').trim();
  const match = raw.match(/^ref[_:-]?(\d{3,20})$/i);
  return String(match?.[1] || '').trim();
};

const parseCompressionIntent = (ctx) => {
  const raw = `${readCaption(ctx)} ${readText(ctx)}`.trim().toLowerCase();
  if (!raw) return '';
  if (/\b(compress|shrink|optimi[sz]e|smaller|lite)\b/.test(raw)) return 'auto';
  if (/\bphoto|image|img|picture|pic\b/.test(raw) && /\b(compress|shrink|optimi[sz]e)\b/.test(raw)) return 'image';
  if (/\bvideo|clip\b/.test(raw) && /\b(compress|shrink|optimi[sz]e)\b/.test(raw)) return 'video';
  if (/\bсжать|ужать|сжатие|оптимиз/i.test(raw)) {
    if (/\bфото|картин|изображ/i.test(raw)) return 'image';
    if (/\bвидео|ролик/i.test(raw)) return 'video';
    return 'auto';
  }
  return '';
};

const parseCompressionLevel = (ctx) => {
  const raw = `${readCaption(ctx)} ${readText(ctx)}`.trim().toLowerCase();
  if (!raw) return 'balanced';
  if (/\b(max|best|hq|high)\b/.test(raw) || /\bмакс|лучшее|максим/i.test(raw)) return 'max';
  if (/\b(fast|quick|lite)\b/.test(raw) || /\bбыстро|быстрый/i.test(raw)) return 'fast';
  return 'balanced';
};

const selectCompressionConverter = (inputExt, kind = 'auto', level = 'balanced') => {
  const ext = String(inputExt || '').trim().toLowerCase();
  const profile = String(level || 'balanced').trim().toLowerCase();
  const imageMap = {
    jpg: profile === 'fast' ? ['jpg-webp', 'jpg-avif'] : ['jpg-avif', 'jpg-webp'],
    jpeg: profile === 'fast' ? ['jpg-webp', 'jpg-avif'] : ['jpg-avif', 'jpg-webp'],
    png: profile === 'fast' ? ['png-webp', 'png-avif'] : ['png-avif', 'png-webp'],
    heic: ['heic-webp', 'heic-jpg'],
    avif: ['avif-webp', 'avif-jpg'],
    webp: ['webp-jpg', 'webp-png'],
    tiff: ['tiff-webp', 'tiff-jpg'],
    tif: ['tiff-webp', 'tiff-jpg'],
    gif: ['gif-webp']
  };
  const videoMap = {
    mp4: profile === 'max' ? ['mp4-vp9', 'mp4-webm', 'mp4-mkv'] : profile === 'fast' ? ['mp4-webm', 'mp4-mkv', 'mp4-vp9'] : ['mp4-vp9', 'mp4-webm', 'mp4-mkv'],
    mov: profile === 'fast' ? ['mov-mp4', 'mov-webm'] : ['mov-webm', 'mov-mp4'],
    mkv: profile === 'fast' ? ['mkv-mp4', 'mkv-webm'] : ['mkv-webm', 'mkv-mp4'],
    avi: ['avi-webm', 'avi-mp4'],
    wmv: ['wmv-mp4'],
    vob: ['vob-mp4'],
    mpg: ['mpg-mp4']
  };
  const pickFrom = (ids) => (Array.isArray(ids) ? ids.find((id) => CONVERTER_MAP.has(id)) : null);

  if (kind === 'image') return pickFrom(imageMap[ext]);
  if (kind === 'video') return pickFrom(videoMap[ext]);

  return pickFrom(imageMap[ext]) || pickFrom(videoMap[ext]) || null;
};

const getRecentConverters = (userId) => {
  const raw = store.getMeta(recentConvertersMetaKey(String(userId || '')), []);
  if (!Array.isArray(raw)) return [];
  return raw
    .map((x) => String(x || '').trim().toLowerCase())
    .filter((id) => CONVERTER_MAP.has(id));
};

const pushRecentConverter = (userId, converterId) => {
  const id = String(converterId || '').trim().toLowerCase();
  if (!id || !CONVERTER_MAP.has(id)) return;
  const key = recentConvertersMetaKey(String(userId || ''));
  const current = getRecentConverters(userId).filter((x) => x !== id);
  store.setMeta(key, [id, ...current].slice(0, 8));
};

const getFavoriteConverters = (userId) => {
  const raw = store.getMeta(favoriteConvertersMetaKey(String(userId || '')), []);
  if (!Array.isArray(raw)) return [];
  return raw
    .map((x) => String(x || '').trim().toLowerCase())
    .filter((id) => CONVERTER_MAP.has(id));
};

const setFavoriteConverters = (userId, ids) => {
  const key = favoriteConvertersMetaKey(String(userId || ''));
  const normalized = Array.from(new Set((Array.isArray(ids) ? ids : [])
    .map((x) => String(x || '').trim().toLowerCase())
    .filter((id) => CONVERTER_MAP.has(id)))).slice(0, 20);
  store.setMeta(key, normalized);
  return normalized;
};

const addFavoriteConverter = (userId, converterId) => {
  const id = String(converterId || '').trim().toLowerCase();
  if (!CONVERTER_MAP.has(id)) return { ok: false, ids: getFavoriteConverters(userId) };
  const current = getFavoriteConverters(userId).filter((x) => x !== id);
  return { ok: true, ids: setFavoriteConverters(userId, [id, ...current]) };
};

const removeFavoriteConverter = (userId, converterId) => {
  const id = String(converterId || '').trim().toLowerCase();
  const current = getFavoriteConverters(userId);
  const next = current.filter((x) => x !== id);
  const removed = next.length !== current.length;
  setFavoriteConverters(userId, next);
  return { ok: removed, ids: next };
};

const parseDesiredOutputToken = (ctx) => {
  const raw = `${readCaption(ctx)} ${readText(ctx)}`.trim().toLowerCase();
  if (!raw) return '';
  const tokenMatch = raw.match(/\b(?:to|в|->|=>)\s*([a-z0-9]{2,8})\b/i);
  const directMatch = raw.match(/\b([a-z0-9]{2,8})\b$/i);
  const token = String(tokenMatch?.[1] || directMatch?.[1] || '').trim().toLowerCase();
  if (!token) return '';
  if (token === 'word') return 'docx';
  if (token === 'jpeg') return 'jpg';
  return token;
};

const resolveConverterByInputAndTarget = (inputExt, targetToken) => {
  const fromExt = String(inputExt || '').trim().toLowerCase();
  const out = String(targetToken || '').trim().toLowerCase();
  if (!fromExt || !out) return null;
  const candidates = CONVERTER_DEFS.filter((item) => item.inputExts.includes(fromExt));
  if (!candidates.length) return null;
  return candidates.find((item) => item.outputExt === out)
    || candidates.find((item) => item.to.toLowerCase() === out)
    || candidates.find((item) => item.id.endsWith(`-${out}`))
    || null;
};

const buildQuickConverterKeyboard = (ctx, converterIds = []) => {
  const rows = Array.from(new Set((Array.isArray(converterIds) ? converterIds : [])
    .map((id) => String(id || '').trim().toLowerCase())
    .filter((id) => CONVERTER_MAP.has(id))))
    .slice(0, 8)
    .map((id) => [Markup.button.callback(getConverterLabel(ctx, id), `conv:quick:${id}`)]);
  rows.push([Markup.button.callback(tr(ctx, 'converter.closeButton'), 'conv:close')]);
  return Markup.inlineKeyboard(rows);
};

const buildAdminKeyboard = () => Markup.inlineKeyboard([
  [Markup.button.callback('📊 Stats', 'adm:stats'), Markup.button.callback('🔥 Top', 'adm:top')],
  [Markup.button.callback('📣 Broadcast', 'adm:broadcast')],
  [Markup.button.callback('❌ Close', 'adm:close')]
]);

const showAdminPanel = async (ctx) => {
  await safeReply(
    ctx,
    '🛠 Admin Panel\nUse buttons below to view stats or start broadcast.',
    buildAdminKeyboard()
  );
};

const PROMO_TIERS = ['free', 'pro', 'individual', 'team'];
const PROMO_TIER_WEIGHT = { free: 1, pro: 2, individual: 3, team: 4 };
const promoDefsMetaKey = 'botPromoDefs';
const promoUsersMetaKey = 'botPromoUsers';

const getPromoDefs = () => {
  const raw = store.getMeta(promoDefsMetaKey, {});
  return raw && typeof raw === 'object' ? raw : {};
};

const setPromoDefs = (defs) => {
  store.setMeta(promoDefsMetaKey, defs && typeof defs === 'object' ? defs : {});
};

const getPromoUsers = () => {
  const raw = store.getMeta(promoUsersMetaKey, {});
  return raw && typeof raw === 'object' ? raw : {};
};

const setPromoUsers = (users) => {
  store.setMeta(promoUsersMetaKey, users && typeof users === 'object' ? users : {});
};

const normalizePromoCodeInput = (value) => String(value || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');

const getUserPromoBenefits = (userId) => {
  const users = getPromoUsers();
  const list = Array.isArray(users[String(userId || '')]) ? users[String(userId || '')] : [];
  const now = Date.now();
  return list
    .filter((x) => x && typeof x === 'object')
    .filter((x) => !x.expiresAt || Number(x.expiresAt) > now)
    .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
};

const resolveBestPromoTier = (benefits = []) => {
  let best = '';
  let weight = 0;
  for (const row of benefits) {
    const tier = String(row?.tier || '').trim().toLowerCase();
    const w = Number(PROMO_TIER_WEIGHT[tier] || 0);
    if (w > weight) {
      weight = w;
      best = tier;
    }
  }
  return best;
};

const createPromoCode = ({ code, tier = 'pro', days = 30, maxUses = 100, createdBy = '' }) => {
  const normalizedCode = normalizePromoCodeInput(code);
  const normalizedTier = String(tier || '').trim().toLowerCase();
  const normalizedDays = Math.max(0, Number(days || 0));
  const normalizedMaxUses = Math.max(1, Number(maxUses || 1));
  if (!normalizedCode || normalizedCode.length < 4) return { ok: false, message: 'Code must be at least 4 chars' };
  if (!PROMO_TIERS.includes(normalizedTier)) return { ok: false, message: `Tier must be one of: ${PROMO_TIERS.join(', ')}` };
  const defs = getPromoDefs();
  if (defs[normalizedCode]) return { ok: false, message: 'Promo code already exists' };
  defs[normalizedCode] = {
    code: normalizedCode,
    tier: normalizedTier,
    days: normalizedDays,
    maxUses: normalizedMaxUses,
    uses: 0,
    active: true,
    createdBy: String(createdBy || ''),
    createdAt: Date.now()
  };
  setPromoDefs(defs);
  return { ok: true, promo: defs[normalizedCode] };
};

const deletePromoCode = (code) => {
  const normalizedCode = normalizePromoCodeInput(code);
  const defs = getPromoDefs();
  if (!defs[normalizedCode]) return false;
  delete defs[normalizedCode];
  setPromoDefs(defs);
  return true;
};

const togglePromoCode = (code, enabled) => {
  const normalizedCode = normalizePromoCodeInput(code);
  const defs = getPromoDefs();
  if (!defs[normalizedCode]) return { ok: false };
  defs[normalizedCode].active = Boolean(enabled);
  setPromoDefs(defs);
  return { ok: true, promo: defs[normalizedCode] };
};

const redeemLocalPromoCode = ({ userId, code }) => {
  const normalizedCode = normalizePromoCodeInput(code);
  if (!normalizedCode) return { ok: false, message: 'Promo code is required' };
  const defs = getPromoDefs();
  const promo = defs[normalizedCode];
  if (!promo || promo.active === false) return { ok: false, message: 'Promo code not found or inactive' };
  if (Number(promo.uses || 0) >= Number(promo.maxUses || 0)) return { ok: false, message: 'Promo code usage limit reached' };

  const users = getPromoUsers();
  const key = String(userId || '');
  const list = Array.isArray(users[key]) ? users[key] : [];
  const already = list.some((x) => String(x?.code || '') === normalizedCode);
  if (already) return { ok: false, message: 'Promo code already redeemed by this user' };

  const now = Date.now();
  const days = Number(promo.days || 0);
  const expiresAt = days > 0 ? now + (days * 86400000) : 0;
  const benefit = {
    code: normalizedCode,
    tier: String(promo.tier || 'pro'),
    days,
    expiresAt,
    createdAt: now
  };
  users[key] = [benefit, ...list].slice(0, 20);
  setPromoUsers(users);

  promo.uses = Number(promo.uses || 0) + 1;
  defs[normalizedCode] = promo;
  setPromoDefs(defs);
  return { ok: true, benefit };
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

const trackEvent = async (ctxOrUserId, eventType, payload = {}) => {
  const userId = typeof ctxOrUserId === 'string' ? ctxOrUserId : String(ctxOrUserId?.from?.id || '');
  if (!userId) return;
  const stats = store.logActivity(userId, eventType, payload);
  if (typeof ctxOrUserId === 'object' && Array.isArray(stats?.newBadges)) {
    for (const badge of stats.newBadges) {
      await safeReply(ctxOrUserId, tr(ctxOrUserId, 'messages.achievementUnlocked', { title: badge.title }));
    }
  }
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
  const localBenefits = getUserPromoBenefits(userId);
  const localTier = resolveBestPromoTier(localBenefits);
  if (localTier) {
    plan = `${localTier.toUpperCase()} (Promo)`;
    status = 'promo_active';
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
    const promoBenefits = getUserPromoBenefits(userId);
    const promoLines = promoBenefits.slice(0, 4).map((p) => {
      const exp = Number(p.expiresAt || 0);
      const expText = exp ? new Date(exp).toISOString().slice(0, 10) : 'lifetime';
      return `• PROMO ${String(p.tier || 'pro').toUpperCase()} (${expText})`;
    });
    const lines = [...promoLines, ...benefits.slice(0, 6).map((b) => `• ${formatBenefit(ctx, b)}`)];
    const finalLines = lines.length ? lines : [tr(ctx, 'messages.noBenefits')];
    const localTier = resolveBestPromoTier(promoBenefits);
    const planTitle = localTier ? `${String(localTier || 'pro').toUpperCase()} Promo Plan` : String(billing?.plan?.title || 'Free Plan');
    await safeReply(
      ctx,
      [tr(ctx, 'messages.planTitle', { plan: planTitle }), tr(ctx, 'messages.benefitsTitle'), ...finalLines].join('\n'),
      planKeyboard
    );
  } catch (e) {
    await safeReply(ctx, tr(ctx, 'messages.planLoadFailed', { error: e?.message || 'error' }), planKeyboard);
  }
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

async function showConverters(ctx) {
  const linked = await ensureAccountLinked(ctx);
  if (!linked) return;
  await safeReply(
    ctx,
    [tr(ctx, 'converter.title'), tr(ctx, 'converter.choose')].join('\n'),
    buildConvertersKeyboard(ctx, '', 0)
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

async function runConversionWithInput(ctx, converter, input) {
  const userId = String(ctx.from.id);
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
    pushRecentConverter(userId, converter.id);
    bumpGlobalConverterStat(converter.id);
    const day = todayKey();
    const usageKey = `dailyUsage:${userId}:${day}`;
    const usage = store.getMeta(usageKey, { conversions: 0, tickets: 0 });
    store.setMeta(usageKey, {
      conversions: Number(usage?.conversions || 0) + 1,
      tickets: Number(usage?.tickets || 0)
    });
    await trackEvent(ctx, 'converter_run', { converterId: converter.id, inputExt: ext });
    await safeReply(ctx, tr(ctx, 'messages.converterDone', { fileName: outName }), mainKeyboard);
  } catch (error) {
    store.clearUserState(userId);
    await safeReply(ctx, tr(ctx, 'messages.converterFailed', { error: getApiErrorMessage(ctx, error) }), mainKeyboard);
  }
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
  await runConversionWithInput(ctx, converter, input);
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
  const day = todayKey();
  const usageKey = `dailyUsage:${userId}:${day}`;
  const usage = store.getMeta(usageKey, { conversions: 0, tickets: 0 });
  store.setMeta(usageKey, {
    conversions: Number(usage?.conversions || 0),
    tickets: Number(usage?.tickets || 0) + 1
  });
  await trackEvent(ctx, 'support_message', { topic, text, kind: topic });
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
  const aiCmd = text.match(/^\/ai(?:\s+([\s\S]+))?$/i);
  if (aiCmd) {
    const prompt = String(aiCmd[1] || '').trim();
    if (!prompt) {
      store.setUserState(userId, {
        mode: 'await_ai_prompt',
        topic: 'assistant',
        draft: {}
      });
      await safeReply(ctx, tr(ctx, 'messages.assistantPrompt'), mainKeyboard);
      return true;
    }
    store.clearUserState(userId);
    await askAssistant(ctx, prompt);
    return true;
  }

  const aiClearCmd = text.match(/^\/aiclear$/i);
  if (aiClearCmd) {
    clearAiHistory(userId);
    store.clearUserState(userId);
    await safeReply(ctx, tr(ctx, 'messages.assistantCleared'), mainKeyboard);
    return true;
  }

  const promoRedeemCmd = text.match(/^\/promo\s+([A-Za-z0-9_-]{4,64})$/i);
  if (promoRedeemCmd) {
    const link = store.getLink(userId);
    if (!link) {
      await safeReply(ctx, tr(ctx, 'messages.linkAccountFirst'), linkKeyboard);
      return true;
    }
    const code = String(promoRedeemCmd[1] || '').trim();
    try {
      const remote = await redeemPromoCode({
        apiBaseUrl: API_BASE_URL,
        appUserId: link.appUserId,
        sessionId: `tg-${userId}`,
        code
      });
      const entitlement = remote?.entitlement || remote?.benefit?.entitlement || null;
      const kind = String(entitlement?.kind || remote?.benefit?.kind || 'benefit').toUpperCase();
      const endsAt = String(entitlement?.ends_at || '').trim();
      const ends = endsAt ? `\nExpires: ${endsAt.slice(0, 10)}` : '';
      await safeReply(ctx, `✅ Promo activated on site: ${kind}${ends}`, mainKeyboard);
      return true;
    } catch (e) {
      const fallback = redeemLocalPromoCode({ userId, code });
      if (!fallback.ok) {
        await safeReply(ctx, `❌ ${e?.message || fallback.message}`, mainKeyboard);
        return true;
      }
      const tier = String(fallback?.benefit?.tier || 'pro').toUpperCase();
      const exp = Number(fallback?.benefit?.expiresAt || 0);
      const expText = exp ? new Date(exp).toISOString().slice(0, 10) : 'lifetime';
      await safeReply(ctx, `✅ Promo activated (bot-local): ${tier}\nExpires: ${expText}`, mainKeyboard);
      return true;
    }
  }

  const promoNewCmd = text.match(/^\/promonew\s+([A-Za-z0-9_-]{4,64})\s+(free|pro|individual|team)\s+(\d+)(?:\s+(\d+))?$/i);
  if (promoNewCmd) {
    if (!isAdminUserId(userId)) {
      await safeReply(ctx, 'Access denied.', mainKeyboard);
      return true;
    }
    const created = createPromoCode({
      code: promoNewCmd[1],
      tier: promoNewCmd[2],
      days: Number(promoNewCmd[3] || 0),
      maxUses: Number(promoNewCmd[4] || 100),
      createdBy: userId
    });
    if (!created.ok) {
      await safeReply(ctx, `❌ ${created.message}`, mainKeyboard);
      return true;
    }
    await safeReply(
      ctx,
      `✅ Promo created\nCode: ${created.promo.code}\nTier: ${created.promo.tier}\nDays: ${created.promo.days}\nMax uses: ${created.promo.maxUses}`,
      mainKeyboard
    );
    return true;
  }

  const promoListCmd = text.match(/^\/promolist$/i);
  if (promoListCmd) {
    if (!isAdminUserId(userId)) {
      await safeReply(ctx, 'Access denied.', mainKeyboard);
      return true;
    }
    const defs = Object.values(getPromoDefs())
      .filter((x) => x && typeof x === 'object')
      .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))
      .slice(0, 20);
    if (!defs.length) {
      await safeReply(ctx, 'No promo codes yet.', mainKeyboard);
      return true;
    }
    const lines = defs.map((p) => `• ${p.code} | ${String(p.tier).toUpperCase()} | ${p.days}d | ${p.uses}/${p.maxUses} | ${p.active ? 'ON' : 'OFF'}`);
    await safeReply(ctx, `🎟 Promo codes:\n${lines.join('\n')}`, mainKeyboard);
    return true;
  }

  const promoDelCmd = text.match(/^\/promodel\s+([A-Za-z0-9_-]{4,64})$/i);
  if (promoDelCmd) {
    if (!isAdminUserId(userId)) {
      await safeReply(ctx, 'Access denied.', mainKeyboard);
      return true;
    }
    const ok = deletePromoCode(promoDelCmd[1]);
    await safeReply(ctx, ok ? '🗑 Promo deleted' : 'Promo not found', mainKeyboard);
    return true;
  }

  const promoToggleCmd = text.match(/^\/promotoggle\s+([A-Za-z0-9_-]{4,64})\s+(on|off)$/i);
  if (promoToggleCmd) {
    if (!isAdminUserId(userId)) {
      await safeReply(ctx, 'Access denied.', mainKeyboard);
      return true;
    }
    const code = String(promoToggleCmd[1] || '').trim();
    const enabled = String(promoToggleCmd[2] || '').trim().toLowerCase() === 'on';
    const result = togglePromoCode(code, enabled);
    if (!result.ok) {
      await safeReply(ctx, 'Promo not found', mainKeyboard);
      return true;
    }
    await safeReply(
      ctx,
      `✅ Promo ${result.promo.code} is now ${result.promo.active ? 'ON' : 'OFF'}`,
      mainKeyboard
    );
    return true;
  }

  const adminHelpCmd = text.match(/^\/adminhelp$/i);
  if (adminHelpCmd) {
    if (!isAdminUserId(userId)) {
      await safeReply(ctx, 'Access denied.', mainKeyboard);
      return true;
    }
    await safeReply(
      ctx,
      [
        '🛠 Admin commands:',
        '/admin',
        '/adminhelp',
        '/promonew <CODE> <free|pro|individual|team> <days> [maxUses]',
        '/promolist',
        '/promodel <CODE>',
        '/promotoggle <CODE> on|off',
        '/promo <CODE>',
        '/ticketlist',
        '/ticketclose <ticket_id>',
        '/ticketreply <ticket_id> <text>',
        '/reply <telegram_user_id> <text>'
      ].join('\n'),
      mainKeyboard
    );
    return true;
  }

  const adminCmd = text.match(/^\/admin$/i);
  if (adminCmd) {
    if (!isAdminUserId(userId)) {
      await safeReply(ctx, 'Access denied.', mainKeyboard);
      return true;
    }
    await showAdminPanel(ctx);
    return true;
  }

  const compressPhotoCmd = text.match(/^\/compressphoto(?:\s+(fast|balanced|max|webp|avif))?$/i);
  if (compressPhotoCmd) {
    const profile = String(compressPhotoCmd[1] || 'balanced').trim().toLowerCase();
    const forceOut = profile === 'webp' || profile === 'avif' ? profile : '';
    store.setUserState(userId, {
      mode: 'await_compress_file',
      topic: 'converter',
      draft: { compressKind: 'image', compressLevel: profile, compressOut: forceOut }
    });
    await safeReply(ctx, `Send photo/image file now. Compression profile: ${profile.toUpperCase()}`, mainKeyboard);
    return true;
  }

  const compressVideoCmd = text.match(/^\/compressvideo(?:\s+(fast|balanced|max|webm|vp9|mkv))?$/i);
  if (compressVideoCmd) {
    const profile = String(compressVideoCmd[1] || 'balanced').trim().toLowerCase();
    const forceOut = profile === 'webm' || profile === 'vp9' || profile === 'mkv' ? profile : '';
    store.setUserState(userId, {
      mode: 'await_compress_file',
      topic: 'converter',
      draft: { compressKind: 'video', compressLevel: profile, compressOut: forceOut }
    });
    await safeReply(ctx, `Send video file now. Compression profile: ${profile.toUpperCase()}`, mainKeyboard);
    return true;
  }

  const compressCmd = text.match(/^\/compress(?:\s+(fast|balanced|max))?$/i);
  if (compressCmd) {
    const profile = String(compressCmd[1] || 'balanced').trim().toLowerCase();
    store.setUserState(userId, {
      mode: 'await_compress_file',
      topic: 'converter',
      draft: { compressKind: 'auto', compressLevel: profile, compressOut: '' }
    });
    await safeReply(ctx, `Send file now. Compression profile: ${profile.toUpperCase()}`, mainKeyboard);
    return true;
  }

  const statusCmd = text.match(/^\/status$/i);
  if (statusCmd) {
    const tools = CONVERTER_DEFS.length;
    const linked = store.getLink(userId);
    await safeReply(
      ctx,
      `✅ Bot online\nConverters: ${tools}\nAccount: ${linked ? 'linked' : 'not linked'}`,
      mainKeyboard
    );
    return true;
  }

  const idCmd = text.match(/^\/id$/i);
  if (idCmd) {
    await safeReply(ctx, `🆔 Your Telegram ID: ${userId}`, mainKeyboard);
    return true;
  }

  const shareCmd = text.match(/^\/share$/i);
  if (shareCmd) {
    const username = String(ctx.botInfo?.username || process.env.TELEGRAM_BOT_USERNAME || '').trim();
    if (!username) {
      await safeReply(ctx, 'Set TELEGRAM_BOT_USERNAME to enable share links.', mainKeyboard);
      return true;
    }
    const url = `https://t.me/${username}?start=ref_${userId}`;
    await safeReply(ctx, `🚀 Share this link:\n${url}`, mainKeyboard);
    return true;
  }

  const refStatsCmd = text.match(/^\/refstats$/i);
  if (refStatsCmd) {
    const count = Number(store.getMeta(referralCountMetaKey(userId), 0) || 0);
    const referredBy = String(store.getMeta(referredByMetaKey(userId), '') || '');
    await safeReply(
      ctx,
      `👥 Referrals: ${count}\nInvited by: ${referredBy || '-'}`,
      mainKeyboard
    );
    return true;
  }

  const topCmd = text.match(/^\/top$/i);
  if (topCmd) {
    const stats = Object.entries(getGlobalConverterStats())
      .filter(([id]) => CONVERTER_MAP.has(id))
      .sort((a, b) => Number(b[1]) - Number(a[1]))
      .slice(0, 10);
    if (!stats.length) {
      await safeReply(ctx, 'No conversion stats yet.', mainKeyboard);
      return true;
    }
    const lines = stats.map(([id, count], i) => `${i + 1}. ${id} — ${count}`);
    await safeReply(ctx, `🔥 Top converters:\n${lines.join('\n')}`, mainKeyboard);
    return true;
  }

  const todayCmd = text.match(/^\/today$/i);
  if (todayCmd) {
    const day = todayKey();
    const usage = store.getMeta(`dailyUsage:${userId}:${day}`, { conversions: 0, tickets: 0 });
    await safeReply(
      ctx,
      `📅 Today (${day})\nConversions: ${Number(usage?.conversions || 0)}\nTickets: ${Number(usage?.tickets || 0)}`,
      mainKeyboard
    );
    return true;
  }

  const tipsCmd = text.match(/^\/tips$/i);
  if (tipsCmd) {
    const tips = [
      'Send files as document to keep original quality.',
      'Use caption "to pdf" (or "to mp3") for instant auto-convert.',
      'Use /convfind <format> to find tools quickly.',
      'Use /fav add <tool-id> to build one-tap favorites.',
      'Use /recent to repeat your last converters.'
    ];
    const pick = tips[Math.floor(Math.random() * tips.length)];
    await safeReply(ctx, `💡 ${pick}`, mainKeyboard);
    return true;
  }

  const formatsCmd = text.match(/^\/formats\s+([a-z0-9]{2,8})$/i);
  if (formatsCmd) {
    const inputExt = String(formatsCmd[1] || '').trim().toLowerCase();
    const out = CONVERTER_DEFS
      .filter((item) => item.inputExts.includes(inputExt))
      .slice(0, 40)
      .map((item) => `${inputExt.toUpperCase()} -> ${item.to}`);
    if (!out.length) {
      await safeReply(ctx, `No converters found for .${inputExt}`, mainKeyboard);
      return true;
    }
    await safeReply(ctx, `Formats for .${inputExt}:\n${out.join('\n')}`, mainKeyboard);
    return true;
  }

  const toCmd = text.match(/^\/to\s+([a-z0-9]{2,8})$/i);
  if (toCmd) {
    const out = String(toCmd[1] || '').trim().toLowerCase();
    store.setUserState(userId, {
      mode: 'await_target_file',
      topic: 'converter',
      draft: { targetOut: out }
    });
    await safeReply(ctx, `Send a file now. Target format: ${out.toUpperCase()}`, mainKeyboard);
    return true;
  }

  const favListCmd = text.match(/^\/fav$/i);
  if (favListCmd) {
    const favorites = getFavoriteConverters(userId);
    if (!favorites.length) {
      await safeReply(ctx, tr(ctx, 'messages.converterUnsupported'), mainKeyboard);
      return true;
    }
    await safeReply(
      ctx,
      [tr(ctx, 'converter.title'), tr(ctx, 'converter.choose')].join('\n'),
      buildQuickConverterKeyboard(ctx, favorites)
    );
    return true;
  }

  const favAddCmd = text.match(/^\/fav\s+add\s+([a-z0-9-]+)$/i);
  if (favAddCmd) {
    const id = String(favAddCmd[1] || '').trim().toLowerCase();
    const added = addFavoriteConverter(userId, id);
    if (!added.ok) {
      await safeReply(ctx, tr(ctx, 'messages.converterUnsupported'), mainKeyboard);
      return true;
    }
    await safeReply(ctx, `⭐ ${getConverterLabel(ctx, id)}`, mainKeyboard);
    return true;
  }

  const favDelCmd = text.match(/^\/fav\s+del\s+([a-z0-9-]+)$/i);
  if (favDelCmd) {
    const id = String(favDelCmd[1] || '').trim().toLowerCase();
    const removed = removeFavoriteConverter(userId, id);
    if (!removed.ok) {
      await safeReply(ctx, tr(ctx, 'messages.converterUnsupported'), mainKeyboard);
      return true;
    }
    await safeReply(ctx, `🗑 ${getConverterLabel(ctx, id)}`, mainKeyboard);
    return true;
  }

  const recentConvertersCmd = text.match(/^\/recent$/i);
  if (recentConvertersCmd) {
    const recent = getRecentConverters(userId);
    if (!recent.length) {
      await safeReply(ctx, tr(ctx, 'messages.converterUnsupported'), mainKeyboard);
      return true;
    }
    const rows = recent
      .map((id) => CONVERTER_MAP.get(id))
      .filter(Boolean)
      .slice(0, 8)
      .map((item) => [Markup.button.callback(getConverterLabel(ctx, item.id), `conv:set:${item.id}`)]);
    rows.push([Markup.button.callback(tr(ctx, 'converter.closeButton'), 'conv:close')]);
    await safeReply(
      ctx,
      [tr(ctx, 'converter.title'), tr(ctx, 'converter.choose')].join('\n'),
      Markup.inlineKeyboard(rows)
    );
    return true;
  }

  const openConvertersCmd = text.match(/^\/converters$/i);
  if (openConvertersCmd) {
    await showConverters(ctx);
    return true;
  }

  const pickConverterCmd = text.match(/^\/conv\s+([a-z0-9-]+)$/i);
  if (pickConverterCmd) {
    const converterId = String(pickConverterCmd[1] || '').trim().toLowerCase();
    if (!CONVERTER_MAP.has(converterId)) {
      await safeReply(ctx, tr(ctx, 'messages.converterUnsupported'), mainKeyboard);
      return true;
    }
    await setConverterMode(ctx, converterId);
    return true;
  }

  const findConverterCmd = text.match(/^\/convfind\s+(.+)$/i);
  if (findConverterCmd) {
    const query = String(findConverterCmd[1] || '').trim().toLowerCase();
    if (!query) {
      await showConverters(ctx);
      return true;
    }
    const matched = CONVERTER_DEFS.filter((item) => {
      return item.id.includes(query)
        || item.from.toLowerCase().includes(query)
        || item.to.toLowerCase().includes(query)
        || `${item.from}-${item.to}`.toLowerCase().includes(query);
    }).slice(0, 12);
    if (!matched.length) {
      await safeReply(ctx, tr(ctx, 'messages.converterUnsupported'), mainKeyboard);
      return true;
    }
    const rows = matched.map((item) => [Markup.button.callback(getConverterLabel(ctx, item.id), `conv:set:${item.id}`)]);
    rows.push([Markup.button.callback(tr(ctx, 'converter.closeButton'), 'conv:close')]);
    await safeReply(
      ctx,
      [tr(ctx, 'converter.title'), tr(ctx, 'converter.choose')].join('\n'),
      Markup.inlineKeyboard(rows)
    );
    return true;
  }

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
    case BUTTON_KEYS.ASSISTANT:
      await enterMode(ctx, 'await_ai_prompt', 'assistant');
      await safeReply(ctx, tr(ctx, 'messages.assistantPrompt'), mainKeyboard);
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
  const referralFromPayload = parseReferralPayload(String(ctx.startPayload || ''));
  if (referralFromPayload && referralFromPayload !== userId) {
    const alreadyReferred = String(store.getMeta(referredByMetaKey(userId), '') || '');
    if (!alreadyReferred) {
      store.setMeta(referredByMetaKey(userId), referralFromPayload);
      const countKey = referralCountMetaKey(referralFromPayload);
      const current = Number(store.getMeta(countKey, 0) || 0);
      store.setMeta(countKey, current + 1);
    }
  }
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
  const page = findConverterPage(converterId);
  try {
    await ctx.editMessageText(
      [tr(ctx, 'converter.title'), tr(ctx, 'converter.choose')].join('\n'),
      buildConvertersKeyboard(ctx, converterId, page)
    );
  } catch {
    // noop
  }
  await setConverterMode(ctx, converterId);
});

bot.action(/^conv:quick:([a-z0-9-]+)$/i, async (ctx) => {
  if (!isPrivateChat(ctx)) {
    await ctx.answerCbQuery('Private chat only', { show_alert: true });
    return;
  }
  const converterId = String(ctx.match?.[1] || '').trim();
  const converter = CONVERTER_MAP.get(converterId);
  if (!converter) {
    await ctx.answerCbQuery(tr(ctx, 'messages.converterUnsupported'), { show_alert: true });
    return;
  }
  const state = store.getUserState(String(ctx.from.id));
  const input = state?.mode === 'await_suggest_pick' ? state?.draft?.input || null : null;
  if (!input || !input.fileId) {
    await ctx.answerCbQuery(tr(ctx, 'messages.converterFileExpected'), { show_alert: true });
    return;
  }
  await ctx.answerCbQuery(getConverterLabel(ctx, converterId));
  try {
    await ctx.deleteMessage();
  } catch {
    // noop
  }
  await runConversionWithInput(ctx, converter, input);
});

bot.action(/^conv:page:(\d+)$/i, async (ctx) => {
  if (!isPrivateChat(ctx)) {
    await ctx.answerCbQuery('Private chat only', { show_alert: true });
    return;
  }
  const page = Number(ctx.match?.[1] || 0);
  await ctx.answerCbQuery();
  try {
    await ctx.editMessageText(
      [tr(ctx, 'converter.title'), tr(ctx, 'converter.choose')].join('\n'),
      buildConvertersKeyboard(ctx, '', page)
    );
  } catch {
    // noop
  }
});

bot.action('adm:stats', async (ctx) => {
  const userId = String(ctx.from?.id || '').trim();
  if (!isAdminUserId(userId)) {
    await ctx.answerCbQuery('Access denied', { show_alert: true });
    return;
  }
  const users = store.listKnownUserIds().length;
  const openTickets = store.listOpenTickets(9999).length;
  const globalRuns = Object.values(getGlobalConverterStats()).reduce((acc, x) => acc + Number(x || 0), 0);
  await ctx.answerCbQuery();
  await ctx.reply(
    [
      '📊 Global Stats',
      `Users: ${users}`,
      `Open tickets: ${openTickets}`,
      `Conversions: ${globalRuns}`
    ].join('\n')
  );
});

bot.action('adm:top', async (ctx) => {
  const userId = String(ctx.from?.id || '').trim();
  if (!isAdminUserId(userId)) {
    await ctx.answerCbQuery('Access denied', { show_alert: true });
    return;
  }
  const top = Object.entries(getGlobalConverterStats())
    .filter(([id]) => CONVERTER_MAP.has(id))
    .sort((a, b) => Number(b[1]) - Number(a[1]))
    .slice(0, 10);
  await ctx.answerCbQuery();
  if (!top.length) {
    await ctx.reply('No conversion stats yet.');
    return;
  }
  await ctx.reply(['🔥 Top converters', ...top.map(([id, c], i) => `${i + 1}. ${id} — ${c}`)].join('\n'));
});

bot.action('adm:broadcast', async (ctx) => {
  const userId = String(ctx.from?.id || '').trim();
  if (!isAdminUserId(userId)) {
    await ctx.answerCbQuery('Access denied', { show_alert: true });
    return;
  }
  store.setUserState(userId, {
    mode: 'await_admin_broadcast',
    topic: 'admin',
    draft: {}
  });
  await ctx.answerCbQuery();
  await ctx.reply('📣 Send broadcast text now. It will be delivered to all known users.');
});

bot.action('adm:close', async (ctx) => {
  const userId = String(ctx.from?.id || '').trim();
  if (!isAdminUserId(userId)) {
    await ctx.answerCbQuery('Access denied', { show_alert: true });
    return;
  }
  try {
    await ctx.deleteMessage();
  } catch {
    // noop
  }
  await ctx.answerCbQuery();
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

  if (state.mode === 'await_admin_broadcast') {
    const senderId = String(ctx.from.id);
    if (!isAdminUserId(senderId)) {
      store.clearUserState(senderId);
      await safeReply(ctx, 'Access denied.', mainKeyboard);
      return;
    }
    const text = readText(ctx);
    if (!text) {
      await safeReply(ctx, 'Send plain text for broadcast.', mainKeyboard);
      return;
    }
    const targets = store.listKnownUserIds().filter((id) => id && id !== senderId);
    let sent = 0;
    let failed = 0;
    for (const target of targets) {
      try {
        const userMainKeyboard = getUiForLanguage(resolveLanguageByUserId(String(target))).keyboards.mainKeyboard;
        await ctx.telegram.sendMessage(String(target), `📢 ${text}`, userMainKeyboard);
        sent += 1;
      } catch {
        failed += 1;
      }
    }
    store.clearUserState(senderId);
    await safeReply(ctx, `Broadcast complete.\nSent: ${sent}\nFailed: ${failed}`, mainKeyboard);
    return;
  }

  if (state.mode === 'await_ai_prompt') {
    const prompt = readText(ctx);
    if (!prompt) {
      await safeReply(ctx, tr(ctx, 'messages.assistantPrompt'), mainKeyboard);
      return;
    }
    store.clearUserState(String(ctx.from.id));
    await askAssistant(ctx, prompt);
    return;
  }

  if (state.mode === 'await_compress_file') {
    const input = pickInputFile(ctx);
    if (!input) {
      await safeReply(ctx, tr(ctx, 'messages.converterFileExpected'), mainKeyboard);
      return;
    }
    const linked = await ensureAccountLinked(ctx);
    if (!linked) return;
    const inputExt = getFileExt(input.fileName, input.mimeType);
    const kind = String(state?.draft?.compressKind || 'auto').trim().toLowerCase();
    const profile = String(state?.draft?.compressLevel || 'balanced').trim().toLowerCase();
    const forceOut = String(state?.draft?.compressOut || '').trim().toLowerCase();
    let converterId = selectCompressionConverter(inputExt, kind, profile);
    if (forceOut) {
      const forced = resolveConverterByInputAndTarget(inputExt, forceOut);
      if (forced) converterId = forced.id;
    }
    if (!converterId || !CONVERTER_MAP.has(converterId)) {
      store.clearUserState(String(ctx.from.id));
      await safeReply(ctx, `No compression converter found for ${String(inputExt || '?').toUpperCase()}.`, mainKeyboard);
      return;
    }
    const converter = CONVERTER_MAP.get(converterId);
    await runConversionWithInput(ctx, converter, input);
    return;
  }

  if (state.mode === 'await_target_file') {
    const input = pickInputFile(ctx);
    if (!input) {
      await safeReply(ctx, tr(ctx, 'messages.converterFileExpected'), mainKeyboard);
      return;
    }
    const linked = await ensureAccountLinked(ctx);
    if (!linked) return;
    const inputExt = getFileExt(input.fileName, input.mimeType);
    const targetOut = String(state?.draft?.targetOut || '').trim().toLowerCase();
    const converter = resolveConverterByInputAndTarget(inputExt, targetOut);
    if (!converter) {
      store.clearUserState(String(ctx.from.id));
      await safeReply(
        ctx,
        `No converter found for ${String(inputExt || '?').toUpperCase()} -> ${String(targetOut || '?').toUpperCase()}`,
        mainKeyboard
      );
      return;
    }
    await runConversionWithInput(ctx, converter, input);
    return;
  }

  if (state.mode === 'idle') {
    const input = pickInputFile(ctx);
    if (input) {
      const linked = await ensureAccountLinked(ctx);
      if (!linked) return;
      const inputExt = getFileExt(input.fileName, input.mimeType);
      const compressionIntent = parseCompressionIntent(ctx);
      if (compressionIntent) {
        const profile = parseCompressionLevel(ctx);
        const converterId = selectCompressionConverter(inputExt, compressionIntent, profile);
        if (converterId && CONVERTER_MAP.has(converterId)) {
          await runConversionWithInput(ctx, CONVERTER_MAP.get(converterId), input);
          return;
        }
      }
      const targetToken = parseDesiredOutputToken(ctx);
      if (inputExt && targetToken) {
        const autoConverter = resolveConverterByInputAndTarget(inputExt, targetToken);
        if (autoConverter) {
          await runConversionWithInput(ctx, autoConverter, input);
          return;
        }
      }
      const recentCandidates = getRecentConverters(String(ctx.from.id))
        .map((id) => CONVERTER_MAP.get(id))
        .filter(Boolean)
        .filter((item) => item.inputExts.includes(inputExt))
        .map((item) => item.id);
      if (recentCandidates.length) {
        store.setUserState(String(ctx.from.id), {
          mode: 'await_suggest_pick',
          topic: 'converter',
          draft: { input }
        });
        await safeReply(
          ctx,
          [tr(ctx, 'converter.title'), tr(ctx, 'converter.choose')].join('\n'),
          buildQuickConverterKeyboard(ctx, recentCandidates)
        );
        return;
      }
    }
  }

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

const server = internalApi.listen(INTERNAL_LINK_PORT, () => {
  console.log(`[internal_api] listening on :${INTERNAL_LINK_PORT}`);
});

timers.push(setInterval(() => {
  processNotifications().catch((error) => {
    console.error('[notification_worker_error]', error?.message || String(error));
  });
}, NOTIFICATION_POLL_MS));

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
