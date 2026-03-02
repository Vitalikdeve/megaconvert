# MegaConvert Encryption Model

## Practical Security Model

MegaConvert uses an E2E-inspired model designed for server-side conversion workloads:

- TLS in transit (HTTPS + HSTS)
- AES-256-GCM for client private mode payloads
- envelope key wrapping per conversion session
- short-lived session keys in Redis
- encrypted output support and auto-cleanup in workers

## Why Not Pure E2E

Pure E2E is not compatible with server-side conversion because data must be decrypted for processing.
MegaConvert applies maximum practical security while preserving conversion functionality.

## Pipeline

1. Browser creates a crypto session.
2. Browser generates a data key and wraps it for worker.
3. Input file is encrypted in browser (AES-256-GCM, chunked).
4. Worker unwraps key, decrypts temporary input, converts, validates output.
5. Worker re-encrypts output and returns metadata for client decrypt.
6. Temporary artifacts are deleted.

## Hardening Controls

- strict encryption metadata validation (algorithm, IV, chunk bounds)
- key-wrap validation for private mode jobs
- key material zeroization in worker after job completion
- format isolation and worker health checks

## Public Security Endpoint

- `GET /security/encryption-profile`
