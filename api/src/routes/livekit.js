const { Router } = require('express');
const { AccessToken } = require('livekit-server-sdk');

const LIVEKIT_API_KEY = String(process.env.LIVEKIT_API_KEY || 'megakey').trim() || 'megakey';
const LIVEKIT_API_SECRET = String(
  process.env.LIVEKIT_API_SECRET || 'supersecretkey12345678901234567890'
).trim() || 'supersecretkey12345678901234567890';
const LIVEKIT_TOKEN_TTL_SECONDS = Math.max(
  60,
  Number(process.env.LIVEKIT_TOKEN_TTL_SECONDS || 60 * 60)
);

const createToken = async (req, res) => {
  try {
    const room = String(req.query?.room || '').trim();
    const username = String(req.query?.username || '').trim();

    if (!room || !username) {
      return res.status(400).json({
        status: 'error',
        code: 'LIVEKIT_TOKEN_FIELDS_REQUIRED',
        message: 'room and username are required',
        requestId: req.requestId
      });
    }

    const accessToken = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity: username,
      ttl: `${LIVEKIT_TOKEN_TTL_SECONDS}s`
    });

    accessToken.addGrant({
      room,
      roomJoin: true
    });

    const token = await accessToken.toJwt();

    return res.json({ token });
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      code: 'LIVEKIT_TOKEN_FAILED',
      message: error instanceof Error ? error.message : 'Failed to create LiveKit token',
      requestId: req.requestId
    });
  }
};

const createLivekitRouter = () => {
  const router = Router();

  router.get('/livekit-token', createToken);

  return router;
};

module.exports = {
  createLivekitRouter,
  createToken
};
