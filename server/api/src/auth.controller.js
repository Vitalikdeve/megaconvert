const crypto = require('crypto');
const { Router } = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const { registerPasskeyRoutes } = require('./passkeys.controller');

const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const ACCESS_TOKEN_TTL = '1h';
const RESET_TOKEN_TTL = '1h';
const ACCESS_TOKEN_MAX_AGE_MS = 60 * 60 * 1000;
const RESET_LINK_BASE = (process.env.APP_BASE_URL || 'https://megaconvert-web.vercel.app').replace(/\/+$/g, '');
const SESSION_JWT_SECRET = process.env.JWT_SESSION_SECRET || process.env.JWT_SECRET || 'dev-session-secret-change-me';
const RESET_JWT_SECRET = process.env.JWT_RESET_SECRET || process.env.JWT_SECRET || 'dev-reset-secret-change-me';
const OAUTH_API_BASE = String(
  process.env.OAUTH_REDIRECT_BASE_URL || process.env.API_BASE_URL || 'https://35.202.253.153.nip.io'
).trim().replace(/\/+$/g, '');
const OAUTH_FRONTEND_CALLBACK = String(
  process.env.OAUTH_FRONTEND_CALLBACK_URL || 'https://megaconvert-web.vercel.app/auth/callback'
).trim();
const OAUTH_STATE_TTL_MS = Math.max(60 * 1000, Number(process.env.OAUTH_STATE_TTL_MS || 10 * 60 * 1000));
const OAUTH_SYNTHETIC_EMAIL_DOMAIN = String(
  process.env.OAUTH_SYNTHETIC_EMAIL_DOMAIN || 'oauth.megaconvert.local'
).trim() || 'oauth.megaconvert.local';
const OAUTH_STATE = new Map();

// Temporary in-memory storage until DB is connected.
const users = [];
const usedResetTokenIds = new Set();
let registrationTrialPool = null;
let registrationTrialPoolLoadAttempted = false;
let registrationTrialPoolInitError = null;

const normalizeEmail = (value) => String(value || '').trim().toLowerCase();
const normalizeOAuthProvider = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'twitter') return 'x';
  return normalized;
};

const createId = () => {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return crypto.randomBytes(16).toString('hex');
};

const getRegistrationTrialPool = () => {
  if (registrationTrialPool) return registrationTrialPool;
  if (registrationTrialPoolLoadAttempted) return null;

  registrationTrialPoolLoadAttempted = true;
  const connectionString = String(
    process.env.DATABASE_URL
      || process.env.POSTGRES_URL
      || process.env.POSTGRES_PRISMA_URL
      || ''
  ).trim();

  if (!connectionString) {
    return null;
  }

  try {
    const { Pool } = require('pg');
    registrationTrialPool = new Pool({ connectionString });
    registrationTrialPool.on('error', (error) => {
      console.error('[auth][trial] postgres pool error:', error);
    });
    return registrationTrialPool;
  } catch (error) {
    registrationTrialPoolInitError = error;
    console.error('[auth][trial] postgres init failed:', error);
    return null;
  }
};

const grantRegistrationTrial = async (userId) => {
  if (!userId) {
    return { granted: false, skipped: true, reason: 'missing_user_id' };
  }

  const pool = getRegistrationTrialPool();
  if (!pool) {
    if (registrationTrialPoolInitError) {
      return { granted: false, skipped: true, reason: 'pool_init_failed' };
    }
    return { granted: false, skipped: true, reason: 'database_unavailable' };
  }

  const endsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  await pool.query(
    `
      INSERT INTO user_entitlements (
        id,
        user_id,
        kind,
        scope,
        payload,
        starts_at,
        ends_at
      )
      VALUES (
        gen_random_uuid(),
        $1,
        'trial',
        'global',
        '{"plan":"pro","source":"registration_trial"}'::jsonb,
        now(),
        $2
      )
    `,
    [userId, endsAt]
  );

  return { granted: true, endsAt };
};

const logRegistrationTrialOutcome = (userId, trialResult, source = 'registration') => {
  if (trialResult?.granted) {
    console.info('[auth][trial] 30-day Pro trial granted:', {
      source,
      userId,
      endsAt: trialResult.endsAt
    });
  } else if (!trialResult?.skipped) {
    console.warn('[auth][trial] unexpected registration trial state:', {
      source,
      userId,
      trialResult
    });
  }
};

const toPublicUser = (user) => ({
  id: user.id,
  email: user.email,
  name: user.name,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
  providers: [
    ...Object.keys(user.oauthProviders || {}),
    ...(Array.isArray(user.passkeys) && user.passkeys.length ? ['passkey'] : [])
  ],
  passkeyCount: Array.isArray(user.passkeys) ? user.passkeys.length : 0
});

const createMailer = () => {
  const emailUser = process.env.EMAIL_USER;
  const emailPass = process.env.EMAIL_PASS;
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = Number(process.env.SMTP_PORT || 587);
  const smtpSecure = String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true';
  const smtpUser = process.env.SMTP_USER || process.env.GMAIL_USER || emailUser;
  const smtpPass = process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD || emailPass;

  if (emailUser && emailPass) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: emailUser,
        pass: emailPass
      }
    });
  }

  if (smtpHost && smtpUser && smtpPass) {
    return nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      auth: { user: smtpUser, pass: smtpPass }
    });
  }

  if (smtpUser && smtpPass) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: { user: smtpUser, pass: smtpPass }
    });
  }

  // Safe fallback for local development when SMTP is not configured.
  return nodemailer.createTransport({ jsonTransport: true });
};

const mailer = createMailer();

const resolveTurnstileSecret = () => String(process.env.TURNSTILE_SECRET_KEY || '').trim();
const readTurnstileToken = (body) => String(
  body?.['cf-turnstile-response']
    || body?.captchaToken
    || body?.turnstileToken
    || ''
).trim();

const verifyTurnstile = async ({ turnstileToken, remoteIp }) => {
  const secret = resolveTurnstileSecret();

  if (!secret) {
    console.warn('[auth][turnstile] TURNSTILE_SECRET_KEY is not configured. Captcha check is bypassed for debug mode.');
    return { ok: true, skipped: true, reason: 'TURNSTILE_SECRET_KEY_MISSING' };
  }

  if (!turnstileToken) {
    return { ok: false, error: 'Turnstile token is required' };
  }

  if (typeof fetch !== 'function') {
    return { ok: false, error: 'Global fetch is not available in this Node runtime' };
  }

  const payload = new URLSearchParams();
  payload.set('secret', secret);
  payload.set('response', turnstileToken);
  if (remoteIp) payload.set('remoteip', remoteIp);

  try {
    const response = await fetch(TURNSTILE_VERIFY_URL, {
      method: 'POST',
      body: payload
    });
    const responseText = await response.text();
    let result;
    try {
      result = responseText ? JSON.parse(responseText) : {};
    } catch {
      result = { raw: responseText };
    }

    if (!response.ok) {
      console.error('[auth][turnstile] Cloudflare HTTP error response:', {
        status: response.status,
        statusText: response.statusText,
        body: result
      });
      return { ok: false, error: `Turnstile HTTP ${response.status}` };
    }
    if (!result?.success) {
      console.error('[auth][turnstile] Cloudflare verification failed:', result);
      const errorCodes = Array.isArray(result?.['error-codes']) ? result['error-codes'].join(',') : 'verification_failed';
      return { ok: false, error: errorCodes, provider: result };
    }
    return { ok: true };
  } catch (error) {
    console.error('[auth][turnstile] Verification request failed:', error);
    return { ok: false, error: String(error?.message || 'turnstile_request_failed') };
  }
};

const createSessionToken = (user) => jwt.sign(
  {
    sub: user.id,
    email: user.email,
    type: 'session'
  },
  SESSION_JWT_SECRET,
  { expiresIn: ACCESS_TOKEN_TTL }
);

const resolveCookieSameSite = () => {
  const raw = String(process.env.AUTH_COOKIE_SAMESITE || 'none').trim().toLowerCase();
  if (raw === 'lax') return 'lax';
  if (raw === 'strict') return 'strict';
  return 'none';
};

const setSessionCookie = (res, sessionId) => {
  const sameSite = resolveCookieSameSite();
  const secureByEnv = String(process.env.AUTH_COOKIE_SECURE || '').trim().toLowerCase();
  const secure = secureByEnv
    ? secureByEnv === 'true'
    : sameSite === 'none';
  const cookieDomain = String(process.env.AUTH_COOKIE_DOMAIN || '').trim();

  const options = {
    httpOnly: true,
    secure,
    sameSite,
    maxAge: ACCESS_TOKEN_MAX_AGE_MS,
    path: '/'
  };
  if (cookieDomain) options.domain = cookieDomain;

  res.cookie('session_id', String(sessionId || ''), options);
};

const toBase64Url = (value) => Buffer.from(value)
  .toString('base64')
  .replace(/\+/g, '-')
  .replace(/\//g, '_')
  .replace(/=+$/g, '');

const createPkceVerifier = () => toBase64Url(crypto.randomBytes(64));

const createPkceChallenge = (verifier) => toBase64Url(
  crypto.createHash('sha256').update(String(verifier || '')).digest()
);

const cleanupOAuthState = () => {
  const now = Date.now();
  for (const [state, payload] of OAUTH_STATE.entries()) {
    if (!payload || (now - Number(payload.createdAt || 0)) > OAUTH_STATE_TTL_MS) {
      OAUTH_STATE.delete(state);
    }
  }
};

const createOAuthState = ({ provider, codeVerifier = '' }) => {
  cleanupOAuthState();
  const state = createId();
  OAUTH_STATE.set(state, {
    provider,
    codeVerifier,
    createdAt: Date.now()
  });
  return state;
};

const consumeOAuthState = ({ state, provider }) => {
  cleanupOAuthState();
  const payload = OAUTH_STATE.get(state);
  OAUTH_STATE.delete(state);
  if (!payload) return null;
  if (payload.provider !== provider) return null;
  if ((Date.now() - Number(payload.createdAt || 0)) > OAUTH_STATE_TTL_MS) return null;
  return payload;
};

const resolveOAuthCredentials = (provider) => {
  if (provider === 'google') {
    return {
      label: 'Google',
      clientId: String(process.env.GOOGLE_CLIENT_ID || '').trim(),
      clientSecret: String(process.env.GOOGLE_CLIENT_SECRET || '').trim(),
      clientIdEnv: 'GOOGLE_CLIENT_ID',
      clientSecretEnv: 'GOOGLE_CLIENT_SECRET'
    };
  }
  if (provider === 'github') {
    return {
      label: 'GitHub',
      clientId: String(process.env.GITHUB_CLIENT_ID || '').trim(),
      clientSecret: String(process.env.GITHUB_CLIENT_SECRET || '').trim(),
      clientIdEnv: 'GITHUB_CLIENT_ID',
      clientSecretEnv: 'GITHUB_CLIENT_SECRET'
    };
  }
  if (provider === 'facebook') {
    return {
      label: 'Facebook',
      clientId: String(process.env.FACEBOOK_CLIENT_ID || '').trim(),
      clientSecret: String(process.env.FACEBOOK_CLIENT_SECRET || '').trim(),
      clientIdEnv: 'FACEBOOK_CLIENT_ID',
      clientSecretEnv: 'FACEBOOK_CLIENT_SECRET'
    };
  }
  if (provider === 'x') {
    return {
      label: 'X',
      clientId: String(process.env.X_CLIENT_ID || process.env.TWITTER_CLIENT_ID || '').trim(),
      clientSecret: String(process.env.X_CLIENT_SECRET || process.env.TWITTER_CLIENT_SECRET || '').trim(),
      clientIdEnv: 'X_CLIENT_ID (or TWITTER_CLIENT_ID)',
      clientSecretEnv: 'X_CLIENT_SECRET (or TWITTER_CLIENT_SECRET)'
    };
  }
  return null;
};

const ensureOAuthCredentials = (provider) => {
  const config = resolveOAuthCredentials(provider);
  if (!config) {
    const error = new Error('Unsupported OAuth provider');
    error.code = 'OAUTH_PROVIDER_UNSUPPORTED';
    throw error;
  }
  const missing = [];
  if (!config.clientId) missing.push(config.clientIdEnv);
  if (!config.clientSecret) missing.push(config.clientSecretEnv);
  if (missing.length) {
    const error = new Error(`${config.label} OAuth is not configured: missing ${missing.join(', ')}`);
    error.code = 'OAUTH_PROVIDER_NOT_CONFIGURED';
    throw error;
  }
  return config;
};

const buildOAuthRedirectUri = (provider) => `${OAUTH_API_BASE}/api/auth/connect/${provider}/callback`;

const buildFrontendOAuthCallbackUrl = ({ provider, token, email, error, message }) => {
  const base = /^https?:\/\//i.test(OAUTH_FRONTEND_CALLBACK)
    ? OAUTH_FRONTEND_CALLBACK
    : `https://megaconvert-web.vercel.app${OAUTH_FRONTEND_CALLBACK.startsWith('/') ? OAUTH_FRONTEND_CALLBACK : `/${OAUTH_FRONTEND_CALLBACK}`}`;

  const url = new URL(base);
  if (provider) url.searchParams.set('provider', provider);
  if (token) {
    url.searchParams.set('token', token);
    url.searchParams.set('access_token', token);
  }
  if (email) url.searchParams.set('email', email);
  if (error) url.searchParams.set('error', error);
  if (message) url.searchParams.set('message', message);
  return url.toString();
};

const requestJson = async (url, options = {}) => {
  if (typeof fetch !== 'function') {
    const error = new Error('Global fetch is not available in this Node runtime');
    error.code = 'FETCH_UNAVAILABLE';
    throw error;
  }
  const response = await fetch(url, options);
  const text = await response.text();
  let payload;
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { raw: text };
  }
  return {
    ok: response.ok,
    status: response.status,
    payload
  };
};

const expectRequestOk = (result, code, message) => {
  if (result.ok) return result.payload;
  const error = new Error(message);
  error.code = code;
  error.status = result.status;
  error.details = result.payload;
  throw error;
};

const ensureOAuthContainer = (user) => {
  if (!user.oauthProviders || typeof user.oauthProviders !== 'object' || Array.isArray(user.oauthProviders)) {
    user.oauthProviders = {};
  }
  return user.oauthProviders;
};

const findUserByProvider = ({ provider, providerUserId }) => {
  const normalizedProviderId = String(providerUserId || '').trim();
  if (!normalizedProviderId) return null;
  return users.find((item) => String(item?.oauthProviders?.[provider]?.id || '') === normalizedProviderId) || null;
};

const resolveOAuthName = ({ provider, name, email }) => {
  const cleanName = String(name || '').trim();
  if (cleanName) return cleanName;
  const cleanEmail = normalizeEmail(email);
  if (cleanEmail.includes('@')) return cleanEmail.split('@')[0];
  if (provider === 'google') return 'Google User';
  if (provider === 'github') return 'GitHub User';
  if (provider === 'facebook') return 'Facebook User';
  if (provider === 'x') return 'X User';
  return 'User';
};

const resolveOAuthEmail = ({ provider, providerUserId, email }) => {
  const normalized = normalizeEmail(email);
  if (normalized) return normalized;
  const safeProvider = String(provider || 'oauth').replace(/[^a-z0-9_-]/gi, '').toLowerCase() || 'oauth';
  const safeProviderId = String(providerUserId || createId()).replace(/[^a-z0-9_-]/gi, '').toLowerCase() || createId();
  return `${safeProvider}-${safeProviderId}@${OAUTH_SYNTHETIC_EMAIL_DOMAIN}`;
};

const findOrCreateOAuthUser = async ({ provider, providerUserId, email, name }) => {
  const normalizedProviderId = String(providerUserId || '').trim();
  if (!normalizedProviderId) {
    const error = new Error('OAuth provider user id is missing');
    error.code = 'OAUTH_PROFILE_INVALID';
    throw error;
  }

  const resolvedEmail = resolveOAuthEmail({ provider, providerUserId: normalizedProviderId, email });
  const resolvedName = resolveOAuthName({ provider, name, email: resolvedEmail });
  let user = findUserByProvider({ provider, providerUserId: normalizedProviderId });
  if (!user) {
    user = users.find((item) => item.email === resolvedEmail) || null;
  }

  const now = new Date().toISOString();
  if (!user) {
    const randomPassword = `${createId()}${createId()}`;
    const passwordHash = await bcrypt.hash(randomPassword, 12);
    user = {
      id: createId(),
      email: resolvedEmail,
      name: resolvedName,
      passwordHash,
      passwordVersion: 1,
      oauthProviders: {},
      passkeys: [],
      createdAt: now,
      updatedAt: now
    };
    users.push(user);

    try {
      const trialResult = await grantRegistrationTrial(user.id);
      logRegistrationTrialOutcome(user.id, trialResult, 'oauth_signup');
    } catch (error) {
      const userIndex = users.findIndex((item) => item.id === user.id);
      if (userIndex >= 0) {
        users.splice(userIndex, 1);
      }
      console.error('[auth][trial] failed to grant registration trial during OAuth signup:', error);
      const provisionError = new Error('Account trial provisioning failed');
      provisionError.code = 'REGISTRATION_TRIAL_FAILED';
      throw provisionError;
    }
  }

  if (!user.email) user.email = resolvedEmail;
  if (!user.name || user.name === 'User') user.name = resolvedName;
  const providers = ensureOAuthContainer(user);
  providers[provider] = {
    id: normalizedProviderId,
    email: resolvedEmail,
    connectedAt: now
  };
  user.updatedAt = now;
  return user;
};

const buildOAuthAuthorizeUrl = ({ provider, state, codeChallenge = '' }) => {
  const { clientId } = ensureOAuthCredentials(provider);
  const redirectUri = buildOAuthRedirectUri(provider);

  if (provider === 'google') {
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'openid email profile');
    url.searchParams.set('state', state);
    return url.toString();
  }
  if (provider === 'github') {
    const url = new URL('https://github.com/login/oauth/authorize');
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('scope', 'read:user user:email');
    url.searchParams.set('state', state);
    return url.toString();
  }
  if (provider === 'facebook') {
    const url = new URL('https://www.facebook.com/v19.0/dialog/oauth');
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'email,public_profile');
    url.searchParams.set('state', state);
    return url.toString();
  }
  if (provider === 'x') {
    const url = new URL('https://twitter.com/i/oauth2/authorize');
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('scope', 'tweet.read users.read users.email offline.access');
    url.searchParams.set('state', state);
    url.searchParams.set('code_challenge', codeChallenge);
    url.searchParams.set('code_challenge_method', 'S256');
    return url.toString();
  }
  const error = new Error('Unsupported OAuth provider');
  error.code = 'OAUTH_PROVIDER_UNSUPPORTED';
  throw error;
};

const resolveGitHubEmail = (emails) => {
  if (!Array.isArray(emails)) return '';
  const primaryVerified = emails.find((item) => item?.primary && item?.verified);
  const verified = emails.find((item) => item?.verified);
  const fallback = primaryVerified || verified || emails[0];
  return normalizeEmail(fallback?.email);
};

const exchangeOAuthCodeForProfile = async ({ provider, code, statePayload }) => {
  const { clientId, clientSecret } = ensureOAuthCredentials(provider);
  const redirectUri = buildOAuthRedirectUri(provider);

  if (provider === 'google') {
    const tokenBody = new URLSearchParams();
    tokenBody.set('code', code);
    tokenBody.set('client_id', clientId);
    tokenBody.set('client_secret', clientSecret);
    tokenBody.set('redirect_uri', redirectUri);
    tokenBody.set('grant_type', 'authorization_code');
    const tokenResult = await requestJson('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenBody.toString()
    });
    const tokenData = expectRequestOk(tokenResult, 'GOOGLE_TOKEN_EXCHANGE_FAILED', 'Google token exchange failed');
    const accessToken = String(tokenData?.access_token || '').trim();
    const profileResult = await requestJson('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const profile = expectRequestOk(profileResult, 'GOOGLE_PROFILE_FETCH_FAILED', 'Failed to fetch Google profile');
    return {
      provider,
      providerUserId: String(profile?.sub || profile?.id || '').trim(),
      email: normalizeEmail(profile?.email),
      name: String(profile?.name || profile?.given_name || '').trim()
    };
  }

  if (provider === 'github') {
    const tokenBody = new URLSearchParams();
    tokenBody.set('code', code);
    tokenBody.set('client_id', clientId);
    tokenBody.set('client_secret', clientSecret);
    tokenBody.set('redirect_uri', redirectUri);
    const tokenResult = await requestJson('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: tokenBody.toString()
    });
    const tokenData = expectRequestOk(tokenResult, 'GITHUB_TOKEN_EXCHANGE_FAILED', 'GitHub token exchange failed');
    const accessToken = String(tokenData?.access_token || '').trim();
    const headers = {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'MegaConvert-OAuth'
    };
    const profileResult = await requestJson('https://api.github.com/user', { headers });
    const profile = expectRequestOk(profileResult, 'GITHUB_PROFILE_FETCH_FAILED', 'Failed to fetch GitHub profile');
    let email = normalizeEmail(profile?.email);
    if (!email) {
      const emailsResult = await requestJson('https://api.github.com/user/emails', { headers });
      if (emailsResult.ok) {
        email = resolveGitHubEmail(emailsResult.payload);
      }
    }
    if (!email) {
      const error = new Error('GitHub account email is not available');
      error.code = 'GITHUB_EMAIL_MISSING';
      throw error;
    }
    return {
      provider,
      providerUserId: String(profile?.id || '').trim(),
      email,
      name: String(profile?.name || profile?.login || '').trim()
    };
  }

  if (provider === 'facebook') {
    const tokenUrl = new URL('https://graph.facebook.com/v19.0/oauth/access_token');
    tokenUrl.searchParams.set('client_id', clientId);
    tokenUrl.searchParams.set('client_secret', clientSecret);
    tokenUrl.searchParams.set('redirect_uri', redirectUri);
    tokenUrl.searchParams.set('code', code);
    const tokenResult = await requestJson(tokenUrl.toString(), { method: 'GET' });
    const tokenData = expectRequestOk(tokenResult, 'FACEBOOK_TOKEN_EXCHANGE_FAILED', 'Facebook token exchange failed');
    const accessToken = String(tokenData?.access_token || '').trim();
    const profileUrl = new URL('https://graph.facebook.com/me');
    profileUrl.searchParams.set('fields', 'id,name,email');
    profileUrl.searchParams.set('access_token', accessToken);
    const profileResult = await requestJson(profileUrl.toString(), { method: 'GET' });
    const profile = expectRequestOk(profileResult, 'FACEBOOK_PROFILE_FETCH_FAILED', 'Failed to fetch Facebook profile');
    return {
      provider,
      providerUserId: String(profile?.id || '').trim(),
      email: normalizeEmail(profile?.email),
      name: String(profile?.name || '').trim()
    };
  }

  if (provider === 'x') {
    const codeVerifier = String(statePayload?.codeVerifier || '').trim();
    if (!codeVerifier) {
      const error = new Error('X OAuth verifier is missing');
      error.code = 'X_PKCE_VERIFIER_MISSING';
      throw error;
    }

    const tokenBody = new URLSearchParams();
    tokenBody.set('grant_type', 'authorization_code');
    tokenBody.set('code', code);
    tokenBody.set('redirect_uri', redirectUri);
    tokenBody.set('code_verifier', codeVerifier);
    tokenBody.set('client_id', clientId);
    const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const tokenResult = await requestJson('https://api.twitter.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: tokenBody.toString()
    });
    const tokenData = expectRequestOk(tokenResult, 'X_TOKEN_EXCHANGE_FAILED', 'X token exchange failed');
    const accessToken = String(tokenData?.access_token || '').trim();
    const profileResult = await requestJson('https://api.twitter.com/2/users/me?user.fields=id,name,username,profile_image_url', {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });
    const profileData = expectRequestOk(profileResult, 'X_PROFILE_FETCH_FAILED', 'Failed to fetch X profile');
    const profile = profileData?.data || {};
    return {
      provider,
      providerUserId: String(profile?.id || '').trim(),
      email: normalizeEmail(profile?.email),
      name: String(profile?.name || profile?.username || '').trim()
    };
  }

  const error = new Error('Unsupported OAuth provider');
  error.code = 'OAUTH_PROVIDER_UNSUPPORTED';
  throw error;
};

const createResetToken = (user) => {
  const jti = createId();
  const token = jwt.sign(
    {
      sub: user.id,
      email: user.email,
      type: 'password_reset',
      jti,
      passwordVersion: user.passwordVersion
    },
    RESET_JWT_SECRET,
    { expiresIn: RESET_TOKEN_TTL }
  );
  return { token, jti };
};

const sendResetEmail = async ({ email, token }) => {
  const resetUrl = `${RESET_LINK_BASE}/reset-password?token=${encodeURIComponent(token)}`;
  const from = process.env.SMTP_FROM || process.env.EMAIL_USER || process.env.GMAIL_USER || 'no-reply@megaconvert.com';

  await mailer.sendMail({
    from,
    to: email,
    subject: 'MegaConvert password reset',
    text: `Open this link to reset your password: ${resetUrl}\n\nThis link expires in 1 hour.`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.5;color:#0f172a;">
        <h2 style="margin:0 0 12px;">Reset your MegaConvert password</h2>
        <p style="margin:0 0 16px;">Click the button below to set a new password:</p>
        <p style="margin:0 0 16px;">
          <a
            href="${resetUrl}"
            target="_blank"
            rel="noreferrer"
            style="display:inline-block;padding:12px 20px;border-radius:12px;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:600;"
          >
            Reset password
          </a>
        </p>
        <p style="margin:0 0 12px;font-size:14px;color:#334155;">
          If the button does not work, open this link:
          <a href="${resetUrl}" target="_blank" rel="noreferrer">${resetUrl}</a>
        </p>
        <p style="margin:0;">The link is valid for 1 hour.</p>
      </div>
    `
  });
};

class AuthController {
  async connectProvider(req, res) {
    const provider = normalizeOAuthProvider(req.params?.provider);
    if (!resolveOAuthCredentials(provider)) {
      return res.status(404).json({
        ok: false,
        code: 'OAUTH_PROVIDER_UNSUPPORTED',
        message: 'Unsupported OAuth provider'
      });
    }

    try {
      ensureOAuthCredentials(provider);
      const codeVerifier = provider === 'x' ? createPkceVerifier() : '';
      const state = createOAuthState({ provider, codeVerifier });
      const authorizeUrl = buildOAuthAuthorizeUrl({
        provider,
        state,
        codeChallenge: codeVerifier ? createPkceChallenge(codeVerifier) : ''
      });
      return res.redirect(authorizeUrl);
    } catch (error) {
      console.error('[auth][oauth] start failed:', {
        provider,
        code: error?.code || null,
        message: error?.message || 'unknown',
        details: error?.details || null
      });
      return res.status(500).json({
        ok: false,
        code: error?.code || 'OAUTH_START_FAILED',
        message: error?.message || 'Failed to start OAuth flow'
      });
    }
  }

  async connectProviderCallback(req, res) {
    const provider = normalizeOAuthProvider(req.params?.provider);
    if (!resolveOAuthCredentials(provider)) {
      return res.redirect(buildFrontendOAuthCallbackUrl({
        provider,
        error: 'OAUTH_PROVIDER_UNSUPPORTED',
        message: 'Unsupported OAuth provider'
      }));
    }

    const providerError = String(req.query?.error || '').trim();
    const providerErrorDescription = String(req.query?.error_description || '').trim();
    if (providerError) {
      return res.redirect(buildFrontendOAuthCallbackUrl({
        provider,
        error: providerError,
        message: providerErrorDescription || 'OAuth authorization failed'
      }));
    }

    const code = String(req.query?.code || '').trim();
    const state = String(req.query?.state || '').trim();
    if (!code || !state) {
      return res.redirect(buildFrontendOAuthCallbackUrl({
        provider,
        error: 'OAUTH_CALLBACK_INVALID',
        message: 'Missing code or state in callback'
      }));
    }

    const statePayload = consumeOAuthState({ state, provider });
    if (!statePayload) {
      return res.redirect(buildFrontendOAuthCallbackUrl({
        provider,
        error: 'OAUTH_STATE_INVALID',
        message: 'OAuth state is invalid or expired'
      }));
    }

    try {
      const profile = await exchangeOAuthCodeForProfile({ provider, code, statePayload });
      const user = await findOrCreateOAuthUser(profile);
      const token = createSessionToken(user);
      const sessionId = createId();
      setSessionCookie(res, sessionId);
      return res.redirect(buildFrontendOAuthCallbackUrl({
        provider,
        token,
        email: user.email
      }));
    } catch (error) {
      console.error('[auth][oauth] callback failed:', {
        provider,
        code: error?.code || null,
        message: error?.message || 'unknown',
        details: error?.details || null
      });
      return res.redirect(buildFrontendOAuthCallbackUrl({
        provider,
        error: error?.code || 'OAUTH_CALLBACK_FAILED',
        message: error?.message || 'OAuth callback failed'
      }));
    }
  }

  async register(req, res) {
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || '');
    const name = String(req.body?.name || '').trim() || email.split('@')[0] || 'User';
    const turnstileToken = readTurnstileToken(req.body);

    if (!email || !password) {
      return res.status(400).json({
        ok: false,
        code: 'VALIDATION_ERROR',
        message: 'email and password are required'
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        ok: false,
        code: 'WEAK_PASSWORD',
        message: 'Password must be at least 8 characters long'
      });
    }

    const captcha = await verifyTurnstile({
      turnstileToken,
      remoteIp: req.headers['cf-connecting-ip'] || req.ip
    });
    if (!captcha.ok) {
      return res.status(400).json({
        ok: false,
        code: 'TURNSTILE_FAILED',
        message: 'Captcha verification failed',
        details: captcha.error
      });
    }

    const existing = users.find((user) => user.email === email);
    if (existing) {
      return res.status(409).json({
        ok: false,
        code: 'EMAIL_ALREADY_EXISTS',
        message: 'Email is already registered'
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const now = new Date().toISOString();
    const user = {
      id: createId(),
      email,
      name,
      passwordHash,
      passwordVersion: 1,
      oauthProviders: {},
      passkeys: [],
      createdAt: now,
      updatedAt: now
    };
    users.push(user);

    try {
      const trialResult = await grantRegistrationTrial(user.id);
      logRegistrationTrialOutcome(user.id, trialResult, 'password_signup');
    } catch (error) {
      const userIndex = users.findIndex((item) => item.id === user.id);
      if (userIndex >= 0) {
        users.splice(userIndex, 1);
      }
      console.error('[auth][trial] failed to grant registration trial:', error);
      return res.status(500).json({
        ok: false,
        code: 'REGISTRATION_TRIAL_FAILED',
        message: 'Account trial provisioning failed'
      });
    }

    const token = createSessionToken(user);
    const sessionId = createId();
    setSessionCookie(res, sessionId);
    return res.status(201).json({
      ok: true,
      token,
      access_token: token,
      session_id: sessionId,
      user: toPublicUser(user)
    });
  }

  async login(req, res) {
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || '');

    if (!email || !password) {
      return res.status(400).json({
        ok: false,
        code: 'VALIDATION_ERROR',
        message: 'email and password are required'
      });
    }

    const user = users.find((item) => item.email === email);
    if (!user) {
      return res.status(401).json({
        ok: false,
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password'
      });
    }

    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      return res.status(401).json({
        ok: false,
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password'
      });
    }

    const token = createSessionToken(user);
    const sessionId = createId();
    setSessionCookie(res, sessionId);
    return res.json({
      ok: true,
      token,
      access_token: token,
      session_id: sessionId,
      user: toPublicUser(user)
    });
  }

  async forgotPassword(req, res) {
    const email = normalizeEmail(req.body?.email);
    if (!email) {
      return res.status(400).json({
        ok: false,
        code: 'VALIDATION_ERROR',
        message: 'email is required'
      });
    }

    const user = users.find((item) => item.email === email);
    if (!user) {
      return res.json({
        ok: true,
        message: 'If this email exists, a reset link has been sent'
      });
    }

    const { token } = createResetToken(user);
    await sendResetEmail({ email: user.email, token });

    return res.json({
      ok: true,
      message: 'If this email exists, a reset link has been sent'
    });
  }

  async resetPassword(req, res) {
    const token = String(req.body?.token || '').trim();
    const newPassword = String(req.body?.newPassword || '');

    if (!token || !newPassword) {
      return res.status(400).json({
        ok: false,
        code: 'VALIDATION_ERROR',
        message: 'token and newPassword are required'
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        ok: false,
        code: 'WEAK_PASSWORD',
        message: 'Password must be at least 8 characters long'
      });
    }

    let payload;
    try {
      payload = jwt.verify(token, RESET_JWT_SECRET);
    } catch (error) {
      return res.status(401).json({
        ok: false,
        code: 'INVALID_OR_EXPIRED_TOKEN',
        message: 'Reset token is invalid or expired'
      });
    }

    if (payload?.type !== 'password_reset' || !payload?.sub) {
      return res.status(400).json({
        ok: false,
        code: 'INVALID_TOKEN_TYPE',
        message: 'Invalid reset token payload'
      });
    }

    if (payload.jti && usedResetTokenIds.has(payload.jti)) {
      return res.status(409).json({
        ok: false,
        code: 'TOKEN_ALREADY_USED',
        message: 'Reset token was already used'
      });
    }

    const user = users.find((item) => item.id === payload.sub && item.email === payload.email);
    if (!user) {
      return res.status(404).json({
        ok: false,
        code: 'USER_NOT_FOUND',
        message: 'User not found'
      });
    }

    if (Number(payload.passwordVersion) !== Number(user.passwordVersion)) {
      return res.status(409).json({
        ok: false,
        code: 'TOKEN_INVALIDATED',
        message: 'Reset token is no longer valid'
      });
    }

    user.passwordHash = await bcrypt.hash(newPassword, 12);
    user.passwordVersion += 1;
    user.updatedAt = new Date().toISOString();

    if (payload.jti) {
      usedResetTokenIds.add(payload.jti);
      if (usedResetTokenIds.size > 10000) {
        usedResetTokenIds.clear();
      }
    }

    return res.json({
      ok: true,
      message: 'Password was updated successfully'
    });
  }
}

const createAuthRouter = () => {
  const router = Router();
  const controller = new AuthController();

  router.get('/connect/:provider', (req, res) => controller.connectProvider(req, res));
  router.get('/connect/:provider/callback', (req, res) => controller.connectProviderCallback(req, res));
  router.post('/register', (req, res) => controller.register(req, res));
  router.post('/login', (req, res) => controller.login(req, res));
  router.post('/forgot-password', (req, res) => controller.forgotPassword(req, res));
  router.post('/reset-password', (req, res) => controller.resetPassword(req, res));
  registerPasskeyRoutes(router, {
    users,
    createId,
    normalizeEmail,
    readTurnstileToken,
    verifyTurnstile,
    createSessionToken,
    setSessionCookie,
    toPublicUser,
    sessionJwtSecret: SESSION_JWT_SECRET,
    grantRegistrationTrial,
    logRegistrationTrialOutcome
  });

  return router;
};

module.exports = {
  AuthController,
  createAuthRouter,
  users
};
