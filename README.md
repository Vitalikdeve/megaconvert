# Mega Messenger

Messenger-first frontend with a local-first development stack and remote-compatible rewrites.

## Target Structure
```text
messenger-platform/
├── backend/
│   ├── api/
│   └── realtime/
├── frontend/
│   ├── login/
│   ├── register/
│   └── chat/
├── docker/
└── database/
```

## Current Mapping
- `backend/api`: documented in [backend/api/README.md](C:/Users/user/superconvert/megaconvert/client/backend/api/README.md)
- `backend/realtime`: documented in [backend/realtime/README.md](C:/Users/user/superconvert/megaconvert/client/backend/realtime/README.md)
- `frontend/login`: documented in [frontend/login/README.md](C:/Users/user/superconvert/megaconvert/client/frontend/login/README.md)
- `frontend/register`: documented in [frontend/register/README.md](C:/Users/user/superconvert/megaconvert/client/frontend/register/README.md)
- `frontend/chat`: documented in [frontend/chat/README.md](C:/Users/user/superconvert/megaconvert/client/frontend/chat/README.md)
- `docker`: documented in [docker/README.md](C:/Users/user/superconvert/megaconvert/client/docker/README.md)
- `database`: documented in [database/README.md](C:/Users/user/superconvert/megaconvert/client/database/README.md)

## What This Repo Ships
- `frontend/`: the active messenger web client
- `api/`, `backend/`, `server/`, `worker/`: existing backend services left intact per compatibility requirements
- `infra/`: existing infrastructure and deployment assets left intact

## Frontend Structure
- `frontend/src/app/login`: login screen
- `frontend/src/app/register`: registration screen
- `frontend/src/app/chat`: main chat layout
- `frontend/src/components`: sidebar, chat window, message input, and message bubble UI
- `frontend/src/services/api.js`: REST client for `/register`, `/login`, and `/users`
- `frontend/src/services/socket.js`: Socket.io realtime client
- `frontend/src/config/api.js`: backend base URLs

## Backend Targets
- API: `http://35.202.253.153:4000`
- Socket.io: `http://35.202.253.153:4001`

## Local Development
From the repo root:

```powershell
npm install
```

```powershell
npm run dev:local
```

This starts:
- Docker infra for Postgres, Redis, MinIO, and LiveKit
- local REST API on `http://127.0.0.1:3000`
- local Socket.io realtime server on `http://127.0.0.1:4000`
- Vite frontend on `http://localhost:5173`

If Docker Desktop networking gives you trouble with LiveKit media on Windows, stop the `livekit` container and run `livekit-server --dev --bind 0.0.0.0` natively instead.

Useful commands:

```powershell
npm run dev
```

```powershell
npm run dev:infra
```

```powershell
npm run dev:infra:stop
```

```powershell
npm run build
```

```powershell
npm run lint
```

## Notes
- The frontend sends `send_message` over Socket.io and updates the chat UI optimistically.
- Local messenger auth stores users in the running API process, so create at least two accounts in two browser sessions if you want to test direct chats end-to-end.
- Meeting rooms now request a scoped LiveKit token from the local API instead of trying to reuse the auth session token.

