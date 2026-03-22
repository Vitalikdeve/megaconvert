# Mega Messenger

Messenger-first frontend wired to the existing VPS backend.

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

## Local Commands
From the repo root:

```powershell
npm install
```

```powershell
npm run dev
```

```powershell
npm run build
```

```powershell
npm run lint
```

## Notes
- The frontend sends `send_message` over Socket.io and updates the chat UI optimistically.
- The backend API server, backend routes, Docker setup, and database schemas were intentionally left unchanged.

