# End-To-End Encryption

## Stack

- Curve25519 for Diffie-Hellman key agreement
- AES-256-CBC for payload encryption
- HMAC-SHA256 for message authentication
- X3DH-style bootstrap for initial shared secret derivation
- Double Ratchet for forward secrecy and post-compromise recovery

## Implementation

- `packages/crypto/src/prekeys.ts`
  X3DH-style identity, signed pre-key, and one-time pre-key helpers
- `packages/crypto/src/double-ratchet.ts`
  Double Ratchet session state, encrypt, decrypt, skipped-key handling
- `packages/crypto/src/files.ts`
  encrypted file payload and chunk helpers for client-side uploads
- `apps/web/src/features/chats/e2ee-client.ts`
  browser-side session bootstrap and plaintext cache for the web demo
- `apps/web/src/features/chats/use-realtime-messenger.ts`
  client-side message encryption before WebSocket send

## Current Web Flow

1. The browser creates or loads a local secure session.
2. Plaintext is encrypted on the client before `message:send` or `message:edit`.
3. The server stores and fans out the opaque envelope.
4. The sender can recover plaintext from the local ratchet/cache state.

## Important Limitation

The TypeScript crypto library now implements the cryptographic primitives and session state locally, but the demo app still uses a local bootstrap session instead of a fully authenticated device-bundle service.

That means:

- the relay remains blind to message plaintext
- forward secrecy exists inside the client ratchet flow
- the next production milestone is authenticated multi-device pre-key exchange and group sender keys
