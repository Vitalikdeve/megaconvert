# Production Messenger Architecture

## Overview

This workspace now supports a production-oriented messenger topology with:

- JWT-protected Fastify API nodes
- stateless Socket.io realtime nodes
- Redis-backed presence, distributed rate limiting, and realtime fanout
- Signal-inspired client-side encryption with device bundle registration
- WebRTC offer/answer/ICE signaling
- MinIO or S3-compatible multipart uploads up to 10 GB
- Web Push subscriptions for offline notifications

## Server Modules

- `apps/server/src/modules/auth`
  - `/register`
  - `/login`
  - `/users`
  - bcrypt password hashing
  - JWT issuance

- `apps/server/src/modules/encryption`
  - `/v1/encryption/devices/register`
  - `/v1/encryption/users/:userId/pre-key-bundle`
  - stores only public device bundles on the server

- `apps/server/src/modules/uploads`
  - `/upload/start`
  - `/upload/complete`
  - `/v1/uploads/*`
  - object keys are stored as `chatId/messageId/fileId`

- `apps/server/src/modules/calls`
  - Socket.io signaling for:
    - `call_offer`
    - `call_answer`
    - `ice_candidate`
    - `call:offer`
    - `call:answer`
    - `call:ice-candidate`

- `apps/server/src/modules/notifications`
  - `/v1/notifications/subscriptions`
  - Web Push fanout for offline recipients

- `apps/server/src/modules/realtime`
  - Redis adapter for Socket.io
  - Redis pub/sub fanout between API and realtime nodes
  - per-user presence tracking

## Security Model

- Passwords are hashed with bcrypt before storage.
- Clients receive JWTs from `/register` and `/login`.
- Protected API routes require bearer auth.
- Socket.io connections require the same JWT during handshake.
- Messages are encrypted in the browser before transport.
- The server stores ciphertext envelopes and public key bundles, not plaintext chat bodies.

## Realtime Scale Path

- API nodes stay stateless.
- WebSocket nodes stay stateless.
- Redis is the shared coordination layer for:
  - Socket.io adapter state
  - message fanout
  - rate limiting
  - user presence
  - notification subscription storage

## Client Integration

- Device keys are generated on first authenticated session and registered through `/v1/encryption/devices/register`.
- The chat client now sends encrypted envelopes over authenticated Socket.io.
- Upload requests use authenticated presign/start and complete flows.
- Call signaling reuses the authenticated realtime connection.

## Current Limitations

- The browser crypto flow is Signal-inspired and uses X3DH-style bootstrap plus Double Ratchet primitives, but the demo UI still uses a simplified conversation model rather than full multi-device group sender keys.
- Next.js still emits a non-blocking warning about top-level await in the libsodium-backed crypto module during production build.
- Web Push is implemented server-side; a full service-worker subscription UX is still a follow-up on the frontend.
