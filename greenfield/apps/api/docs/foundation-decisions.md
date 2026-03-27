# Foundation Decisions

## Why A Typed Runtime Context

The environment is parsed once at process startup and converted into a typed runtime context. This removes stringly-typed configuration reads from the rest of the codebase and keeps runtime decisions explicit.

## Why Fastify

Fastify gives lower overhead request handling, built-in request IDs, strong plugin support, and a clean path to production logging and rate limiting.

## Why Zod For Validation

The backend needs runtime validation and TypeScript inference from the same source. Zod keeps request schemas explicit and avoids maintaining parallel class-validator and interface definitions.

## Why Request Correlation IDs

Messaging and meetings will span HTTP, background workers, and realtime fanout. Correlation IDs are foundational for tracing mutations, failures, and distributed flows.

## Why Shell Modules

`auth-shell`, `realtime-shell`, and `audit-shell` create honest extension points now without faking business completeness. Product domains can plug into stable ports later without rewriting the bootstrap layer.

## Why PostgreSQL Plus Redis

PostgreSQL owns durable truth. Redis is reserved for ephemeral or acceleration concerns. This keeps consistency rules clear before realtime-heavy features arrive.

## Why Migrations And Seeds Live In The Database Package

Schema lifecycle is cross-cutting infrastructure, not app-local business logic. Keeping it in `packages/database` lets the API, worker, and future tooling share the same migration source of truth.

## Why Response Normalization Is Selective

Health endpoints stay raw because operational tooling expects simple responses. Product and system endpoints can opt into success envelopes where request metadata helps clients and operators.
