export const conversations = [
  {
    id: "vision-labs",
    title: "Vision Labs",
    preview: "Carrier is green. Relay is blind. Launch ready.",
    kind: "group",
    unread: 4,
    active: true,
    members: 12
  },
  {
    id: "nina",
    title: "Nina Korolev",
    preview: "Sender keys rotate after deploy freeze.",
    kind: "private",
    unread: 0,
    active: false,
    members: 2
  },
  {
    id: "core-call",
    title: "Core Calls",
    preview: "ICE candidates stabilized on mobile fallback.",
    kind: "group",
    unread: 2,
    active: false,
    members: 8
  }
] as const;

export const messages = [
  {
    id: "m1",
    author: "Nina",
    role: "incoming",
    body: "Pre-key fanout is stable. We can switch the invite path to device bundles after lunch.",
    timestamp: "09:14",
    reactions: ["👍", "🔐"],
    status: "verified"
  },
  {
    id: "m2",
    author: "You",
    role: "outgoing",
    body: "Perfect. I also split uploads into 16 MB signed parts so the 10 GB resume path stays below the S3 multipart ceiling.",
    timestamp: "09:16",
    reactions: ["🚀"],
    status: "sealed",
    edited: true
  },
  {
    id: "m3",
    author: "Ari",
    role: "incoming",
    body: "Typing indicators are only metadata. Content stays opaque end-to-end and the server never sees plaintext.",
    timestamp: "09:18",
    reactions: [],
    status: "online"
  }
] as const;

export const activeCall = {
  title: "Design Review",
  latency: "42 ms",
  participants: ["You", "Nina", "Ari", "Mika"],
  status: "Screen share on"
} as const;

export const roadmapCards = [
  {
    title: "Signal Session Layer",
    description: "Swap the placeholder ratchet seam with audited X3DH and Double Ratchet integration."
  },
  {
    title: "Encrypted Media Vault",
    description: "Client-side envelope encryption before multipart upload to S3-compatible object storage."
  },
  {
    title: "Multi-Region Realtime",
    description: "Redis adapter, sticky sessions, TURN fleet, and regional failover for calls."
  }
] as const;
