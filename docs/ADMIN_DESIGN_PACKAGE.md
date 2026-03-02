# Admin Design Package (Enterprise)

## Wireframe

Topbar + Sidebar + Main content layout:

- Topbar: search, quick actions, alerts, profile
- Sidebar modules:
  - Dashboard
  - Operations
  - Users
  - Jobs
  - Files
  - AI Control
  - Billing
  - API
  - Analytics
  - Content
  - Localization
  - Team
  - Security
  - System
  - Logs
  - Settings

## Component Inventory

- Core: layout container, sidebar, topbar, page header
- Data: table, metric card, chart, timeline, log viewer
- Interaction: modal, drawer, dropdown, tabs, tooltip, popover
- Forms: input, textarea, select, multiselect, toggle, radio, checkbox, uploader
- Feedback: toast, alert, skeleton, progress, status badge
- Navigation: breadcrumbs, pagination, stepper

## Admin SPA Architecture

```text
admin/
  core/
  layout/
  modules/
    dashboard/
    users/
    jobs/
    ai/
    billing/
    analytics/
    content/
    security/
    system/
  components/
  hooks/
  services/
  store/
```

Data flow:

`UI -> Store -> Services -> API -> Store -> UI`

## Roles and Permission Matrix

Roles:
- super_admin
- admin
- support
- analyst

Module-level access:

| Module       | super_admin | admin | support | analyst |
|--------------|-------------|-------|---------|---------|
| Dashboard    | ✅          | ✅    | ✅      | ✅      |
| Users        | ✅          | ✅    | 👁️      | 👁️      |
| Jobs         | ✅          | ✅    | 👁️      | 👁️      |
| Files        | ✅          | ✅    | 👁️      | ❌      |
| AI Control   | ✅          | ✅    | ❌      | 👁️      |
| Billing      | ✅          | 👁️    | ❌      | 👁️      |
| API          | ✅          | 👁️    | ❌      | ❌      |
| Content      | ✅          | ✅    | ❌      | ❌      |
| Localization | ✅          | 👁️    | ❌      | ❌      |
| Security     | ✅          | 👁️    | ❌      | ❌      |
| Logs         | ✅          | 👁️    | ❌      | 👁️      |
| Settings     | ✅          | ❌    | ❌      | ❌      |

