const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DEFAULT_STATE = {
  users: {},
  links: {},
  linkCodes: {},
  meta: {},
  tickets: {},
  notes: {},
  rules: {},
  workflows: {},
  notifications: {},
  activity: {},
  gamification: {}
};

const LINK_CODE_PATTERN = /^[A-Z0-9]{4,64}$/;
const MAX_EVENTS_PER_USER = 800;
const MAX_NOTES_PER_USER = 300;
const MAX_NOTIFICATIONS = 5000;
const MAX_TICKETS = 8000;

const EVENT_XP = {
  menu_open: 1,
  support_message: 4,
  ticket_created: 8,
  ticket_status_changed: 5,
  note_created: 3,
  note_deleted: 1,
  rule_created: 6,
  rule_triggered: 8,
  workflow_created: 8,
  workflow_executed: 10,
  converter_run: 7,
  simulator_run: 4,
  analytics_open: 2,
  account_linked: 6
};

const BADGES = [
  {
    id: 'first_contact',
    title: 'Первый контакт',
    check: (ctx) => Number(ctx.counters.support_message || 0) >= 1
  },
  {
    id: 'issue_hunter',
    title: 'Охотник за багами',
    check: (ctx) => Number(ctx.counters.ticket_created || 0) >= 1
  },
  {
    id: 'vault_keeper',
    title: 'Хранитель заметок',
    check: (ctx) => Number(ctx.counters.note_created || 0) >= 5
  },
  {
    id: 'automation_architect',
    title: 'Архитектор автоматизаций',
    check: (ctx) => Number(ctx.counters.rule_created || 0) + Number(ctx.counters.workflow_created || 0) >= 3
  },
  {
    id: 'level_5',
    title: 'Уровень 5',
    check: (ctx) => Number(ctx.level || 1) >= 5
  }
];

function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
}

function toDateKey(isoString) {
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function diffDays(dateAKey, dateBKey) {
  if (!dateAKey || !dateBKey) return 0;
  const a = new Date(`${dateAKey}T00:00:00.000Z`);
  const b = new Date(`${dateBKey}T00:00:00.000Z`);
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

function nowIso() {
  return new Date().toISOString();
}

function safeRandomId(prefix) {
  const rnd = typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID().replace(/-/g, '').slice(0, 12)
    : crypto.randomBytes(8).toString('hex');
  return `${prefix}_${rnd}`;
}

function uniqueCompactStringList(input) {
  const arr = Array.isArray(input)
    ? input
    : String(input || '')
      .split(',')
      .map((item) => item.trim());
  const set = new Set();
  for (const raw of arr) {
    const item = String(raw || '').trim();
    if (!item) continue;
    set.add(item.toLowerCase());
  }
  return Array.from(set);
}

class JsonStore {
  constructor(filePath) {
    this.filePath = path.resolve(filePath);
    ensureDir(this.filePath);
    this.state = this.load();
    this.pruneExpiredCodes();
    this.pruneOverflow();
  }

  load() {
    if (!fs.existsSync(this.filePath)) {
      return { ...DEFAULT_STATE };
    }
    try {
      const parsed = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
      return {
        users: parsed?.users && typeof parsed.users === 'object' ? parsed.users : {},
        links: parsed?.links && typeof parsed.links === 'object' ? parsed.links : {},
        linkCodes: parsed?.linkCodes && typeof parsed.linkCodes === 'object' ? parsed.linkCodes : {},
        meta: parsed?.meta && typeof parsed.meta === 'object' ? parsed.meta : {},
        tickets: parsed?.tickets && typeof parsed.tickets === 'object' ? parsed.tickets : {},
        notes: parsed?.notes && typeof parsed.notes === 'object' ? parsed.notes : {},
        rules: parsed?.rules && typeof parsed.rules === 'object' ? parsed.rules : {},
        workflows: parsed?.workflows && typeof parsed.workflows === 'object' ? parsed.workflows : {},
        notifications: parsed?.notifications && typeof parsed.notifications === 'object' ? parsed.notifications : {},
        activity: parsed?.activity && typeof parsed.activity === 'object' ? parsed.activity : {},
        gamification: parsed?.gamification && typeof parsed.gamification === 'object' ? parsed.gamification : {}
      };
    } catch {
      return { ...DEFAULT_STATE };
    }
  }

  save() {
    const tmp = `${this.filePath}.tmp`;
    fs.writeFileSync(tmp, `${JSON.stringify(this.state, null, 2)}\n`, 'utf8');
    fs.renameSync(tmp, this.filePath);
  }

  pruneOverflow() {
    let changed = false;
    for (const [telegramUserId, notes] of Object.entries(this.state.notes)) {
      if (!Array.isArray(notes)) {
        this.state.notes[telegramUserId] = [];
        changed = true;
        continue;
      }
      if (notes.length > MAX_NOTES_PER_USER) {
        this.state.notes[telegramUserId] = notes.slice(-MAX_NOTES_PER_USER);
        changed = true;
      }
    }

    const ticketEntries = Object.entries(this.state.tickets);
    if (ticketEntries.length > MAX_TICKETS) {
      ticketEntries.sort((a, b) => String(a[1]?.createdAt || '').localeCompare(String(b[1]?.createdAt || '')));
      const toDrop = ticketEntries.length - MAX_TICKETS;
      for (let i = 0; i < toDrop; i += 1) {
        delete this.state.tickets[ticketEntries[i][0]];
      }
      changed = true;
    }

    const notifEntries = Object.entries(this.state.notifications);
    if (notifEntries.length > MAX_NOTIFICATIONS) {
      notifEntries.sort((a, b) => String(a[1]?.createdAt || '').localeCompare(String(b[1]?.createdAt || '')));
      const toDrop = notifEntries.length - MAX_NOTIFICATIONS;
      for (let i = 0; i < toDrop; i += 1) {
        delete this.state.notifications[notifEntries[i][0]];
      }
      changed = true;
    }

    if (changed) this.save();
  }

  ensureUserCollections(telegramUserId) {
    const key = String(telegramUserId || '').trim();
    if (!key) return;
    if (!Array.isArray(this.state.notes[key])) this.state.notes[key] = [];
    if (!Array.isArray(this.state.rules[key])) this.state.rules[key] = [];
    if (!Array.isArray(this.state.workflows[key])) this.state.workflows[key] = [];
    if (!this.state.activity[key] || typeof this.state.activity[key] !== 'object') {
      this.state.activity[key] = {
        events: [],
        counters: {},
        lastActiveAt: null
      };
    }
    if (!this.state.gamification[key] || typeof this.state.gamification[key] !== 'object') {
      this.state.gamification[key] = {
        xp: 0,
        level: 1,
        streakDays: 0,
        lastActionDate: '',
        badges: []
      };
    }
  }

  getMeta(key, fallback = null) {
    const k = String(key || '').trim();
    if (!k) return fallback;
    if (!Object.prototype.hasOwnProperty.call(this.state.meta, k)) return fallback;
    return this.state.meta[k];
  }

  setMeta(key, value) {
    const k = String(key || '').trim();
    if (!k) return;
    this.state.meta[k] = value;
    this.save();
  }

  listKnownUserIds() {
    const set = new Set();
    for (const key of Object.keys(this.state.users)) set.add(String(key));
    for (const key of Object.keys(this.state.links)) set.add(String(key));
    for (const key of Object.keys(this.state.notes)) set.add(String(key));
    for (const key of Object.keys(this.state.rules)) set.add(String(key));
    for (const key of Object.keys(this.state.workflows)) set.add(String(key));
    for (const key of Object.keys(this.state.activity)) set.add(String(key));
    return Array.from(set.values());
  }

  pruneExpiredCodes(nowMs = Date.now()) {
    let changed = false;
    for (const [code, row] of Object.entries(this.state.linkCodes)) {
      const expiresAt = Number(row?.expiresAt || 0);
      if (!expiresAt || expiresAt <= nowMs) {
        delete this.state.linkCodes[code];
        changed = true;
      }
    }
    if (changed) this.save();
  }

  getUserState(telegramUserId) {
    const key = String(telegramUserId || '').trim();
    const row = this.state.users[key];
    if (!row) {
      return {
        mode: 'idle',
        topic: '',
        updatedAt: new Date(0).toISOString(),
        draft: {},
        lang: '',
        langSource: 'auto'
      };
    }
    return {
      mode: String(row.mode || 'idle'),
      topic: String(row.topic || ''),
      updatedAt: String(row.updatedAt || new Date(0).toISOString()),
      draft: row.draft && typeof row.draft === 'object' ? row.draft : {},
      lang: String(row.lang || ''),
      langSource: String(row.langSource || 'auto')
    };
  }

  setUserState(telegramUserId, patch) {
    const key = String(telegramUserId || '').trim();
    const current = this.getUserState(key);
    this.state.users[key] = {
      ...current,
      ...patch,
      updatedAt: nowIso()
    };
    this.save();
    return this.state.users[key];
  }

  clearUserState(telegramUserId) {
    const key = String(telegramUserId || '').trim();
    const current = this.getUserState(key);
    this.state.users[key] = {
      mode: 'idle',
      topic: '',
      draft: {},
      lang: String(current.lang || ''),
      langSource: String(current.langSource || 'auto'),
      updatedAt: nowIso()
    };
    this.save();
    return this.state.users[key];
  }

  getLink(telegramUserId) {
    return this.state.links[String(telegramUserId)] || null;
  }

  setLink(telegramUserId, link) {
    const key = String(telegramUserId || '').trim();
    this.state.links[key] = {
      telegramUserId: key,
      appUserId: String(link.appUserId || '').trim(),
      email: String(link.email || '').trim() || null,
      linkedAt: nowIso()
    };
    this.logActivity(key, 'account_linked', {
      appUserId: this.state.links[key].appUserId
    });
    this.save();
    return this.state.links[key];
  }

  unlink(telegramUserId) {
    const key = String(telegramUserId || '').trim();
    if (this.state.links[key]) {
      delete this.state.links[key];
      this.save();
    }
  }

  createLinkCode(telegramUserId, ttlSec = 600) {
    const key = String(telegramUserId || '').trim();
    this.pruneExpiredCodes();

    for (const [code, row] of Object.entries(this.state.linkCodes)) {
      if (
        String(row?.telegramUserId || '') === key
        && String(row?.codeType || '') === 'telegram_to_site'
      ) {
        delete this.state.linkCodes[code];
      }
    }

    let code = '';
    do {
      code = crypto.randomBytes(4).toString('hex').toUpperCase();
    } while (this.state.linkCodes[code]);

    const now = Date.now();
    const ttlMs = Math.max(60, Number(ttlSec || 600)) * 1000;
    this.state.linkCodes[code] = {
      codeType: 'telegram_to_site',
      telegramUserId: key,
      createdAt: new Date(now).toISOString(),
      expiresAt: now + ttlMs
    };
    this.save();
    return {
      code,
      expiresAt: new Date(now + ttlMs).toISOString()
    };
  }

  registerExternalLinkCode({ code, appUserId, email, ttlSec = 600 }) {
    this.pruneExpiredCodes();
    const normalizedCode = String(code || '').trim().toUpperCase();
    if (!normalizedCode) {
      return { ok: false, code: 'MISSING_CODE', message: 'Code is required' };
    }
    if (!LINK_CODE_PATTERN.test(normalizedCode)) {
      return { ok: false, code: 'INVALID_CODE_FORMAT', message: 'Code format is invalid' };
    }

    const normalizedAppUserId = String(appUserId || '').trim();
    if (!normalizedAppUserId) {
      return { ok: false, code: 'MISSING_APP_USER_ID', message: 'app_user_id is required' };
    }

    const now = Date.now();
    const ttlMs = Math.max(60, Number(ttlSec || 600)) * 1000;
    this.state.linkCodes[normalizedCode] = {
      codeType: 'site_to_telegram',
      appUserId: normalizedAppUserId,
      email: String(email || '').trim() || null,
      createdAt: new Date(now).toISOString(),
      expiresAt: now + ttlMs
    };
    this.save();

    return {
      ok: true,
      code: normalizedCode,
      expiresAt: new Date(now + ttlMs).toISOString()
    };
  }

  consumeLinkCode(code, { appUserId, email }) {
    this.pruneExpiredCodes();
    const normalizedCode = String(code || '').trim().toUpperCase();
    if (!normalizedCode) {
      return { ok: false, code: 'MISSING_CODE', message: 'Code is required' };
    }
    const row = this.state.linkCodes[normalizedCode];
    if (!row) {
      return { ok: false, code: 'INVALID_CODE', message: 'Code is invalid or expired' };
    }
    if (String(row.codeType || '') !== 'telegram_to_site') {
      return { ok: false, code: 'WRONG_CODE_TYPE', message: 'This code must be entered in Telegram bot' };
    }

    const telegramUserId = String(row.telegramUserId || '').trim();
    const normalizedAppUserId = String(appUserId || '').trim();
    if (!normalizedAppUserId) {
      return { ok: false, code: 'MISSING_APP_USER_ID', message: 'app_user_id is required' };
    }

    const link = this.setLink(telegramUserId, {
      appUserId: normalizedAppUserId,
      email: String(email || '').trim() || null
    });
    delete this.state.linkCodes[normalizedCode];
    this.save();
    return {
      ok: true,
      telegramUserId,
      link
    };
  }

  claimLinkCodeByTelegram(code, telegramUserId) {
    this.pruneExpiredCodes();
    const normalizedCode = String(code || '').trim().toUpperCase();
    if (!normalizedCode) {
      return { ok: false, code: 'MISSING_CODE', message: 'Code is required' };
    }
    const row = this.state.linkCodes[normalizedCode];
    if (!row) {
      return { ok: false, code: 'INVALID_CODE', message: 'Code is invalid or expired' };
    }

    const tgId = String(telegramUserId || '').trim();
    if (!tgId) {
      return { ok: false, code: 'MISSING_TELEGRAM_ID', message: 'telegram user id is required' };
    }

    const codeType = String(row.codeType || '');
    if (codeType === 'telegram_to_site') {
      const ownerTgId = String(row.telegramUserId || '').trim();
      if (ownerTgId && ownerTgId !== tgId) {
        return { ok: false, code: 'CODE_OWNERSHIP_MISMATCH', message: 'Code belongs to another Telegram user' };
      }
      return { ok: false, code: 'WRONG_CODE_DIRECTION', message: 'This code must be entered on website' };
    }

    const appUserId = String(row.appUserId || '').trim();
    if (!appUserId) {
      return { ok: false, code: 'BROKEN_CODE', message: 'Code payload is invalid' };
    }

    const link = this.setLink(tgId, {
      appUserId,
      email: String(row.email || '').trim() || null
    });
    delete this.state.linkCodes[normalizedCode];
    this.save();
    return {
      ok: true,
      telegramUserId: tgId,
      link
    };
  }

  getGamification(telegramUserId) {
    const key = String(telegramUserId || '').trim();
    this.ensureUserCollections(key);
    const row = this.state.gamification[key];
    return {
      xp: Number(row?.xp || 0),
      level: Number(row?.level || 1),
      streakDays: Number(row?.streakDays || 0),
      lastActionDate: String(row?.lastActionDate || ''),
      badges: Array.isArray(row?.badges) ? row.badges : []
    };
  }

  logActivity(telegramUserId, eventType, payload = {}) {
    const key = String(telegramUserId || '').trim();
    if (!key) return { newBadges: [] };
    const type = String(eventType || '').trim() || 'event';
    this.ensureUserCollections(key);

    const activity = this.state.activity[key];
    const gamification = this.state.gamification[key];
    const now = nowIso();

    activity.events.push({
      type,
      payload: payload && typeof payload === 'object' ? payload : {},
      at: now
    });
    if (activity.events.length > MAX_EVENTS_PER_USER) {
      activity.events = activity.events.slice(-MAX_EVENTS_PER_USER);
    }
    activity.counters[type] = Number(activity.counters[type] || 0) + 1;
    activity.lastActiveAt = now;

    const xpGain = Number(EVENT_XP[type] || 1);
    gamification.xp = Number(gamification.xp || 0) + xpGain;
    gamification.level = Math.max(1, Math.floor(gamification.xp / 100) + 1);

    const todayKey = toDateKey(now);
    const previous = String(gamification.lastActionDate || '');
    const delta = diffDays(previous, todayKey);
    if (!previous) {
      gamification.streakDays = 1;
    } else if (delta === 1) {
      gamification.streakDays = Number(gamification.streakDays || 0) + 1;
    } else if (delta > 1) {
      gamification.streakDays = 1;
    }
    gamification.lastActionDate = todayKey;

    const knownBadges = new Set(
      Array.isArray(gamification.badges) ? gamification.badges.map((item) => String(item?.id || '')) : []
    );
    const context = {
      counters: activity.counters,
      level: gamification.level
    };
    const newBadges = [];
    for (const badge of BADGES) {
      if (knownBadges.has(badge.id)) continue;
      if (badge.check(context)) {
        const earned = {
          id: badge.id,
          title: badge.title,
          earnedAt: now
        };
        if (!Array.isArray(gamification.badges)) gamification.badges = [];
        gamification.badges.push(earned);
        newBadges.push(earned);
      }
    }

    this.save();
    return {
      xpGain,
      level: gamification.level,
      streakDays: gamification.streakDays,
      newBadges
    };
  }

  getActivitySummary(telegramUserId) {
    const key = String(telegramUserId || '').trim();
    this.ensureUserCollections(key);
    const activity = this.state.activity[key];
    const events = Array.isArray(activity.events) ? activity.events : [];
    const now = Date.now();
    const sevenDaysAgo = now - (7 * 86400000);
    const oneDayAgo = now - 86400000;
    let last24h = 0;
    let last7d = 0;
    for (const event of events) {
      const ts = new Date(event.at).getTime();
      if (Number.isNaN(ts)) continue;
      if (ts >= oneDayAgo) last24h += 1;
      if (ts >= sevenDaysAgo) last7d += 1;
    }
    return {
      totalEvents: events.length,
      last24h,
      last7d,
      counters: activity.counters || {},
      lastActiveAt: activity.lastActiveAt || null
    };
  }

  createTicket({ telegramUserId, kind = 'support', message, fromDisplay = '' }) {
    const userId = String(telegramUserId || '').trim();
    if (!userId) return { ok: false, code: 'MISSING_TELEGRAM_ID' };
    const text = String(message || '').trim();
    if (!text) return { ok: false, code: 'MISSING_MESSAGE' };
    const ticketId = safeRandomId('T');
    const createdAt = nowIso();
    const row = {
      id: ticketId,
      telegramUserId: userId,
      kind: String(kind || 'support'),
      status: 'open',
      priority: 'normal',
      createdAt,
      updatedAt: createdAt,
      fromDisplay: String(fromDisplay || '').trim() || null,
      messages: [
        {
          id: safeRandomId('M'),
          authorType: 'user',
          authorId: userId,
          text,
          createdAt
        }
      ],
      events: [
        {
          type: 'created',
          at: createdAt,
          by: userId
        }
      ]
    };
    this.state.tickets[ticketId] = row;
    this.logActivity(userId, 'ticket_created', { ticketId, kind: row.kind });
    this.save();
    return { ok: true, ticket: row };
  }

  getTicket(ticketId) {
    const key = String(ticketId || '').trim();
    if (!key) return null;
    return this.state.tickets[key] || null;
  }

  listUserTickets(telegramUserId, { status = '', limit = 10 } = {}) {
    const userId = String(telegramUserId || '').trim();
    const normalizedStatus = String(status || '').trim();
    return Object.values(this.state.tickets)
      .filter((row) => String(row?.telegramUserId || '') === userId)
      .filter((row) => !normalizedStatus || String(row?.status || '') === normalizedStatus)
      .sort((a, b) => String(b?.createdAt || '').localeCompare(String(a?.createdAt || '')))
      .slice(0, Math.max(1, Number(limit || 10)));
  }

  listOpenTickets(limit = 20) {
    return Object.values(this.state.tickets)
      .filter((row) => String(row?.status || '') !== 'closed')
      .sort((a, b) => String(b?.updatedAt || '').localeCompare(String(a?.updatedAt || '')))
      .slice(0, Math.max(1, Number(limit || 20)));
  }

  addTicketMessage(ticketId, { authorType = 'support', authorId = '', text = '', photoFileId = '' }) {
    const row = this.getTicket(ticketId);
    if (!row) return { ok: false, code: 'TICKET_NOT_FOUND' };
    const createdAt = nowIso();
    const message = {
      id: safeRandomId('M'),
      authorType: String(authorType || 'support'),
      authorId: String(authorId || '').trim() || null,
      text: String(text || '').trim() || null,
      photoFileId: String(photoFileId || '').trim() || null,
      createdAt
    };
    if (!Array.isArray(row.messages)) row.messages = [];
    row.messages.push(message);
    row.updatedAt = createdAt;
    if (row.status === 'closed') row.status = 'open';
    if (!Array.isArray(row.events)) row.events = [];
    row.events.push({
      type: 'message',
      at: createdAt,
      by: message.authorType
    });
    this.save();
    return { ok: true, ticket: row, message };
  }

  setTicketStatus(ticketId, status, actorId = '') {
    const row = this.getTicket(ticketId);
    if (!row) return { ok: false, code: 'TICKET_NOT_FOUND' };
    const normalized = String(status || '').trim().toLowerCase();
    if (!['open', 'pending', 'resolved', 'closed'].includes(normalized)) {
      return { ok: false, code: 'INVALID_STATUS' };
    }
    row.status = normalized;
    row.updatedAt = nowIso();
    if (!Array.isArray(row.events)) row.events = [];
    row.events.push({
      type: 'status',
      status: normalized,
      at: row.updatedAt,
      by: String(actorId || '').trim() || null
    });
    this.logActivity(String(row.telegramUserId || ''), 'ticket_status_changed', { ticketId: row.id, status: normalized });
    this.save();
    return { ok: true, ticket: row };
  }

  addNote(telegramUserId, { text, tags = [] }) {
    const userId = String(telegramUserId || '').trim();
    const body = String(text || '').trim();
    if (!userId || !body) return { ok: false, code: 'INVALID_INPUT' };
    this.ensureUserCollections(userId);
    const now = nowIso();
    const note = {
      id: safeRandomId('N'),
      text: body,
      tags: uniqueCompactStringList(tags),
      createdAt: now,
      updatedAt: now
    };
    this.state.notes[userId].push(note);
    if (this.state.notes[userId].length > MAX_NOTES_PER_USER) {
      this.state.notes[userId] = this.state.notes[userId].slice(-MAX_NOTES_PER_USER);
    }
    this.logActivity(userId, 'note_created', { noteId: note.id });
    this.save();
    return { ok: true, note };
  }

  listNotes(telegramUserId, { query = '', tag = '', limit = 20 } = {}) {
    const userId = String(telegramUserId || '').trim();
    this.ensureUserCollections(userId);
    const q = String(query || '').trim().toLowerCase();
    const t = String(tag || '').trim().toLowerCase();
    return this.state.notes[userId]
      .filter((note) => !q || String(note.text || '').toLowerCase().includes(q))
      .filter((note) => !t || (Array.isArray(note.tags) && note.tags.includes(t)))
      .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))
      .slice(0, Math.max(1, Number(limit || 20)));
  }

  deleteNote(telegramUserId, noteId) {
    const userId = String(telegramUserId || '').trim();
    const targetId = String(noteId || '').trim();
    this.ensureUserCollections(userId);
    const before = this.state.notes[userId].length;
    this.state.notes[userId] = this.state.notes[userId].filter((note) => String(note.id || '') !== targetId);
    const changed = this.state.notes[userId].length !== before;
    if (changed) {
      this.logActivity(userId, 'note_deleted', { noteId: targetId });
      this.save();
    }
    return changed;
  }

  addRule(telegramUserId, rule) {
    const userId = String(telegramUserId || '').trim();
    this.ensureUserCollections(userId);
    const row = {
      id: safeRandomId('R'),
      name: String(rule?.name || 'Новая автоматизация'),
      trigger: String(rule?.trigger || 'manual'),
      condition: rule?.condition && typeof rule.condition === 'object' ? rule.condition : {},
      action: rule?.action && typeof rule.action === 'object' ? rule.action : { type: 'notify', template: 'Условие выполнено.' },
      enabled: rule?.enabled !== false,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      lastFiredAt: null,
      fireCount: 0
    };
    this.state.rules[userId].push(row);
    this.logActivity(userId, 'rule_created', { ruleId: row.id, trigger: row.trigger });
    this.save();
    return row;
  }

  listRules(telegramUserId) {
    const userId = String(telegramUserId || '').trim();
    this.ensureUserCollections(userId);
    return [...this.state.rules[userId]]
      .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
  }

  toggleRule(telegramUserId, ruleId, enabled) {
    const userId = String(telegramUserId || '').trim();
    this.ensureUserCollections(userId);
    const id = String(ruleId || '').trim();
    const row = this.state.rules[userId].find((item) => String(item.id || '') === id);
    if (!row) return null;
    row.enabled = Boolean(enabled);
    row.updatedAt = nowIso();
    this.save();
    return row;
  }

  deleteRule(telegramUserId, ruleId) {
    const userId = String(telegramUserId || '').trim();
    this.ensureUserCollections(userId);
    const id = String(ruleId || '').trim();
    const before = this.state.rules[userId].length;
    this.state.rules[userId] = this.state.rules[userId].filter((item) => String(item.id || '') !== id);
    const changed = before !== this.state.rules[userId].length;
    if (changed) this.save();
    return changed;
  }

  markRuleFired(telegramUserId, ruleId) {
    const userId = String(telegramUserId || '').trim();
    this.ensureUserCollections(userId);
    const id = String(ruleId || '').trim();
    const row = this.state.rules[userId].find((item) => String(item.id || '') === id);
    if (!row) return null;
    row.lastFiredAt = nowIso();
    row.fireCount = Number(row.fireCount || 0) + 1;
    row.updatedAt = nowIso();
    this.logActivity(userId, 'rule_triggered', { ruleId: id });
    this.save();
    return row;
  }

  addWorkflow(telegramUserId, workflow) {
    const userId = String(telegramUserId || '').trim();
    this.ensureUserCollections(userId);
    const row = {
      id: safeRandomId('W'),
      name: String(workflow?.name || 'Workflow'),
      steps: Array.isArray(workflow?.steps) ? workflow.steps : [],
      enabled: workflow?.enabled !== false,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      runCount: 0,
      lastRunAt: null
    };
    this.state.workflows[userId].push(row);
    this.logActivity(userId, 'workflow_created', { workflowId: row.id });
    this.save();
    return row;
  }

  listWorkflows(telegramUserId) {
    const userId = String(telegramUserId || '').trim();
    this.ensureUserCollections(userId);
    return [...this.state.workflows[userId]]
      .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
  }

  toggleWorkflow(telegramUserId, workflowId, enabled) {
    const userId = String(telegramUserId || '').trim();
    this.ensureUserCollections(userId);
    const id = String(workflowId || '').trim();
    const row = this.state.workflows[userId].find((item) => String(item.id || '') === id);
    if (!row) return null;
    row.enabled = Boolean(enabled);
    row.updatedAt = nowIso();
    this.save();
    return row;
  }

  markWorkflowRun(telegramUserId, workflowId) {
    const userId = String(telegramUserId || '').trim();
    this.ensureUserCollections(userId);
    const id = String(workflowId || '').trim();
    const row = this.state.workflows[userId].find((item) => String(item.id || '') === id);
    if (!row) return null;
    row.runCount = Number(row.runCount || 0) + 1;
    row.lastRunAt = nowIso();
    row.updatedAt = nowIso();
    this.logActivity(userId, 'workflow_executed', { workflowId: id });
    this.save();
    return row;
  }

  deleteWorkflow(telegramUserId, workflowId) {
    const userId = String(telegramUserId || '').trim();
    this.ensureUserCollections(userId);
    const id = String(workflowId || '').trim();
    const before = this.state.workflows[userId].length;
    this.state.workflows[userId] = this.state.workflows[userId].filter((item) => String(item.id || '') !== id);
    const changed = before !== this.state.workflows[userId].length;
    if (changed) this.save();
    return changed;
  }

  queueNotification({ telegramUserId, kind = 'info', title = '', message = '', scheduledAt = nowIso(), meta = {} }) {
    const userId = String(telegramUserId || '').trim();
    if (!userId) return null;
    const row = {
      id: safeRandomId('NTF'),
      telegramUserId: userId,
      kind: String(kind || 'info'),
      title: String(title || '').trim() || null,
      message: String(message || '').trim(),
      status: 'pending',
      createdAt: nowIso(),
      scheduledAt: new Date(scheduledAt).toISOString(),
      sentAt: null,
      meta: meta && typeof meta === 'object' ? meta : {}
    };
    this.state.notifications[row.id] = row;
    this.pruneOverflow();
    this.save();
    return row;
  }

  popDueNotifications({ now = Date.now(), limit = 30 } = {}) {
    const due = Object.values(this.state.notifications)
      .filter((row) => String(row?.status || '') === 'pending')
      .filter((row) => {
        const ts = new Date(row.scheduledAt).getTime();
        if (Number.isNaN(ts)) return false;
        return ts <= now;
      })
      .sort((a, b) => String(a.scheduledAt || '').localeCompare(String(b.scheduledAt || '')))
      .slice(0, Math.max(1, Number(limit || 30)));
    if (due.length === 0) return [];
    const sentAt = nowIso();
    for (const item of due) {
      const row = this.state.notifications[item.id];
      if (!row) continue;
      row.status = 'sent';
      row.sentAt = sentAt;
    }
    this.save();
    return due;
  }

  listNotifications(telegramUserId, limit = 20) {
    const userId = String(telegramUserId || '').trim();
    return Object.values(this.state.notifications)
      .filter((row) => String(row?.telegramUserId || '') === userId)
      .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
      .slice(0, Math.max(1, Number(limit || 20)));
  }

  getAssistantInsights(telegramUserId) {
    const userId = String(telegramUserId || '').trim();
    const activity = this.getActivitySummary(userId);
    const game = this.getGamification(userId);
    const notesCount = this.listNotes(userId, { limit: 9999 }).length;
    const rules = this.listRules(userId);
    const workflows = this.listWorkflows(userId);
    const openTickets = this.listUserTickets(userId, { status: 'open', limit: 50 }).length;

    const insights = [];
    if (openTickets > 0) {
      insights.push(`У вас ${openTickets} открытых тикетов — закройте ненужные, чтобы не терять контекст.`);
    }
    if (rules.length === 0) {
      insights.push('Добавьте минимум одно правило автоматизации, чтобы получать умные уведомления.');
    }
    if (notesCount < 3) {
      insights.push('Создайте заметки в Data Vault: так проще хранить кейсы и ответы поддержки.');
    }
    if (activity.last7d < 5) {
      insights.push('Активность за 7 дней низкая. Включите ежедневный дайджест, чтобы вернуться в ритм.');
    }
    if (workflows.length === 0) {
      insights.push('Создайте workflow для повторяющихся задач (например, контроль trial и лимитов).');
    }
    if (insights.length === 0) {
      insights.push('Все выглядит хорошо. Следующий шаг: оптимизируйте правила по частоте срабатывания.');
    }

    return {
      activity,
      gamification: game,
      rulesCount: rules.length,
      workflowsCount: workflows.length,
      notesCount,
      insights
    };
  }
}

module.exports = {
  JsonStore
};
