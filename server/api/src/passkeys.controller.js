const crypto = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse
} = require('@simplewebauthn/server');

const PASSKEY_SESSION_TTL_MS = Math.max(60 * 1000, Number(process.env.PASSKEY_SESSION_TTL_MS || 10 * 60 * 1000));
const PASSKEY_CHALLENGES = new Map();
const DEFAULT_FRONTEND_ORIGINS = [
  'https://megaconvert-web.vercel.app',
  'http://localhost:5173'
];
const WEBAUTHN_RP_NAME = String(process.env.WEBAUTHN_RP_NAME || 'MegaConvert').trim() || 'MegaConvert';
const ALLOW_VERCEL_PREVIEW_ORIGINS = String(process.env.ALLOW_VERCEL_PREVIEW_ORIGINS || 'true').trim().toLowerCase() === 'true';

const dedupe = (values) => Array.from(new Set(values.filter(Boolean)));

const parseOriginList = (...rawValues) => dedupe(
  rawValues
    .flatMap((value) => String(value || '').split(','))
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => value.replace(/\/+$/g, ''))
);

const PASSKEY_ALLOWED_ORIGINS = (() => {
  const configured = parseOriginList(
    process.env.WEBAUTHN_ALLOWED_ORIGINS,
    process.env.WEBAUTHN_ORIGIN,
    process.env.APP_BASE_URL,
    process.env.FRONTEND_URL,
    process.env.CORS_ORIGIN
  );
  return configured.length ? configured : DEFAULT_FRONTEND_ORIGINS;
})();

const PASSKEY_DEFAULT_RP_ID = String(process.env.WEBAUTHN_RP_ID || '').trim();

const toBase64Url = (value) => Buffer.from(value)
  .toString('base64')
  .replace(/\+/g, '-')
  .replace(/\//g, '_')
  .replace(/=+$/g, '');

const fromBase64Url = (value) => {
  const normalized = String(value || '')
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const padLength = normalized.length % 4;
  const padded = padLength === 0 ? normalized : `${normalized}${'='.repeat(4 - padLength)}`;
  return Buffer.from(padded, 'base64');
};

const cleanupPasskeyChallenges = () => {
  const now = Date.now();
  for (const [sessionId, payload] of PASSKEY_CHALLENGES.entries()) {
    if (!payload || (now - Number(payload.createdAt || 0)) > PASSKEY_SESSION_TTL_MS) {
      PASSKEY_CHALLENGES.delete(sessionId);
    }
  }
};

const createChallengeSession = (payload) => {
  cleanupPasskeyChallenges();
  const sessionId = typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : crypto.randomBytes(16).toString('hex');
  PASSKEY_CHALLENGES.set(sessionId, {
    ...payload,
    createdAt: Date.now()
  });
  return sessionId;
};

const consumeChallengeSession = (sessionId, type) => {
  cleanupPasskeyChallenges();
  const key = String(sessionId || '').trim();
  if (!key) return null;
  const payload = PASSKEY_CHALLENGES.get(key);
  PASSKEY_CHALLENGES.delete(key);
  if (!payload) return null;
  if (payload.type !== type) return null;
  return payload;
};

const isVercelPreviewOrigin = (origin) => {
  if (!origin || !ALLOW_VERCEL_PREVIEW_ORIGINS) return false;
  try {
    const parsed = new URL(origin);
    return parsed.protocol === 'https:' && parsed.hostname.endsWith('.vercel.app');
  } catch {
    return false;
  }
};

const isAllowedOrigin = (origin) => {
  if (!origin) return false;
  if (PASSKEY_ALLOWED_ORIGINS.includes(origin)) return true;
  return isVercelPreviewOrigin(origin);
};

const resolveOriginContext = (req) => {
  const requestOrigin = String(req.headers.origin || '').trim().replace(/\/+$/g, '');
  if (requestOrigin && isAllowedOrigin(requestOrigin)) {
    const parsed = new URL(requestOrigin);
    return {
      expectedOrigin: requestOrigin,
      rpID: PASSKEY_DEFAULT_RP_ID || parsed.hostname
    };
  }

  const fallbackOrigin = PASSKEY_ALLOWED_ORIGINS[0] || DEFAULT_FRONTEND_ORIGINS[0];
  const parsedFallback = new URL(fallbackOrigin);
  return {
    expectedOrigin: fallbackOrigin,
    rpID: PASSKEY_DEFAULT_RP_ID || parsedFallback.hostname
  };
};

const extractBearerToken = (req) => {
  const rawHeader = Array.isArray(req.headers.authorization)
    ? req.headers.authorization[0]
    : req.headers.authorization;
  const header = String(rawHeader || '').trim();
  if (!header.toLowerCase().startsWith('bearer ')) return '';
  return header.slice(7).trim();
};

const ensurePasskeyArray = (user) => {
  if (!user || typeof user !== 'object') return [];
  if (!Array.isArray(user.passkeys)) {
    user.passkeys = [];
  }
  return user.passkeys;
};

const sanitizeTransports = (value) => (
  Array.isArray(value)
    ? value
        .map((item) => String(item || '').trim())
        .filter(Boolean)
        .slice(0, 8)
    : []
);

const serializeCredentialPublicKey = (value) => toBase64Url(Buffer.from(value));
const deserializeCredentialPublicKey = (value) => new Uint8Array(fromBase64Url(value));

const findUserByPasskeyId = (users, credentialId) => {
  const normalizedId = String(credentialId || '').trim();
  if (!normalizedId) return null;

  for (const user of users) {
    const passkey = ensurePasskeyArray(user).find((item) => String(item?.id || '') === normalizedId);
    if (passkey) {
      return { user, passkey };
    }
  }

  return null;
};

function registerPasskeyRoutes(router, {
  users,
  createId,
  normalizeEmail,
  readTurnstileToken,
  verifyTurnstile,
  createSessionToken,
  setSessionCookie,
  toPublicUser,
  sessionJwtSecret,
  grantRegistrationTrial = null,
  logRegistrationTrialOutcome = null,
  persistUsers = null
}) {
  const persistIfPossible = () => {
    if (typeof persistUsers === 'function') {
      try {
        persistUsers();
      } catch (error) {
        console.error('[auth][passkeys] persist failed:', error);
      }
    }
  };

  const resolveAuthenticatedUser = (req) => {
    const token = extractBearerToken(req);
    if (!token) return null;

    try {
      const payload = jwt.verify(token, sessionJwtSecret);
      if (payload?.type !== 'session' || !payload?.sub) return null;
      return users.find((user) => user.id === payload.sub && user.email === payload.email) || null;
    } catch {
      return null;
    }
  };

  router.get('/passkeys/config', (req, res) => {
    const originContext = resolveOriginContext(req);
    return res.json({
      ok: true,
      rpName: WEBAUTHN_RP_NAME,
      expectedOrigin: originContext.expectedOrigin,
      rpID: originContext.rpID,
      passkeyEnabled: true
    });
  });

  router.post('/passkeys/register/options', async (req, res) => {
    const authUser = resolveAuthenticatedUser(req);
    const email = normalizeEmail(req.body?.email);
    const name = String(req.body?.name || '').trim() || email.split('@')[0] || 'User';

    try {
      let targetUser = authUser;
      let pendingUser = null;

      if (!targetUser) {
        if (!email) {
          return res.status(400).json({
            ok: false,
            code: 'VALIDATION_ERROR',
            message: 'email is required for passkey registration'
          });
        }

        const captcha = await verifyTurnstile({
          turnstileToken: readTurnstileToken(req.body),
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
            message: 'Email is already registered. Sign in and attach a passkey from your account.'
          });
        }

        pendingUser = {
          id: createId(),
          email,
          name
        };
      }

      const subject = targetUser || pendingUser;
      const originContext = resolveOriginContext(req);
      const excludeCredentials = ensurePasskeyArray(targetUser).map((passkey) => ({
        id: passkey.id,
        transports: sanitizeTransports(passkey.transports)
      }));

      const options = await generateRegistrationOptions({
        rpName: WEBAUTHN_RP_NAME,
        rpID: originContext.rpID,
        userName: subject.email,
        userID: Buffer.from(subject.id, 'utf8'),
        userDisplayName: subject.name,
        timeout: 60_000,
        attestationType: 'none',
        excludeCredentials,
        authenticatorSelection: {
          residentKey: 'preferred',
          userVerification: 'required'
        },
        preferredAuthenticatorType: 'localDevice'
      });

      const sessionId = createChallengeSession({
        type: 'registration',
        challenge: options.challenge,
        expectedOrigin: originContext.expectedOrigin,
        expectedRPID: originContext.rpID,
        userId: targetUser?.id || null,
        pendingUser
      });

      return res.json({
        ok: true,
        sessionId,
        options,
        mode: targetUser ? 'attach' : 'create'
      });
    } catch (error) {
      console.error('[auth][passkeys] registration options failed:', error);
      return res.status(500).json({
        ok: false,
        code: 'PASSKEY_REGISTRATION_OPTIONS_FAILED',
        message: error?.message || 'Unable to start passkey registration'
      });
    }
  });

  router.post('/passkeys/register/verify', async (req, res) => {
    const session = consumeChallengeSession(req.body?.sessionId, 'registration');
    if (!session) {
      return res.status(410).json({
        ok: false,
        code: 'PASSKEY_SESSION_EXPIRED',
        message: 'Passkey registration session expired. Start again.'
      });
    }

    try {
      const verification = await verifyRegistrationResponse({
        response: req.body?.credential,
        expectedChallenge: session.challenge,
        expectedOrigin: session.expectedOrigin,
        expectedRPID: session.expectedRPID,
        requireUserVerification: true
      });

      if (!verification.verified || !verification.registrationInfo) {
        return res.status(400).json({
          ok: false,
          code: 'PASSKEY_REGISTRATION_FAILED',
          message: 'Passkey could not be verified'
        });
      }

      let user = session.userId
        ? users.find((item) => item.id === session.userId) || null
        : null;

      if (!user) {
        const pending = session.pendingUser;
        if (!pending?.email || !pending?.id) {
          return res.status(400).json({
            ok: false,
            code: 'PASSKEY_PENDING_USER_INVALID',
            message: 'Passkey session user is invalid'
          });
        }

        const conflict = users.find((item) => item.email === pending.email);
        if (conflict) {
          return res.status(409).json({
            ok: false,
            code: 'EMAIL_ALREADY_EXISTS',
            message: 'Email is already registered'
          });
        }

        const now = new Date().toISOString();
        user = {
          id: pending.id,
          email: pending.email,
          name: pending.name || pending.email.split('@')[0] || 'User',
          passwordHash: await bcrypt.hash(`${createId()}${createId()}`, 12),
          passwordVersion: 1,
          oauthProviders: {},
          passkeys: [],
          createdAt: now,
          updatedAt: now
        };
        users.push(user);

        if (typeof grantRegistrationTrial === 'function') {
          try {
            const trialResult = await grantRegistrationTrial(user.id);
            if (typeof logRegistrationTrialOutcome === 'function') {
              logRegistrationTrialOutcome(user.id, trialResult, 'passkey_signup');
            }
          } catch (error) {
            console.error('[auth][trial] failed to grant registration trial during passkey signup:', error);
          }
        }
      }

      const passkeys = ensurePasskeyArray(user);
      const credentialId = String(verification.registrationInfo.credential.id || '').trim();
      if (!credentialId) {
        return res.status(400).json({
          ok: false,
          code: 'PASSKEY_CREDENTIAL_INVALID',
          message: 'Credential ID is missing'
        });
      }

      const duplicate = passkeys.find((item) => String(item?.id || '') === credentialId);
      if (!duplicate) {
        passkeys.push({
          id: credentialId,
          publicKey: serializeCredentialPublicKey(verification.registrationInfo.credential.publicKey),
          counter: Number(verification.registrationInfo.credential.counter || 0),
          transports: sanitizeTransports(req.body?.credential?.response?.transports),
          deviceType: verification.registrationInfo.credentialDeviceType,
          backedUp: verification.registrationInfo.credentialBackedUp === true,
          createdAt: new Date().toISOString(),
          lastUsedAt: new Date().toISOString()
        });
      }

      user.updatedAt = new Date().toISOString();
      persistIfPossible();

      const token = createSessionToken(user);
      const sessionId = createId();
      setSessionCookie(res, sessionId);
      return res.status(session.userId ? 200 : 201).json({
        ok: true,
        token,
        access_token: token,
        session_id: sessionId,
        user: toPublicUser(user)
      });
    } catch (error) {
      console.error('[auth][passkeys] registration verify failed:', error);
      return res.status(400).json({
        ok: false,
        code: 'PASSKEY_REGISTRATION_VERIFY_FAILED',
        message: error?.message || 'Unable to verify passkey registration'
      });
    }
  });

  router.post('/passkeys/login/options', async (req, res) => {
    const email = normalizeEmail(req.body?.email);

    try {
      const originContext = resolveOriginContext(req);
      let allowCredentials;
      let userId = null;

      if (email) {
        const user = users.find((item) => item.email === email) || null;
        if (!user) {
          return res.status(404).json({
            ok: false,
            code: 'USER_NOT_FOUND',
            message: 'No account found for this email'
          });
        }

        const passkeys = ensurePasskeyArray(user);
        if (!passkeys.length) {
          return res.status(404).json({
            ok: false,
            code: 'PASSKEY_NOT_FOUND',
            message: 'This account does not have a registered passkey yet'
          });
        }

        allowCredentials = passkeys.map((passkey) => ({
          id: passkey.id,
          transports: sanitizeTransports(passkey.transports)
        }));
        userId = user.id;
      }

      const options = await generateAuthenticationOptions({
        rpID: originContext.rpID,
        allowCredentials,
        timeout: 60_000,
        userVerification: 'required'
      });

      const sessionId = createChallengeSession({
        type: 'authentication',
        challenge: options.challenge,
        expectedOrigin: originContext.expectedOrigin,
        expectedRPID: originContext.rpID,
        hintedUserId: userId
      });

      return res.json({
        ok: true,
        sessionId,
        options,
        mode: allowCredentials?.length ? 'known-user' : 'discoverable'
      });
    } catch (error) {
      console.error('[auth][passkeys] login options failed:', error);
      return res.status(500).json({
        ok: false,
        code: 'PASSKEY_AUTH_OPTIONS_FAILED',
        message: error?.message || 'Unable to start passkey authentication'
      });
    }
  });

  router.post('/passkeys/login/verify', async (req, res) => {
    const session = consumeChallengeSession(req.body?.sessionId, 'authentication');
    if (!session) {
      return res.status(410).json({
        ok: false,
        code: 'PASSKEY_SESSION_EXPIRED',
        message: 'Passkey authentication session expired. Start again.'
      });
    }

    const credentialId = String(req.body?.credential?.id || '').trim();
    const match = findUserByPasskeyId(users, credentialId);
    if (!match) {
      return res.status(404).json({
        ok: false,
        code: 'PASSKEY_NOT_FOUND',
        message: 'Passkey was not recognized'
      });
    }

    const { user, passkey } = match;

    try {
      const verification = await verifyAuthenticationResponse({
        response: req.body?.credential,
        expectedChallenge: session.challenge,
        expectedOrigin: session.expectedOrigin,
        expectedRPID: session.expectedRPID,
        requireUserVerification: true,
        credential: {
          id: passkey.id,
          publicKey: deserializeCredentialPublicKey(passkey.publicKey),
          counter: Number(passkey.counter || 0),
          transports: sanitizeTransports(passkey.transports)
        }
      });

      if (!verification.verified) {
        return res.status(401).json({
          ok: false,
          code: 'PASSKEY_AUTH_FAILED',
          message: 'Passkey authentication failed'
        });
      }

      passkey.counter = Number(verification.authenticationInfo.newCounter || passkey.counter || 0);
      passkey.deviceType = verification.authenticationInfo.credentialDeviceType || passkey.deviceType || 'multiDevice';
      passkey.backedUp = verification.authenticationInfo.credentialBackedUp === true;
      passkey.lastUsedAt = new Date().toISOString();
      user.updatedAt = new Date().toISOString();
      persistIfPossible();

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
    } catch (error) {
      console.error('[auth][passkeys] login verify failed:', error);
      return res.status(401).json({
        ok: false,
        code: 'PASSKEY_AUTH_VERIFY_FAILED',
        message: error?.message || 'Unable to verify passkey authentication'
      });
    }
  });
}

module.exports = {
  registerPasskeyRoutes
};
