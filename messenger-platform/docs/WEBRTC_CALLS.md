# WebRTC Calls

This messenger uses Socket.io for signaling and WebRTC for peer-to-peer media.

## Architecture

Client A captures local media and creates an `RTCPeerConnection`.

Client A emits `call:offer` to the signaling server.

The signaling server forwards the offer to Client B using a dedicated user room:

`Client A -> Socket.io signaling server -> user:{targetUserId} -> Client B`

Client B answers with `call:answer`.

Both peers continue exchanging `call:ice-candidate` events until the direct media path is established.

## Event Names

- `conversation:join`
- `call:offer`
- `call:answer`
- `call:ice-candidate`
- `call:end`

## Payload Shapes

All call events share this envelope:

```ts
type CallSignalBase = {
  callId: string;
  conversationId: string;
  fromUserId: string;
  toUserId: string;
  media: "voice" | "video" | "screen";
};
```

Offer:

```ts
type CallOffer = CallSignalBase & {
  description: {
    type: "offer";
    sdp: string;
  };
};
```

Answer:

```ts
type CallAnswer = CallSignalBase & {
  description: {
    type: "answer";
    sdp: string;
  };
};
```

ICE candidate:

```ts
type CallIceCandidate = CallSignalBase & {
  candidate: {
    candidate: string;
    sdpMid?: string | null;
    sdpMLineIndex?: number | null;
    usernameFragment?: string | null;
  };
};
```

Call end:

```ts
type CallEnd = CallSignalBase & {
  reason: "hangup" | "declined" | "failed" | "busy" | "completed";
};
```

## Implementation Map

- Shared signaling schemas: `packages/shared/src/contracts/realtime.ts`
- Socket.io signaling gateway: `apps/server/src/modules/realtime/presentation/socket.gateway.ts`
- WebRTC client hook: `apps/web/src/features/calls/use-webrtc-call.ts`
- Call UI: `apps/web/src/features/calls/components/call-console.tsx`

## Supported Flows

- 1:1 voice call
- 1:1 video call
- Mid-call screen sharing renegotiation
- Incoming call answer and decline
- Busy handling
- Remote hangup propagation
