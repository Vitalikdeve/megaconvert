const { Markup } = require('telegraf');

const BUTTON_KEYS = {
  SUPPORT: 'SUPPORT',
  ACCOUNT: 'ACCOUNT',
  PLAN: 'PLAN',
  ISSUE: 'ISSUE',
  MESSAGE: 'MESSAGE',
  HELP: 'HELP',
  LINK: 'LINK',
  UNLINK: 'UNLINK',
  BACK: 'BACK',
  TICKETS: 'TICKETS',
  CONVERTERS: 'CONVERTERS',
  LANGUAGE: 'LANGUAGE',
  ASSISTANT: 'ASSISTANT',

  NEW_TICKET: 'NEW_TICKET',
  MY_TICKETS: 'MY_TICKETS',
  CLOSE_TICKET: 'CLOSE_TICKET'
};

const KEYBOARD_LAYOUTS = {
  mainKeyboard: [
    [BUTTON_KEYS.SUPPORT, BUTTON_KEYS.MESSAGE],
    [BUTTON_KEYS.ACCOUNT, BUTTON_KEYS.PLAN],
    [BUTTON_KEYS.CONVERTERS, BUTTON_KEYS.TICKETS],
    [BUTTON_KEYS.ASSISTANT, BUTTON_KEYS.LANGUAGE],
    [BUTTON_KEYS.HELP]
  ],
  linkKeyboard: [
    [BUTTON_KEYS.LINK, BUTTON_KEYS.BACK]
  ],
  supportKeyboard: [
    [BUTTON_KEYS.MESSAGE, BUTTON_KEYS.ISSUE],
    [BUTTON_KEYS.BACK]
  ],
  helpKeyboard: [
    [BUTTON_KEYS.SUPPORT, BUTTON_KEYS.CONVERTERS],
    [BUTTON_KEYS.BACK]
  ],
  planKeyboard: [
    [BUTTON_KEYS.PLAN],
    [BUTTON_KEYS.BACK]
  ],
  linkedAccountKeyboard: [
    [BUTTON_KEYS.ACCOUNT, BUTTON_KEYS.PLAN],
    [BUTTON_KEYS.CONVERTERS, BUTTON_KEYS.TICKETS],
    [BUTTON_KEYS.ASSISTANT, BUTTON_KEYS.LANGUAGE],
    [BUTTON_KEYS.SUPPORT, BUTTON_KEYS.MESSAGE],
    [BUTTON_KEYS.UNLINK, BUTTON_KEYS.BACK]
  ],
  ticketsKeyboard: [
    [BUTTON_KEYS.NEW_TICKET, BUTTON_KEYS.MY_TICKETS],
    [BUTTON_KEYS.CLOSE_TICKET, BUTTON_KEYS.BACK]
  ]
};

const LANGUAGE_CHOICES = [
  { code: 'en', label: 'English' },
  { code: 'ru', label: 'Русский' },
  { code: 'es', label: 'Español' },
  { code: 'de', label: 'Deutsch' },
  { code: 'fr', label: 'Français' },
  { code: 'zh', label: '中文' },
  { code: 'ar', label: 'العربية' },
  { code: 'pt', label: 'Português' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'ja', label: '日本語' },
  { code: 'ko', label: '한국어' },
  { code: 'tr', label: 'Türkçe' }
];

const toButtonLabel = (buttonKey, t) => t(`buttons.${buttonKey}`);

const buildReplyKeyboard = (rows, t) => Markup.keyboard(
  rows.map((row) => row.map((buttonKey) => toButtonLabel(buttonKey, t)))
).resize();

const buildKeyboards = (t) => {
  const out = {};
  for (const [keyboardName, rows] of Object.entries(KEYBOARD_LAYOUTS)) {
    out[keyboardName] = buildReplyKeyboard(rows, t);
  }
  return out;
};

const getButtonLabelMap = (t) => {
  const out = {};
  for (const buttonKey of Object.values(BUTTON_KEYS)) {
    out[buttonKey] = toButtonLabel(buttonKey, t);
  }
  return out;
};

const buildLanguageKeyboard = (selectedCode = '', closeLabel = 'Close') => {
  const rows = [];
  for (let i = 0; i < LANGUAGE_CHOICES.length; i += 2) {
    const left = LANGUAGE_CHOICES[i];
    const right = LANGUAGE_CHOICES[i + 1];
    const buttons = [];
    const leftLabel = left.code === selectedCode ? `✅ ${left.label}` : left.label;
    buttons.push(Markup.button.callback(leftLabel, `lang:set:${left.code}`));
    if (right) {
      const rightLabel = right.code === selectedCode ? `✅ ${right.label}` : right.label;
      buttons.push(Markup.button.callback(rightLabel, `lang:set:${right.code}`));
    }
    rows.push(buttons);
  }
  rows.push([Markup.button.callback(closeLabel, 'lang:close')]);
  return Markup.inlineKeyboard(rows);
};

module.exports = {
  BUTTON_KEYS,
  LANGUAGE_CHOICES,
  buildKeyboards,
  getButtonLabelMap,
  buildLanguageKeyboard
};
