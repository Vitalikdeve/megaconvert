import express from 'express';
import { EventEmitter } from 'events';
import {
    createCipheriv,
    createDecipheriv,
    createPrivateKey,
    createPublicKey,
    diffieHellman,
    hkdfSync,
    randomBytes
} from 'crypto';

const GCM_IV_LENGTH = 12;
const GCM_TAG_LENGTH = 16;
const HKDF_SALT = Buffer.from('megaconvert-hkdf-salt-v1', 'utf8');
const HKDF_INFO = Buffer.from('megaconvert-e2ee-aes-256', 'utf8');

export class MegaBot extends EventEmitter {
    constructor({
        privateKey,
        serverUrl = 'http://127.0.0.1:8080',
        webhookPath = '/webhook',
        publicWebhookBaseUrl = null
    }) {
        super();

        if (!privateKey || typeof privateKey !== 'string') {
            throw new Error('privateKey is required and must be a hex string');
        }

        this.serverUrl = serverUrl.replace(/\/+$/, '');
        this.webhookPath = webhookPath.startsWith('/') ? webhookPath : `/${webhookPath}`;
        this.publicWebhookBaseUrl = publicWebhookBaseUrl
            ? publicWebhookBaseUrl.replace(/\/+$/, '')
            : null;

        this.privateKeyHex = privateKey;
        this.privateKeyObject = createPrivateKey({
            key: Buffer.from(privateKey, 'hex'),
            format: 'der',
            type: 'pkcs8'
        });
        this.publicKeyHex = createPublicKey(this.privateKeyObject)
            .export({ format: 'der', type: 'spki' })
            .toString('hex');

        this.webhookServer = null;
    }

    async listen(port = 3000, host = '0.0.0.0') {
        if (this.webhookServer) {
            throw new Error('Webhook server is already running');
        }

        const app = express();
        app.use(express.json({ limit: '2mb' }));

        app.post(this.webhookPath, (req, res) => {
            try {
                const message = this._decodeIncomingPacket(req.body ?? {});
                this.emit('message', message);
                res.json({ success: true });
            } catch (error) {
                this.emit('error', error);
                res.status(400).json({ success: false, error: error.message });
            }
        });

        await new Promise((resolve) => {
            this.webhookServer = app.listen(port, host, resolve);
        });

        const webhookUrl = this.publicWebhookBaseUrl
            ? `${this.publicWebhookBaseUrl}${this.webhookPath}`
            : `http://127.0.0.1:${port}${this.webhookPath}`;

        await this.registerWebhook(webhookUrl);
        return this;
    }

    async close() {
        if (!this.webhookServer) return;
        await new Promise((resolve, reject) => {
            this.webhookServer.close((error) => {
                if (error) reject(error);
                else resolve();
            });
        });
        this.webhookServer = null;
    }

    async registerWebhook(webhookUrl) {
        const response = await fetch(`${this.serverUrl}/bots/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                botPublicKey: this.publicKeyHex,
                webhookUrl
            })
        });

        if (!response.ok) {
            throw new Error(`Webhook registration failed: HTTP ${response.status}`);
        }
    }

    async reply(to, text, options = {}) {
        if (!to || typeof to !== 'string') {
            throw new Error('reply() requires recipient public key in "to"');
        }

        const payloadText = this._encodeBotPayload(text, options.buttons);
        const encrypted = this._encryptForRecipient(payloadText, to);

        const response = await fetch(`${this.serverUrl}/bots/reply`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                to,
                fromBotPublicKey: this.publicKeyHex,
                ciphertext: encrypted.ciphertextBase64,
                iv: encrypted.ivBase64,
                action: options.action ?? null
            })
        });

        if (!response.ok) {
            throw new Error(`Bot reply failed: HTTP ${response.status}`);
        }
    }

    _encodeBotPayload(text, buttons) {
        const safeText = typeof text === 'string' ? text : '';
        if (!Array.isArray(buttons) || buttons.length === 0) {
            return safeText;
        }

        const normalizedButtons = buttons
            .map((button) => ({
                text: String(button?.text ?? '').trim(),
                action: String(button?.action ?? '').trim()
            }))
            .filter((button) => button.text && button.action);

        if (normalizedButtons.length === 0) {
            return safeText;
        }

        return JSON.stringify({
            text: safeText,
            buttons: normalizedButtons
        });
    }

    _decodeIncomingPacket(packet) {
        const from = String(packet?.from ?? '').trim();
        const to = String(packet?.to ?? '').trim();
        const ciphertextBase64 = String(packet?.ciphertext ?? '').trim();
        const ivBase64 = String(packet?.iv ?? '').trim();

        if (!from || !ciphertextBase64 || !ivBase64) {
            throw new Error('Invalid webhook payload');
        }

        const sharedSecret = this._deriveSharedSecret(from);
        try {
            const aesKey = this._deriveAesKey(sharedSecret);
            const iv = Buffer.from(ivBase64, 'base64');
            const ciphertextWithTag = Buffer.from(ciphertextBase64, 'base64');
            if (iv.length !== GCM_IV_LENGTH || ciphertextWithTag.length <= GCM_TAG_LENGTH) {
                throw new Error('Encrypted payload is malformed');
            }

            const encrypted = ciphertextWithTag.subarray(0, ciphertextWithTag.length - GCM_TAG_LENGTH);
            const authTag = ciphertextWithTag.subarray(ciphertextWithTag.length - GCM_TAG_LENGTH);
            const decipher = createDecipheriv('aes-256-gcm', aesKey, iv);
            decipher.setAuthTag(authTag);

            const plaintext = Buffer.concat([
                decipher.update(encrypted),
                decipher.final()
            ]).toString('utf8');

            const parsed = this._tryParseBotPayload(plaintext);
            return {
                from,
                to,
                text: parsed.text,
                buttons: parsed.buttons,
                action: packet?.action ?? null,
                raw: packet
            };
        } finally {
            sharedSecret.fill(0);
        }
    }

    _tryParseBotPayload(plaintext) {
        const normalized = plaintext.trim();
        if (!normalized.startsWith('{') || !normalized.endsWith('}')) {
            return { text: plaintext, buttons: null };
        }

        try {
            const parsed = JSON.parse(normalized);
            const text = typeof parsed?.text === 'string' && parsed.text.trim()
                ? parsed.text
                : plaintext;
            const buttons = Array.isArray(parsed?.buttons)
                ? parsed.buttons
                    .map((button) => ({
                        text: String(button?.text ?? '').trim(),
                        action: String(button?.action ?? '').trim()
                    }))
                    .filter((button) => button.text && button.action)
                : null;

            return { text, buttons: buttons?.length ? buttons : null };
        } catch {
            return { text: plaintext, buttons: null };
        }
    }

    _encryptForRecipient(plaintext, recipientPublicKeyHex) {
        const sharedSecret = this._deriveSharedSecret(recipientPublicKeyHex);
        try {
            const aesKey = this._deriveAesKey(sharedSecret);
            const iv = randomBytes(GCM_IV_LENGTH);

            const cipher = createCipheriv('aes-256-gcm', aesKey, iv);
            const encrypted = Buffer.concat([
                cipher.update(Buffer.from(plaintext, 'utf8')),
                cipher.final()
            ]);
            const authTag = cipher.getAuthTag();
            const ciphertextWithTag = Buffer.concat([encrypted, authTag]);

            return {
                ivBase64: iv.toString('base64'),
                ciphertextBase64: ciphertextWithTag.toString('base64')
            };
        } finally {
            sharedSecret.fill(0);
        }
    }

    _deriveSharedSecret(peerPublicKeyHex) {
        const peerPublicKey = createPublicKey({
            key: Buffer.from(peerPublicKeyHex, 'hex'),
            format: 'der',
            type: 'spki'
        });

        return diffieHellman({
            privateKey: this.privateKeyObject,
            publicKey: peerPublicKey
        });
    }

    _deriveAesKey(sharedSecret) {
        const key = hkdfSync('sha256', sharedSecret, HKDF_SALT, HKDF_INFO, 32);
        return Buffer.isBuffer(key) ? key : Buffer.from(key);
    }
}

export default MegaBot;
