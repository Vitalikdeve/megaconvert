# Development Roadmap

## Phase 1: Foundation

- Replace the in-memory repository with PostgreSQL-backed messaging adapters.
- Add account bootstrap, session cookies, device registration, and user presence.
- Stand up Drizzle migrations and seed scripts for local development.

## Phase 2: Signal-Compatible Encryption

- Finish authenticated X3DH device bundle exchange over the backend.
- Add signed pre-key rotation, one-time pre-key replenishment, and session archival.
- Add hardware-backed key storage and secure export/import for device migration.
- Expand the client ratchet path from local bootstrap to remote peer onboarding.

## Phase 3: Groups And Delivery Guarantees

- Add group membership workflows, sender keys, and admin roles.
- Add delivery states, read receipts, and durable offline queue replay.
- Add cross-device sync and encrypted conversation snapshots.

## Phase 4: Media And Storage

- Persist encrypted upload manifests and file key envelopes per conversation.
- Persist upload manifests, part tracking, and resumable recovery state.
- Add image/video transcoding workers for previews while keeping originals opaque.

## Phase 5: Calls

- Add TURN/STUN fleet management and region-aware routing.
- Implement voice, video, and screen share flows with renegotiation support.
- Add call recovery, device handoff, and quality telemetry.

## Phase 6: Production Hardening

- Add OpenTelemetry, structured audit logging, and SLO dashboards.
- Add abuse controls, invite throttling, and upload malware scanning gates.
- Add disaster recovery, key rotation runbooks, and formal security review.
