# Secure Messenger Platform

Production-grade monorepo scaffold for a Telegram-style web messenger with Signal-inspired security boundaries.

This initial setup gives us:
- Next.js 15 web client with a Liquid Glass UI shell
- Fastify realtime backend with Socket.io and raw WebSocket health channel
- clean architecture module boundaries on the backend
- PostgreSQL schema package with Drizzle
- Redis-ready Socket.io fan-out
- S3-compatible multipart upload endpoints sized for 10 GB files
- crypto package for X3DH-style bootstrap, Double Ratchet messaging, and encrypted file helpers

## 1. Folder Structure

```text
messenger-platform/
├─ apps/
│  ├─ server/              # Fastify API, Socket.io, WebRTC signaling, uploads
│  └─ web/                 # Next.js 15 app router client
├─ packages/
│  ├─ crypto/              # identity keys, signatures, attachment encryption helpers
│  ├─ database/            # Drizzle schema + PostgreSQL client factory
│  ├─ shared/              # zod contracts, event payloads, DTOs
│  └─ ui/                  # shared glass UI primitives
├─ docs/
│  ├─ ARCHITECTURE.md
│  └─ ROADMAP.md
├─ docker-compose.yml
├─ package.json
├─ tsconfig.base.json
└─ turbo.json
```

## 2. Required Dependencies

### Root toolchain
- `turbo`
- `typescript`
- `tsup`
- `eslint`
- `typescript-eslint`
- `prettier`

### Web app
- `next@15.5.14`
- `react@19.2.4`
- `react-dom@19.2.4`
- `framer-motion`
- `socket.io-client`
- `lucide-react`
- `@tailwindcss/postcss`
- `tailwindcss`
- `zod`

### Server
- `fastify`
- `@fastify/cors`
- `@fastify/helmet`
- `@fastify/multipart`
- `@fastify/rate-limit`
- `@fastify/websocket`
- `socket.io`
- `@socket.io/redis-adapter`
- `ioredis`
- `@aws-sdk/client-s3`
- `@aws-sdk/s3-request-presigner`
- `zod`
- `tsx`

### Shared packages
- `drizzle-orm`
- `drizzle-kit`
- `postgres`
- `@noble/curves`
- `@noble/hashes`
- `clsx`
- `tailwind-merge`

## 3. Initial Project Setup

```bash
cd messenger-platform
npm install
cp .env.example .env
docker compose up -d --build
npm run dev
```

Default local endpoints:
- Web: `http://localhost:3000`
- API: `http://localhost:8080`
- Realtime: `http://localhost:8090`
- MinIO console: `http://localhost:9001`

Database workflow:

```bash
npm run db:generate
npm run db:migrate
```

## 4. Development Roadmap

The full roadmap lives in `docs/ROADMAP.md`. The short version:

1. Ship authenticated device bundle exchange and signed pre-key rotation.
2. Move messaging persistence from memory adapter to PostgreSQL.
3. Add group sender keys and cross-device session sync.
4. Add encrypted media pipeline and resumable sync.
5. Expand call recovery, TURN orchestration, and device handoff.
6. Add observability, abuse controls, and production hardening.

## Architecture Notes

- Backend modules follow `domain -> application -> infra -> presentation`.
- The server is treated as a blind relay for encrypted payloads.
- Messages are encrypted on the client with Curve25519, AES-256-CBC, and HMAC-SHA256 before transport.
- Files are uploaded via S3 multipart and should be encrypted client-side before part upload.
- Calls use WebRTC with Socket.io only for signaling and presence.
- Docker now supports separate `api` and `realtime` services with PostgreSQL, Redis, and MinIO. See `docs/DOCKER_BACKEND.md`.

See `docs/ARCHITECTURE.md` for the clean architecture mapping.
