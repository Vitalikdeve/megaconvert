# Architecture

## Monorepo Layout

```text
apps/
  web/
    app/                     # Next.js App Router entrypoints
    src/components/          # liquid glass shell components
    src/features/            # feature-local view models and mock data
  server/
    src/config/              # env loading and runtime config
    src/core/                # logger, cross-cutting primitives
    src/modules/
      health/
      messaging/
        domain/
        application/
        infra/
        presentation/
      realtime/
      uploads/
packages/
  shared/                    # DTOs, zod contracts, event schemas
  crypto/                    # identity/signing/media helper layer
  database/                  # Drizzle schema + DB factory
  ui/                        # shared UI primitives
```

## Backend Clean Architecture

Each backend module follows the same rule set:

1. `domain/` owns entities, repository ports, and invariants.
2. `application/` owns use cases and orchestration.
3. `infra/` owns adapters such as PostgreSQL, Redis, S3, or in-memory stubs.
4. `presentation/` owns HTTP routes, WebSocket event handlers, and DTO parsing.

That keeps Fastify thin and makes it straightforward to replace the in-memory message repository with PostgreSQL without rewriting handlers.

## Security Model

- The relay is designed to transport ciphertext envelopes and metadata, not plaintext.
- Device identity keys, X3DH bootstrap, Double Ratchet sessions, and file encryption live in `packages/crypto`.
- Attachment encryption is client-side; object storage only receives ciphertext blobs.
- The current web demo bootstraps its ratchet session locally so the relay stays blind while we finish authenticated device bundle exchange.
- Group messaging should evolve toward sender keys and authenticated bundle distribution once the device service lands.

## Realtime

- `Socket.io` handles room membership, typing indicators, message fan-out, and WebRTC signaling.
- Raw `WebSocket` is exposed via `/ws/health` for low-level health checks and future internal streaming paths.
- Redis is optional in local dev and required once we scale Socket.io horizontally.

## Calls

- Browser peers use WebRTC directly for media.
- The backend only brokers signaling: offer, answer, ICE candidates, and call presence.
- TURN/STUN infrastructure is a dedicated roadmap item and should be region-aware in production.

## Files

- The server initiates multipart uploads and signs individual part URLs.
- Part size is fixed at 16 MB, which comfortably supports resumable uploads up to 10 GB.
- Metadata and key envelopes should be persisted in PostgreSQL after the media service milestone.
