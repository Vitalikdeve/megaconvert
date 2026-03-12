import {
  browserSupportsWebAuthn,
  platformAuthenticatorIsAvailable,
  startAuthentication,
  startRegistration
} from '@simplewebauthn/browser';
import { buildAuthEndpoint, parsePayload } from './authApi.js';

export const passkeysSupported = () => browserSupportsWebAuthn();

export const resolvePasskeyCapabilities = async () => {
  const supported = browserSupportsWebAuthn();
  if (!supported) {
    return {
      supported: false,
      platformAuthenticator: false
    };
  }

  try {
    const platformAuthenticator = await platformAuthenticatorIsAvailable();
    return {
      supported,
      platformAuthenticator
    };
  } catch {
    return {
      supported,
      platformAuthenticator: false
    };
  }
};

const getAuthHeaders = (token) => {
  const normalizedToken = String(token || '').trim();
  if (!normalizedToken) return {};
  return {
    Authorization: `Bearer ${normalizedToken}`
  };
};

const postJson = async (url, body, token = '') => {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(token)
    },
    credentials: 'include',
    body: JSON.stringify(body || {})
  });
  const payload = await parsePayload(response);
  if (!response.ok) {
    throw new Error(String(payload?.message || 'Request failed'));
  }
  return payload;
};

export const beginPasskeyRegistration = async ({
  apiBase,
  name,
  email,
  captchaToken = '',
  authToken = ''
}) => {
  const optionsPayload = await postJson(
    buildAuthEndpoint(apiBase, 'passkeys/register/options'),
    {
      name,
      email,
      captchaToken,
      turnstileToken: captchaToken,
      'cf-turnstile-response': captchaToken
    },
    authToken
  );

  const credential = await startRegistration({
    optionsJSON: optionsPayload.options
  });

  return postJson(
    buildAuthEndpoint(apiBase, 'passkeys/register/verify'),
    {
      sessionId: optionsPayload.sessionId,
      credential
    },
    authToken
  );
};

export const beginPasskeyAuthentication = async ({
  apiBase,
  email = ''
}) => {
  const optionsPayload = await postJson(
    buildAuthEndpoint(apiBase, 'passkeys/login/options'),
    {
      email
    }
  );

  const credential = await startAuthentication({
    optionsJSON: optionsPayload.options
  });

  return postJson(
    buildAuthEndpoint(apiBase, 'passkeys/login/verify'),
    {
      sessionId: optionsPayload.sessionId,
      credential
    }
  );
};
