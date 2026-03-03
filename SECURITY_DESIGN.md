# Zero-Knowledge Conversion Protocol v1

## Scope
- Client-side encryption and key wrapping
- Worker-only decryption with memory-only keys
- Encrypted storage (inputs + outputs)
- Deterministic conversion pipeline

## Threat Model
We protect against:
- Storage compromise
- API compromise (no plaintext)
- Admin access to storage
- Log leakage

We do not protect against:
- Compromised client device
- Browser malware

## Cryptography
- File encryption: AES-256-GCM (chunked)
- Key wrapping: X25519 + XSalsa20-Poly1305 (tweetnacl secretbox)
- Transport: TLS 1.3

## Protocol (Single File)
1. Client requests `/crypto/session`
2. API returns `{ sessionId, workerPublicKey, ttl }`
3. Client generates `aesKey` (32 bytes)
4. Client wraps `aesKey` with worker public key
5. Client encrypts file in chunks:
   - 12-byte IV per chunk
   - `ivBase` (8 bytes) + chunk index (4 bytes, BE)
6. Client uploads ciphertext to S3 via presigned PUT
7. Client calls `/jobs` with:
   - `inputKey`, `inputSize`, `encryptedSize`
   - `encryption: { enabled, keyWrap, sessionId, ivBase, chunkSize, totalChunks }`
8. Worker pulls job:
   - fetches session private key from Redis
   - unwraps `aesKey`
   - decrypts in RAM to temp path
   - validates magic bytes
   - converts file
   - encrypts output (same AES key)
   - uploads ciphertext output
9. API returns `outputMeta` for client-side decrypt
10. Client downloads ciphertext and decrypts locally

## Key Lifecycle
- AES key exists only in browser memory and worker RAM
- Session private key stored in Redis with TTL
- Session key deleted after use

## Storage
- Only encrypted blobs are stored
- TTL policy enforced in object storage

## Logging
Never log:
- File names
- Keys
- Paths
Only log:
- job_id, size, duration, status

## Known Gaps
- Ephemeral VMs are not enforced in code
- Kernel-level isolation is required for Telegram-grade security
