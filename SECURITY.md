# Security Policy

MegaConvert Business is a zero-access messaging platform in active development.

## Supported Scope

This policy applies to:

- Android client (`/mobile`)
- Local signaling and webhook backend (`/megaconvert-server`)

## Attack Surface

Primary externally reachable surfaces:

- Node.js signaling server:
  - WebSocket endpoint for encrypted message relay
  - HTTP endpoints for upload/download, billing verification, DSA reports, SheerID webhook
- Android local data layer:
  - Encrypted Room database (SQLCipher)
  - Android Keystore-backed key material

## Cryptography In Use

- Key exchange: `X25519` / `XDH` (Android Keystore)
- Symmetric encryption: `AES-GCM-256`
- Key derivation: `HKDF (HmacSHA256)`
- Transport integrity for webhooks: `HMAC-SHA256` signature verification (SheerID)

## Secrets Handling

- Android secrets/config are loaded from `mobile/local.properties` (or CI environment variables), not hardcoded in source.
- Node.js secrets are loaded from `megaconvert-server/.env` (`dotenv`).
- Do not commit:
  - `mobile/local.properties`
  - `mobile/app/google-services.json`
  - `megaconvert-server/.env`

Reference templates:

- `mobile/local.properties.example`
- `megaconvert-server/.env.example`

## Reporting a Vulnerability

Please report vulnerabilities to:

- `security@megaconvert.business`

Include:

- Affected component (`mobile` or `megaconvert-server`)
- Reproduction steps / PoC
- Impact assessment (confidentiality, integrity, availability)
- Suggested fix (if available)

We aim to acknowledge reports within 72 hours.
