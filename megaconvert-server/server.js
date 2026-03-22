import express from 'express';
import dotenv from 'dotenv';
import fs from 'fs';
import multer from 'multer';
import path from 'path';
import { createHmac, randomUUID, timingSafeEqual } from 'crypto';
import { fileURLToPath } from 'url';
import { google } from 'googleapis';
import { WebSocketServer } from 'ws';

const app = express();
const port = Number(process.env.PORT || 8080);
app.use(express.json({
    verify: (req, _res, buffer) => {
        req.rawBody = buffer.toString('utf8');
    }
}));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

const uploadsDir = path.join(__dirname, 'uploads');
const moderationReportsDir = path.join(__dirname, 'moderation_reports');

fs.mkdirSync(uploadsDir, { recursive: true });
fs.mkdirSync(moderationReportsDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname || '');
        cb(null, `${randomUUID()}${ext}`);
    }
});

const upload = multer({ storage });

app.post('/upload', upload.single('encryptedFile'), (req, res) => {
    if (!req.file) {
        res.status(400).send('No file uploaded.');
        return;
    }

    const fileId = req.file.filename;
    console.log(`[HTTP] Received file: ${fileId} (${req.file.size} bytes)`);
    res.json({ success: true, fileId });
});

app.get('/download/:fileId', (req, res) => {
    const filePath = path.join(uploadsDir, req.params.fileId);
    if (!fs.existsSync(filePath)) {
        res.status(404).send('File not found');
        return;
    }
    res.download(filePath);
});

const server = app.listen(port, () => {
    console.log(`[MegaConvert] Signaling Server running locally on port ${port}`);
});

const wss = new WebSocketServer({ server });
const activeClients = new Map();
const identityByPublicKey = new Map(); // publicKey -> googleAuthId
const registeredBots = new Map(); // botPublicKey -> { webhookUrl: "https://..." }
const proUsers = new Map(); // userPublicKey(or userId) -> { isPro: true, ... }
const verifiedCompanyUsers = new Map(); // userIdentifier -> { verifiedCompany, badge, updatedAt }

const GOOGLE_PLAY_PACKAGE_NAME = process.env.GOOGLE_PLAY_PACKAGE_NAME || 'com.megaconvert.business';
const GOOGLE_PLAY_SCOPE = 'https://www.googleapis.com/auth/androidpublisher';

function loadGoogleServiceAccountCredentials() {
    const rawJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_JSON;
    if (rawJson) {
        try {
            return JSON.parse(rawJson);
        } catch (error) {
            console.error('[Billing] GOOGLE_SERVICE_ACCOUNT_KEY_JSON is invalid JSON');
        }
    }

    const keyPath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH;
    if (keyPath && fs.existsSync(keyPath)) {
        try {
            const fileContent = fs.readFileSync(keyPath, 'utf-8');
            return JSON.parse(fileContent);
        } catch (error) {
            console.error('[Billing] Failed to read service account key file:', error.message);
        }
    }

    return null;
}

const googleCredentials = loadGoogleServiceAccountCredentials();
const androidPublisher = googleCredentials
    ? google.androidpublisher({
        version: 'v3',
        auth: new google.auth.GoogleAuth({
            credentials: googleCredentials,
            scopes: [GOOGLE_PLAY_SCOPE]
        })
    })
    : null;

if (androidPublisher) {
    console.log('[Billing] Google Play Developer API initialized.');
} else {
    console.warn('[Billing] Google Play Developer API is not configured. Set GOOGLE_SERVICE_ACCOUNT_KEY_PATH or GOOGLE_SERVICE_ACCOUNT_KEY_JSON.');
}

function shortKey(key) {
    if (!key || typeof key !== 'string') return 'unknown';
    return key.substring(0, 8);
}

function timingSafeCompareHex(leftHex, rightHex) {
    if (!leftHex || !rightHex) return false;
    const left = Buffer.from(leftHex, 'hex');
    const right = Buffer.from(rightHex, 'hex');
    if (left.length !== right.length) return false;
    return timingSafeEqual(left, right);
}

function getSheerIdSignatureHeader(req) {
    return req.headers['x-sheerid-signature']
        || req.headers['sheerid-signature']
        || req.headers['x-webhook-signature'];
}

function normalizeHexSignature(signatureHeader) {
    if (!signatureHeader || typeof signatureHeader !== 'string') return null;
    return signatureHeader.trim().replace(/^sha256=/i, '');
}

function verifySheerIdSignature(req) {
    const webhookSecret = process.env.SHEERID_WEBHOOK_SECRET;
    if (!webhookSecret) {
        console.error('[SheerID] Missing SHEERID_WEBHOOK_SECRET env.');
        return { ok: false, reason: 'server_not_configured' };
    }

    const rawBody = req.rawBody || '';
    const signatureHeader = getSheerIdSignatureHeader(req);
    const incomingHex = normalizeHexSignature(signatureHeader);
    if (!incomingHex) {
        return { ok: false, reason: 'missing_signature' };
    }

    const expectedHex = createHmac('sha256', webhookSecret)
        .update(rawBody)
        .digest('hex');

    const valid = timingSafeCompareHex(expectedHex, incomingHex);
    return { ok: valid, reason: valid ? null : 'invalid_signature' };
}

function sendVerificationSuccess(userIdentifier, badge = 'corporate') {
    let delivered = 0;
    const payload = JSON.stringify({
        type: 'verification_success',
        badge
    });

    const direct = activeClients.get(userIdentifier);
    if (direct && direct.readyState === 1) {
        direct.send(payload);
        delivered += 1;
    }

    for (const [publicKey, googleAuthId] of identityByPublicKey.entries()) {
        if (googleAuthId !== userIdentifier) continue;
        const ws = activeClients.get(publicKey);
        if (ws && ws.readyState === 1) {
            ws.send(payload);
            delivered += 1;
        }
    }

    return delivered;
}

function deleteAccountRecords({ publicKey, googleAuthId }) {
    const keysToDelete = new Set();

    if (publicKey && typeof publicKey === 'string') {
        keysToDelete.add(publicKey);
    }

    if (googleAuthId && typeof googleAuthId === 'string') {
        for (const [key, uid] of identityByPublicKey.entries()) {
            if (uid === googleAuthId) {
                keysToDelete.add(key);
            }
        }
    }

    for (const key of keysToDelete) {
        const ws = activeClients.get(key);
        if (ws && ws.readyState === 1) {
            ws.close(4001, 'Account deleted');
        }
        activeClients.delete(key);
        identityByPublicKey.delete(key);
        registeredBots.delete(key);
    }

    return keysToDelete.size;
}

app.post('/bots/register', (req, res) => {
    const botPublicKey = req.body?.botPublicKey || req.body?.publicKey;
    const webhookUrl = req.body?.webhookUrl;

    if (!botPublicKey || !webhookUrl) {
        res.status(400).json({ success: false, error: 'botPublicKey/publicKey and webhookUrl are required' });
        return;
    }

    registeredBots.set(botPublicKey, { webhookUrl });
    console.log(`[BOT] Registered bot with key ${shortKey(botPublicKey)}... -> ${webhookUrl}`);
    res.json({ success: true });
});

app.delete('/account', (req, res) => {
    const publicKey = req.body?.publicKey;
    const googleAuthId = req.body?.googleAuthId;

    const removed = deleteAccountRecords({ publicKey, googleAuthId });
    console.log(
        `[GDPR] Account deletion requested. publicKey=${shortKey(publicKey)} googleAuthId=${googleAuthId || 'none'} removedSessions=${removed}`
    );
    res.json({ success: true, removedSessions: removed });
});

app.post('/dsa/report', (req, res) => {
    const {
        messageId,
        reason,
        ciphertext,
        plaintext,
        offenderPublicKey,
        reporterPublicKey,
        reportedAt
    } = req.body || {};

    if (!messageId || !reason || !ciphertext || !plaintext || !offenderPublicKey) {
        res.status(400).json({
            success: false,
            error: 'messageId, reason, ciphertext, plaintext, offenderPublicKey are required'
        });
        return;
    }

    const report = {
        messageId,
        reason,
        ciphertext,
        plaintext,
        offenderPublicKey,
        reporterPublicKey: reporterPublicKey || null,
        reportedAt: reportedAt || Date.now()
    };

    const fileName = `${Date.now()}-${randomUUID()}.json`;
    const filePath = path.join(moderationReportsDir, fileName);
    fs.writeFileSync(filePath, JSON.stringify(report, null, 2), 'utf-8');

    console.log(
        `[DSA] Report saved: ${fileName} reason=${reason} offender=${shortKey(offenderPublicKey)} messageId=${messageId}`
    );
    res.json({ success: true, reportId: fileName });
});

app.post('/webhooks/sheerid', (req, res) => {
    const signatureCheck = verifySheerIdSignature(req);
    if (!signatureCheck.ok) {
        const statusCode = signatureCheck.reason === 'server_not_configured' ? 503 : 401;
        res.status(statusCode).json({
            success: false,
            error: `SheerID signature check failed: ${signatureCheck.reason}`
        });
        return;
    }

    const payload = req.body || {};
    const verificationStatus = String(
        payload.verificationStatus
        || payload.status
        || payload.eventStatus
        || ''
    ).toUpperCase();

    const userIdentifier = payload.userIdentifier
        || payload.personId
        || payload.externalId
        || payload.metadata?.userIdentifier
        || payload.metadata?.externalId;

    if (!userIdentifier) {
        res.status(400).json({ success: false, error: 'userIdentifier is required in webhook payload' });
        return;
    }

    if (verificationStatus !== 'SUCCESS') {
        console.log(`[SheerID] Ignored status=${verificationStatus || 'UNKNOWN'} for ${shortKey(String(userIdentifier))}`);
        res.json({ success: true, ignored: true, reason: `status_${verificationStatus || 'UNKNOWN'}` });
        return;
    }

    verifiedCompanyUsers.set(String(userIdentifier), {
        verifiedCompany: true,
        badge: 'corporate',
        updatedAt: Date.now()
    });

    const deliveredCount = sendVerificationSuccess(String(userIdentifier), 'corporate');
    console.log(
        `[SheerID] SUCCESS for ${shortKey(String(userIdentifier))}; ws_notifications=${deliveredCount}`
    );

    res.json({
        success: true,
        verificationStatus: 'SUCCESS',
        deliveredCount
    });
});

async function verifyAndAcknowledgeSubscription({ purchaseToken, productId }) {
    if (!androidPublisher) {
        throw new Error('Google Play billing API is not configured on server.');
    }

    const verification = await androidPublisher.purchases.subscriptions.get({
        packageName: GOOGLE_PLAY_PACKAGE_NAME,
        subscriptionId: productId,
        token: purchaseToken
    });

    const subscription = verification.data || {};
    const paymentState = Number(subscription.paymentState ?? -1);
    const isPaid = paymentState === 1;
    if (!isPaid) {
        throw new Error(`Subscription is not in paid state. paymentState=${paymentState}`);
    }

    const acknowledgementState = Number(subscription.acknowledgementState ?? 0);
    if (acknowledgementState !== 1) {
        await androidPublisher.purchases.subscriptions.acknowledge({
            packageName: GOOGLE_PLAY_PACKAGE_NAME,
            subscriptionId: productId,
            token: purchaseToken,
            requestBody: {
                developerPayload: 'megaconvert-server-ack'
            }
        });
    }

    return subscription;
}

async function handleBillingVerify(req, res) {
    const {
        purchaseToken,
        productId,
        userPublicKey,
        userId,
        googleAuthId
    } = req.body || {};

    if (!purchaseToken || !productId) {
        res.status(400).json({
            success: false,
            error: 'purchaseToken and productId are required'
        });
        return;
    }

    const identity = userPublicKey || userId || googleAuthId;
    if (!identity) {
        res.status(400).json({
            success: false,
            error: 'userPublicKey (or userId/googleAuthId) is required'
        });
        return;
    }

    if (!androidPublisher) {
        res.status(503).json({
            success: false,
            error: 'Google Play billing API is not configured on server'
        });
        return;
    }

    try {
        const subscription = await verifyAndAcknowledgeSubscription({
            purchaseToken,
            productId
        });

        // Replace this in-memory map with persistent DB update in production.
        proUsers.set(identity, {
            isPro: true,
            productId,
            purchaseToken,
            paymentState: subscription.paymentState ?? null,
            expiryTimeMillis: subscription.expiryTimeMillis ?? null,
            updatedAt: Date.now()
        });

        console.log(
            `[Billing] Verified subscription for ${shortKey(identity)} product=${productId} paymentState=${subscription.paymentState}`
        );
        res.status(200).json({
            success: true,
            isPro: true,
            productId,
            expiresAt: subscription.expiryTimeMillis ?? null
        });
    } catch (error) {
        console.error('[Billing] Receipt verification failed:', error.message);
        res.status(400).json({
            success: false,
            error: error.message || 'Receipt verification failed'
        });
    }
}

app.post('/billing/verify', handleBillingVerify);
// Backward compatibility for old clients that still use /billing/validate
app.post('/billing/validate', handleBillingVerify);

app.post('/bots/reply', (req, res) => {
    const to = req.body?.to;
    const fromBotPublicKey = req.body?.fromBotPublicKey;
    const ciphertext = req.body?.ciphertext;
    const iv = req.body?.iv;
    const action = req.body?.action;

    if (!to || !fromBotPublicKey || !ciphertext || !iv) {
        res.status(400).json({
            success: false,
            error: 'to, fromBotPublicKey, ciphertext and iv are required'
        });
        return;
    }

    const recipientWs = activeClients.get(to);
    if (!recipientWs || recipientWs.readyState !== 1) {
        res.status(202).json({ success: false, status: 'offline' });
        return;
    }

    const payload = {
        type: 'message',
        from: fromBotPublicKey,
        to,
        ciphertext,
        iv
    };
    if (action) {
        payload.action = action;
    }

    recipientWs.send(JSON.stringify(payload));
    console.log(`[BOT] Delivered bot message from ${shortKey(fromBotPublicKey)} to ${shortKey(to)}`);
    res.json({ success: true });
});

wss.on('connection', (ws) => {
    let currentPublicKey = null;

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message.toString());
            if (data.type === 'auth') {
                currentPublicKey = data.publicKey;
                activeClients.set(currentPublicKey, ws);
                if (data.googleAuthId && typeof data.googleAuthId === 'string') {
                    identityByPublicKey.set(currentPublicKey, data.googleAuthId);
                }
                console.log(`[+] Client connected: ${currentPublicKey.substring(0, 8)}...`);

                const directVerification = verifiedCompanyUsers.get(currentPublicKey);
                const accountVerification = data.googleAuthId
                    ? verifiedCompanyUsers.get(data.googleAuthId)
                    : null;
                const verifiedPayload = directVerification || accountVerification;
                if (verifiedPayload?.verifiedCompany) {
                    ws.send(JSON.stringify({
                        type: 'verification_success',
                        badge: verifiedPayload.badge || 'corporate'
                    }));
                }
                return;
            }
            if (data.type === 'account_delete') {
                const publicKey = data.publicKey || currentPublicKey;
                const googleAuthId = data.googleAuthId;
                const removed = deleteAccountRecords({ publicKey, googleAuthId });
                console.log(`[GDPR] WS account_delete for ${shortKey(publicKey)} removedSessions=${removed}`);
                return;
            }
            if (data.type === 'register_bot') {
                if (!data.botPublicKey || !data.webhookUrl) {
                    console.log('[BOT] Invalid register_bot payload.');
                    return;
                }

                registeredBots.set(data.botPublicKey, { webhookUrl: data.webhookUrl });
                console.log(`[BOT] Registered bot with key ${data.botPublicKey.substring(0,8)}... -> ${data.webhookUrl}`);
                return;
            }
            if (['message', 'offer', 'answer', 'ice_candidate', 'ice-candidate'].includes(data.type)) {
                const recipientWs = activeClients.get(data.to);
                if (recipientWs && recipientWs.readyState === 1) {
                    recipientWs.send(JSON.stringify(data));
                    console.log(`[->] Routed ${data.type} from ${shortKey(currentPublicKey)} to ${shortKey(data.to)}`);
                } else if (registeredBots.has(data.to)) {
                    const botInfo = registeredBots.get(data.to);
                    fetch(botInfo.webhookUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(data)
                    }).catch((err) => console.error(`[Webhook Failed] ${botInfo.webhookUrl}:`, err));
                } else {
                    // User offline. Persist to DB here if offline queue is enabled.
                    console.log(`[!] Recipient ${shortKey(data.to)} is offline for ${data.type}.`);
                }
            }
        } catch (e) {
            console.error("Invalid JSON");
        }
    });

    ws.on('close', () => {
        if (currentPublicKey) {
            activeClients.delete(currentPublicKey);
            identityByPublicKey.delete(currentPublicKey);
            console.log(`[-] Client disconnected: ${currentPublicKey.substring(0, 8)}...`);
        }
    });
});
