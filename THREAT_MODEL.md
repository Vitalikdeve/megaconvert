# Threat Model (Pre-Audit Draft)

## System Overview

MegaConvert Business consists of:

- Android client (`mobile`): key generation, E2EE, local encrypted persistence.
- Node.js relay (`megaconvert-server`): signaling/routing of ciphertext, file blob relay, billing/webhook integrations.

Trust assumptions:

- Relay server is *untrusted* for message confidentiality (only ciphertext should pass through).
- Endpoint device and Android Keystore are the primary roots of trust.

---

## Assets to Protect

- Private identity keys (X25519)
- Derived session secrets and AES keys
- Message plaintext
- Local encrypted message database
- Billing and verification webhooks integrity

---

## Threats and Mitigations

## 1) MITM on Network Transport

Threat:

- Attacker intercepts or modifies signaling traffic.

Mitigations:

- End-to-end encryption with X25519 + AES-GCM-256.
- AES-GCM authentication tag rejects tampered ciphertext.
- Optional SAS/emoji verification in call flows to reduce impersonation risk.
- Webhook signature verification (`HMAC-SHA256`) for third-party callbacks.

Residual risk:

- Metadata exposure (timing, routing identifiers) on transport layer.

---

## 2) Physical Device Extraction

Threat:

- Stolen device; attacker tries to read local DB or keys.

Mitigations:

- SQLCipher encryption for Room database file at rest.
- Key material generated/stored in Android Keystore.
- Session/account wipe flow deletes DB, local state, and keystore aliases.

Residual risk:

- Compromised/rooted devices or runtime memory scraping during active sessions.

---

## 3) Signaling Server Compromise

Threat:

- Full server takeover (code/data access).

Mitigations:

- Server stores/routs ciphertext blobs, not plaintext by design.
- Signature checks for sensitive webhooks (SheerID).
- Billing token verification delegated to Google Play API.

Residual risk:

- Traffic analysis, user relationship graph, denial-of-service, malicious message dropping/replay attempts.

---

## 4) Secret Leakage via Source Control

Threat:

- API keys, local configs, and service credentials accidentally committed.

Mitigations:

- Android runtime config from `mobile/local.properties`.
- Node runtime secrets from `megaconvert-server/.env`.
- `.gitignore` rules block local secret files.
- `.example` templates provide safe onboarding.

Residual risk:

- Historical leaks in prior commits unless rotated and purged.

---

## Security Hardening Backlog (Post-Audit)

- Enforce WebSocket auth token lifetime + replay protection.
- Move in-memory server maps to hardened persistent store with audit logs.
- Add automated secret scanning in CI (pre-commit + pipeline).
- Add certificate pinning strategy for production endpoints.
- Add external pen-test findings tracker with SLA by severity.
