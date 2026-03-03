# Backend Architecture Skeleton

This folder mirrors a clean modular architecture target.

## Layout
- apps: runtime entrypoints (api, workers, telegram-bot)
- modules: domain modules (auth, accounts, billing, promo, analytics, posts, support, sessions, notifications)
- core: shared config/logger/errors
- infra: database/cache/queue/storage/integrations adapters

## Migration Rule
Move logic incrementally:
1. routes/controllers from current api into modules/*/*.routes/controller
2. business rules into modules/*/*.service
3. SQL/data access into modules/*/*.repository
4. keep apps/api thin (wire routes + middleware only)
