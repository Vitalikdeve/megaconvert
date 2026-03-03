const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'data');
const storePath = path.join(dataDir, 'store.json');

const ensureStore = () => {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(storePath)) {
    fs.writeFileSync(storePath, JSON.stringify({
      shares: {},
      history: [],
      job_events: [],
      developers: [],
      api_keys: [],
      presets: [],
      workflows: [],
      platform_settings: {
        feature_flags: {
          smart_auto_convert: true,
          public_share_links: true,
          instant_preview: true,
          transparency_panel: true
        }
      },
      audit_logs: [],
      worker: {
        last_ping_at: 0,
        status: 'unknown'
      }
    }, null, 2));
  }
};

const readStore = () => {
  ensureStore();
  try {
    const raw = fs.readFileSync(storePath, 'utf-8');
    const parsed = JSON.parse(raw);
    return {
      shares: parsed.shares || {},
      history: Array.isArray(parsed.history) ? parsed.history : [],
      job_events: Array.isArray(parsed.job_events) ? parsed.job_events : [],
      developers: Array.isArray(parsed.developers) ? parsed.developers : [],
      api_keys: Array.isArray(parsed.api_keys) ? parsed.api_keys : [],
      presets: Array.isArray(parsed.presets) ? parsed.presets : [],
      workflows: Array.isArray(parsed.workflows) ? parsed.workflows : [],
      platform_settings: parsed.platform_settings && typeof parsed.platform_settings === 'object'
        ? parsed.platform_settings
        : {
            feature_flags: {
              smart_auto_convert: true,
              public_share_links: true,
              instant_preview: true,
              transparency_panel: true
            }
          },
      audit_logs: Array.isArray(parsed.audit_logs) ? parsed.audit_logs : [],
      worker: parsed.worker && typeof parsed.worker === 'object'
        ? parsed.worker
        : { last_ping_at: 0, status: 'unknown' }
    };
  } catch (error) {
    return {
      shares: {},
      history: [],
      job_events: [],
      developers: [],
      api_keys: [],
      presets: [],
      workflows: [],
      platform_settings: {
        feature_flags: {
          smart_auto_convert: true,
          public_share_links: true,
          instant_preview: true,
          transparency_panel: true
        }
      },
      audit_logs: [],
      worker: { last_ping_at: 0, status: 'unknown' }
    };
  }
};

const writeStore = (next) => {
  ensureStore();
  fs.writeFileSync(storePath, JSON.stringify(next, null, 2));
};

module.exports = { readStore, writeStore };
