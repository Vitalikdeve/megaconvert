import { API_URL } from '../config/api.js';

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
  const response = await fetch(`${API_URL}${path}`, {
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

export const registerUser = (credentials) =>
  request('/register', {
    method: 'POST',
    body: credentials,
  });

export const loginUser = (credentials) =>
  request('/login', {
    method: 'POST',
    body: credentials,
  });

export const fetchUsers = (token) =>
  request('/users', {
    token,
  });
