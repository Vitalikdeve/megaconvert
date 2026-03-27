# Web App

Next.js application shell for the premium messenger web client.

Implemented in this foundation:

- responsive workspace shell from mobile through desktop
- route structure for overview, inbox, chat, meetings, contacts, search, files, notifications, settings, and profile
- shared app runtime config layer
- runtime service-client boundary for web, API, and realtime health contracts
- validated persistent shell preferences plus isolated transient navigation UI state
- theme and motion providers
- React Query foundation with stable query keys and typed client adapters
- error and loading boundaries
- structured runtime error surfacing for timeout, network, malformed payload, and schema drift cases
- reusable shared feature-shell components
- health route for the web runtime

Deliberately not implemented yet:

- auth flows
- real messaging data
- meetings/media sessions
- contacts persistence
- notifications delivery
- search indexing and results
- account-backed settings persistence
