const crypto = require('crypto');
const { Router } = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');

const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const ACCESS_TOKEN_TTL = '1h';
const RESET_TOKEN_TTL = '1h';
const ACCESS_TOKEN_MAX_AGE_MS = 60 * 60 * 1000;
const RESET_LINK_BASE = (process.env.APP_BASE_URL || 'https://megaconvert.com').replace(/\/+$/g, '');
const SESSION_JWT_SECRET = process.env.JWT_SESSION_SECRET || process.env.JWT_SECRET || 'dev-session-secret-change-me';
const RESET_JWT_SECRET = process.env.JWT_RESET_SECRET || process.env.JWT_SECRET || 'dev-reset-secret-change-me';

// Temporary in-memory storage until DB is connected.
const users = [];
const usedResetTokenIds = new Set();

const normalizeEmail = (value) => String(value || '').trim().toLowerCase();

const createId = () => {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return crypto.randomBytes(16).toString('hex');
};

const toPublicUser = (user) => ({
  id: user.id,
  email: user.email,
  name: user.name,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt
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

const verifyTurnstile = async ({ turnstileToken, remoteIp }) => {
  const secret =
    process.env.CLOUDFLARE_TURNSTILE_SECRET ||
    process.env.TURNSTILE_SECRET_KEY ||
    process.env.TURNSTILE_SECRET;

  if (!secret) {
    return { ok: false, error: 'Turnstile secret is not configured' };
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
    if (!response.ok) {
      return { ok: false, error: `Turnstile HTTP ${response.status}` };
    }
    const result = await response.json();
    if (!result?.success) {
      const errorCodes = Array.isArray(result?.['error-codes']) ? result['error-codes'].join(',') : 'verification_failed';
      return { ok: false, error: errorCodes };
    }
    return { ok: true };
  } catch (error) {
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
  async register(req, res) {
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || '');
    const name = String(req.body?.name || '').trim() || email.split('@')[0] || 'User';
    const turnstileToken = String(req.body?.turnstileToken || req.body?.captchaToken || '').trim();

    if (!email || !password || !turnstileToken) {
      return res.status(400).json({
        ok: false,
        code: 'VALIDATION_ERROR',
        message: 'email, password and turnstileToken are required'
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
      createdAt: now,
      updatedAt: now
    };
    users.push(user);

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

  router.post('/register', (req, res) => controller.register(req, res));
  router.post('/login', (req, res) => controller.login(req, res));
  router.post('/forgot-password', (req, res) => controller.forgotPassword(req, res));
  router.post('/reset-password', (req, res) => controller.resetPassword(req, res));

  return router;
};

module.exports = {
  AuthController,
  createAuthRouter,
  users
};
