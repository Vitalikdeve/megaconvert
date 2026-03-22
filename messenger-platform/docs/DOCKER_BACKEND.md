# Docker Backend Stack

This repository now ships a backend-focused Docker stack with separate `api` and `realtime` services backed by PostgreSQL, Redis, and S3-compatible object storage.

## Services

- `api`
  - Fastify HTTP service for health, message history, and multipart upload endpoints.
- `realtime`
  - Fastify + Socket.io service for typing, message fan-out, reactions, edits, and call signaling.
- `postgres`
  - Durable relational store prepared for the clean-architecture persistence layer.
- `redis`
  - Shared cache and Socket.io adapter backbone. It now also backs the temporary shared message store so `api` and `realtime` stay consistent across containers.
- `object-storage`
  - MinIO running in S3-compatible mode.
- `object-storage-init`
  - One-shot bootstrap container that creates the media bucket and applies CORS needed for multipart upload.

## Environment Files

- Copy [.env.example](../.env.example) to `.env` for local Docker usage.
- Copy [.env.production.example](../.env.production.example) to `.env.production` for production-style compose runs.

Important variables:

- `API_PORT`
- `REALTIME_PORT`
- `POSTGRES_DB`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `REDIS_URL`
- `S3_ACCESS_KEY`
- `S3_SECRET_KEY`
- `S3_BUCKET`
- `CORS_ORIGIN`
- `TRUST_PROXY`
- `LOG_LEVEL`

## Local Run

```bash
cp .env.example .env
docker compose up -d --build
```

Default endpoints:

- API health: `http://localhost:8080/health`
- Realtime health: `http://localhost:8090/health`
- MinIO API: `http://localhost:9000`
- MinIO console: `http://localhost:9001`

## Production Compose

```bash
cp .env.production.example .env.production
docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.production.yml up -d --build
```

The production override adds:

- restart policies
- read-only filesystem for stateless app containers
- `tmpfs` scratch space
- `no-new-privileges`
- reduced Linux capabilities
- bounded JSON log rotation

## Scaling Notes

- `realtime` is ready for horizontal fan-out through the Redis Socket.io adapter.
- `api` and `realtime` share message state through Redis today so split-role containers stay consistent.
- PostgreSQL is provisioned for the next persistence layer; the current messenger module has not been migrated from the shared Redis message store yet.
- Multipart uploads require the bucket CORS policy from [cors.json](../infra/docker/minio/cors.json) so the browser can read `ETag` during part completion.
