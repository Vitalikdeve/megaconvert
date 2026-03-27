# Domain Boundaries

## Product Domains

### Identity and Access

- accounts
- credentials
- device sessions
- passwordless and MFA extensions
- authorization policies
- audit-worthy security actions

### User Graph

- profiles
- handles
- avatars
- contact edges
- block relations
- privacy defaults

### Conversations

- direct conversations
- groups
- spaces or large-room containers
- membership roles
- mute/archive/pin state
- invitation and access policy

### Messaging

- message lifecycle
- edits and deletes
- reactions
- replies and forwards
- read state
- typing signals
- draft synchronization
- message search documents

### Attachments and Media

- upload intent
- attachment ownership
- file metadata
- previews and thumbnails
- malware scanning state
- retention rules

### Meetings

- instant meetings
- scheduled meetings
- host policy
- participant state
- recording metadata
- transcript metadata
- linkage to conversation history

### Notifications

- in-app inbox items
- push delivery intents
- email security and invite fallbacks
- per-channel user preferences

### Search

- search query parsing
- ranking inputs
- searchable document projections
- adapter boundary for index storage

### Settings

- appearance
- notification preferences
- privacy controls
- meeting defaults
- device and session management

## Cross-Domain Integration Rules

- `conversations` owns membership and access boundaries.
- `messages` cannot create delivery targets without consulting conversation membership.
- `meetings` may link to a conversation, but the conversation remains the owner of membership and notification reach.
- `attachments` own binary lifecycle; `messages` and `meetings` only reference attachment identifiers.
- `notifications` consume outbox events and user preferences; they do not reimplement domain policy.
- `search` indexes committed projections only; it never indexes speculative client state.

## Search Boundary

Search is split into two interfaces:

- `SearchProjectionWriter`: receives committed domain projections from worker jobs.
- `SearchQueryReader`: executes product search queries and returns ranked result contracts.

This prevents the initial PostgreSQL adapter from leaking storage assumptions into product code.

## Meeting and Messaging Boundary

Meetings and messaging remain separate bounded contexts with explicit links:

- meeting chat can live inside a meeting-linked conversation
- call history belongs to meetings
- message history belongs to conversations
- recordings belong to meetings and are referenced into conversations through events and attachments

This keeps the product connected without collapsing domains into a single giant module.

