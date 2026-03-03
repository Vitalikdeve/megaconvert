import { storageGetJson, storageSetJson } from '../lib/localStorage';

const STORE_KEY = 'mc_app_state_v1';

const initialState = {
  jobState: {
    status: 'idle',
    progress: 0,
    lastJobId: null
  },
  userPreferences: {
    locale: 'en',
    aiMode: 'balanced',
    aiPriority: 'quality'
  },
  aiSuggestions: [],
  history: []
};

let state = {
  ...initialState,
  ...storageGetJson(STORE_KEY, {})
};

const listeners = new Set();

const persist = () => {
  storageSetJson(STORE_KEY, state);
};

export const getAppState = () => state;

export const subscribeAppStore = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const setAppState = (partial) => {
  const next = typeof partial === 'function' ? partial(state) : partial;
  state = { ...state, ...next };
  persist();
  for (const listener of listeners) listener(state);
};

export const updateJobState = (patch) => {
  setAppState((prev) => ({
    jobState: {
      ...prev.jobState,
      ...patch
    }
  }));
};

export const updateUserPreferences = (patch) => {
  setAppState((prev) => ({
    userPreferences: {
      ...prev.userPreferences,
      ...patch
    }
  }));
};

export const updateAiSuggestions = (suggestions) => {
  setAppState({ aiSuggestions: Array.isArray(suggestions) ? suggestions : [] });
};

export const pushHistoryItem = (item) => {
  setAppState((prev) => ({
    history: [item, ...(prev.history || [])].slice(0, 100)
  }));
};

