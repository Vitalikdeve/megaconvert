import { randomUUID } from "node:crypto";

import type { MessageEnvelope, StoredMessage } from "@messenger/shared";

const encodeEnvelope = (
  plaintext: string,
  ratchetCounter: number
): MessageEnvelope => ({
  version: "legacy-base64",
  algorithm: "Base64-Demo",
  ciphertext: Buffer.from(plaintext, "utf8").toString("base64"),
  signature: "demo-signature",
  sessionId: "session-bootstrap",
  ratchetCounter,
  contentType: "text"
});

const buildSeedMessage = ({
  conversationId,
  senderUserId,
  senderDeviceId,
  plaintext,
  ratchetCounter,
  createdAt
}: {
  conversationId: string;
  senderUserId: string;
  senderDeviceId: string;
  plaintext: string;
  ratchetCounter: number;
  createdAt: string;
}): StoredMessage => ({
  id: randomUUID(),
  clientMessageId: randomUUID(),
  conversationId,
  senderUserId,
  senderDeviceId,
  envelope: encodeEnvelope(plaintext, ratchetCounter),
  createdAt,
  reactions: [],
  deliveryStatus: "delivered",
  deliveryStatusUpdatedAt: createdAt
});

export const seedMessages: StoredMessage[] = [
  buildSeedMessage({
    conversationId: "vision-labs",
    senderUserId: "nina",
    senderDeviceId: "nina-macbook",
    plaintext:
      "Pre-key fanout is stable. We can switch the invite path to device bundles after lunch.",
    ratchetCounter: 1,
    createdAt: "2026-03-22T09:14:00.000Z"
  }),
  {
    ...buildSeedMessage({
      conversationId: "vision-labs",
      senderUserId: "you",
      senderDeviceId: "web-1",
      plaintext:
        "Perfect. I also split uploads into 16 MB signed parts so the 10 GB resume path stays below the S3 multipart ceiling.",
      ratchetCounter: 2,
      createdAt: "2026-03-22T09:16:00.000Z"
    }),
    editedAt: "2026-03-22T09:17:00.000Z",
    reactions: [
      {
        userId: "ari",
        emoji: "🚀",
        createdAt: "2026-03-22T09:17:05.000Z"
      }
    ]
  },
  buildSeedMessage({
    conversationId: "vision-labs",
    senderUserId: "ari",
    senderDeviceId: "ari-macbook",
    plaintext:
      "Typing indicators are only metadata. Content stays opaque end-to-end and the server never sees plaintext.",
    ratchetCounter: 3,
    createdAt: "2026-03-22T09:18:00.000Z"
  })
];
