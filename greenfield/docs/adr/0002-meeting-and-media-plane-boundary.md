# ADR 0002: Split Meeting Control Plane from Media Plane

## Status

Accepted

## Context

Meetings require scalable media routing, participant permissions, lobby logic, scheduling, recording metadata, and integration with conversations. Treating all of this as a single subsystem hides important ownership boundaries.

## Decision

- Use LiveKit and Coturn as the media plane.
- Keep meeting lifecycle, authorization, scheduling, participant policy, recording metadata, and conversation linkage inside product-owned application code.
- Represent meeting artifacts as first-class product entities that can be referenced from conversations and search.

## Ownership Split

### Product-Owned Control Plane

- meeting creation and scheduling
- room access policy
- participant roles
- lobby and moderation policy
- artifact metadata
- audit and notification flows

### Vendor-Owned Media Plane

- SFU packet routing
- transport negotiation
- media relay behavior

## Consequences

- the media subsystem is real and production-capable without pretending we are building an SFU
- product rules remain under our control and integrate cleanly with messaging, notifications, and search

