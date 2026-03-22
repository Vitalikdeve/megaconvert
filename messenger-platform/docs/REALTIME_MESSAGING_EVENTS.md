# Realtime Messaging Events

Architecture:

```text
Client UI
  -> Socket.io WebSocket
  -> Fastify realtime gateway
  -> messaging service / repository
  -> broadcast back to subscribed clients
```

## Client To Server

### `conversation:join`

```json
{
  "conversationId": "vision-labs",
  "userId": "you"
}
```

### `message:send`

```json
{
  "clientMessageId": "9f6c1d9a-c69f-4af0-901f-ae5d9fa09a01",
  "conversationId": "vision-labs",
  "senderUserId": "you",
  "senderDeviceId": "web-1",
  "envelope": {
    "ciphertext": "<base64 payload>",
    "signature": "client-demo-signature",
    "sessionId": "vision-labs-session",
    "ratchetCounter": 101
  }
}
```

### `message:edit`

```json
{
  "messageId": "3a4936f2-22c7-44f7-b69d-8446e5d9fcee",
  "editorUserId": "you",
  "envelope": {
    "ciphertext": "<base64 payload>",
    "signature": "client-demo-signature",
    "sessionId": "vision-labs-session",
    "ratchetCounter": 102
  }
}
```

### `message:reaction`

```json
{
  "conversationId": "vision-labs",
  "messageId": "3a4936f2-22c7-44f7-b69d-8446e5d9fcee",
  "userId": "you",
  "emoji": "👍"
}
```

### `typing:start` / `typing:stop`

```json
{
  "conversationId": "vision-labs",
  "userId": "you",
  "deviceId": "web-1",
  "startedAt": "2026-03-22T09:20:00.000Z"
}
```

## Server To Client

### `message:created`

```json
{
  "message": {
    "id": "c4424f10-488a-4a56-9dd8-69f55c803cb4",
    "clientMessageId": "9f6c1d9a-c69f-4af0-901f-ae5d9fa09a01",
    "conversationId": "vision-labs",
    "senderUserId": "you",
    "senderDeviceId": "web-1",
    "envelope": {
      "ciphertext": "<base64 payload>",
      "signature": "client-demo-signature",
      "sessionId": "vision-labs-session",
      "ratchetCounter": 101
    },
    "createdAt": "2026-03-22T09:20:00.000Z",
    "reactions": [],
    "deliveryStatus": "delivered",
    "deliveryStatusUpdatedAt": "2026-03-22T09:20:00.000Z"
  }
}
```

### `message:delivery-status`

```json
{
  "conversationId": "vision-labs",
  "clientMessageId": "9f6c1d9a-c69f-4af0-901f-ae5d9fa09a01",
  "messageId": "c4424f10-488a-4a56-9dd8-69f55c803cb4",
  "status": "delivered",
  "occurredAt": "2026-03-22T09:20:00.000Z"
}
```

### `message:edited`

```json
{
  "message": {
    "...": "same shape as message:created.message",
    "editedAt": "2026-03-22T09:21:00.000Z"
  }
}
```

### `message:reaction-updated`

```json
{
  "message": {
    "...": "same shape as message:created.message",
    "reactions": [
      {
        "userId": "you",
        "emoji": "👍",
        "createdAt": "2026-03-22T09:22:00.000Z"
      }
    ]
  }
}
```

### `typing:start` / `typing:stop`

Same payload shape as the client command.

## Source Of Truth

- Shared contracts: `packages/shared/src/contracts/chat.ts`
- Realtime event names: `packages/shared/src/contracts/realtime.ts`
- Server gateway: `apps/server/src/modules/realtime/presentation/socket.gateway.ts`
- React client hook: `apps/web/src/features/chats/use-realtime-messenger.ts`
