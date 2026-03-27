import { API_URL } from '../config/api.js';

const buildUrl = (path) => `${API_URL}${path}`;

const normalizeUsernameCredential = (credentials) =>
  String(credentials?.username ?? credentials?.email ?? '').trim();

const parseResponse = async (response) => {
  const text = await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
};

const request = async (path, options = {}) => {
  const response = await fetch(buildUrl(path), {
    headers: {
      'Content-Type': 'application/json',
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...options.headers,
    },
    method: options.method ?? 'GET',
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const payload = await parseResponse(response);

  if (!response.ok || payload?.error) {
    throw new Error(
      payload?.message ??
        payload?.error ??
        `Request failed with status ${response.status}`
    );
  }

  return payload;
};

export const registerUser = (credentials) => {
  const username = normalizeUsernameCredential(credentials);

  return request('/api/auth/register', {
    method: 'POST',
    body: {
      email: username,
      name: username,
      password: credentials?.password ?? '',
      username,
    },
  });
};

export const loginUser = (credentials) => {
  const username = normalizeUsernameCredential(credentials);

  return request('/api/auth/login', {
    method: 'POST',
    body: {
      email: username,
      password: credentials?.password ?? '',
      username,
    },
  });
};

export const fetchUsers = (token) =>
  request('/api/users', {
    token,
  });

export const fetchChatMessages = (chatId, token) =>
  request(`/api/messages?chatId=${encodeURIComponent(chatId)}`, {
    token,
  });

export const sendChatMessage = ({ attachments = [], chatId, clientMessageId, text }, token) =>
  request('/api/messages', {
    method: 'POST',
    token,
    body: {
      attachments,
      chatId,
      clientMessageId,
      text,
    },
  });

export const createLiveKitToken = ({ roomId, token, username }) =>
  request(
    `/api/livekit-token?room=${encodeURIComponent(roomId)}&username=${encodeURIComponent(
      username
    )}`,
    {
      token,
    }
  );
