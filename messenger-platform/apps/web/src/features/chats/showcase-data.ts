export type WorkspaceDestinationId =
  | "messages"
  | "calls"
  | "vault"
  | "people"
  | "settings";

export interface ChatFolder {
  id: string;
  label: string;
  count: number;
}

export interface WorkspaceDestination {
  id: WorkspaceDestinationId;
  label: string;
  badge?: string;
  active?: boolean;
}

export interface ChatListItem {
  id: string;
  title: string;
  preview: string;
  timestamp: string;
  unread: number;
  active?: boolean;
  muted?: boolean;
  pinned?: boolean;
  kind: "private" | "group" | "channel";
  status: string;
  accent: "cyan" | "violet" | "emerald" | "slate";
  initials: string;
}

export interface SharedPreviewItem {
  id: string;
  label: string;
  value: string;
}

export interface DraftAttachment {
  id: string;
  label: string;
  size: string;
  tint: "cyan" | "violet" | "emerald";
}

interface BaseTimelineItem {
  id: string;
  author: string;
  role: "incoming" | "outgoing";
  timestamp: string;
  reactions: string[];
  edited?: boolean;
  status?: string;
}

export interface TimelineDayDivider {
  id: string;
  kind: "day";
  label: string;
}

export interface TimelineTextMessage extends BaseTimelineItem {
  kind: "text";
  body: string;
}

export interface TimelineFileMessage extends BaseTimelineItem {
  kind: "file";
  body: string;
  file: {
    name: string;
    size: string;
    kindLabel: string;
    extension: string;
    previewLabel: string;
  };
}

export interface TimelineVoiceMessage extends BaseTimelineItem {
  kind: "voice";
  body: string;
  voice: {
    duration: string;
    progress: number;
    waveform: number[];
    listened: boolean;
  };
}

export type TimelineItem =
  | TimelineDayDivider
  | TimelineTextMessage
  | TimelineFileMessage
  | TimelineVoiceMessage;

export const workspaceDestinations: WorkspaceDestination[] = [
  { id: "messages", label: "Chats", badge: "24", active: true },
  { id: "calls", label: "Calls" },
  { id: "vault", label: "Vault" },
  { id: "people", label: "People" },
  { id: "settings", label: "Prefs" }
];

export const chatFolders: ChatFolder[] = [
  { id: "all", label: "All", count: 18 },
  { id: "teams", label: "Teams", count: 6 },
  { id: "private", label: "Private", count: 9 },
  { id: "media", label: "Media", count: 3 }
];

export const chatListItems: ChatListItem[] = [
  {
    id: "vision-labs",
    title: "Vision Labs",
    preview: "File vault is live. Resume path looks clean on the last dry run.",
    timestamp: "09:24",
    unread: 4,
    active: true,
    pinned: true,
    kind: "group",
    status: "12 online",
    accent: "cyan",
    initials: "VL"
  },
  {
    id: "nina",
    title: "Nina Korolev",
    preview: "We can ship the conversation composer after the motion pass lands.",
    timestamp: "09:18",
    unread: 0,
    kind: "private",
    status: "last seen just now",
    accent: "emerald",
    initials: "NK"
  },
  {
    id: "core-calls",
    title: "Core Calls",
    preview: "TURN failover chart is attached. ICE recovery dropped below 120 ms.",
    timestamp: "08:57",
    unread: 2,
    muted: true,
    kind: "group",
    status: "screen share active",
    accent: "violet",
    initials: "CC"
  },
  {
    id: "broadcast",
    title: "Launch Broadcast",
    preview: "Tonight's checklist is locked. Drop final screenshots into the vault.",
    timestamp: "Yesterday",
    unread: 0,
    kind: "channel",
    status: "announcement only",
    accent: "slate",
    initials: "LB"
  }
];

export const sharedPreviewItems: SharedPreviewItem[] = [
  { id: "people", label: "Members", value: "12 online" },
  { id: "media", label: "Shared", value: "184 files" },
  { id: "retention", label: "Retention", value: "Forever" }
];

export const draftAttachments: DraftAttachment[] = [
  { id: "topology", label: "relay-topology.fig", size: "84 MB", tint: "cyan" },
  { id: "turn-fleet", label: "turn-fleet.mov", size: "412 MB", tint: "violet" }
];

export const timelineHistory: TimelineItem[] = [
  { id: "day-today", kind: "day", label: "Today" },
  {
    id: "history-1",
    kind: "text",
    author: "Nina",
    role: "incoming",
    timestamp: "08:02",
    body: "Morning pass is clean. The desktop shell feels much closer to Telegram now, just with far more depth.",
    reactions: ["✨", "👍"],
    status: "verified"
  },
  {
    id: "history-2",
    kind: "file",
    author: "Ari",
    role: "incoming",
    timestamp: "08:08",
    body: "Uploading the topology pack so design and infra can work from the same source.",
    reactions: ["👀"],
    status: "sealed",
    file: {
      name: "relay-topology.fig",
      size: "84 MB",
      kindLabel: "Design Source",
      extension: "FIG",
      previewLabel: "Realtime fabric"
    }
  },
  {
    id: "history-3",
    kind: "voice",
    author: "You",
    role: "outgoing",
    timestamp: "08:14",
    body: "Voice note",
    reactions: ["🎧"],
    edited: true,
    status: "delivered",
    voice: {
      duration: "0:37",
      progress: 0.56,
      waveform: [18, 36, 22, 48, 44, 30, 54, 32, 20, 40, 56, 28, 22, 34, 18, 42],
      listened: true
    }
  },
  {
    id: "history-4",
    kind: "text",
    author: "Mika",
    role: "incoming",
    timestamp: "08:21",
    body: "If we keep the header calm and the timeline dense, the interface feels premium instead of noisy.",
    reactions: ["💯"],
    status: "online"
  },
  {
    id: "history-5",
    kind: "text",
    author: "You",
    role: "outgoing",
    timestamp: "08:31",
    body: "Agreed. I want the scroll behavior to feel anchored, especially when older history pages in at the top.",
    reactions: ["🚀"],
    status: "read"
  },
  {
    id: "history-6",
    kind: "file",
    author: "Nina",
    role: "incoming",
    timestamp: "08:42",
    body: "Dropping the latest motion reference too. The hover timing here is what I want us to match.",
    reactions: ["🔥", "📎"],
    status: "verified",
    file: {
      name: "liquid-hover-reference.mp4",
      size: "264 MB",
      kindLabel: "Motion Clip",
      extension: "MP4",
      previewLabel: "Vision pass"
    }
  }
];
