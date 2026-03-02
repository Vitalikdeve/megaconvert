# MegaConvert Platform Level-Up API

## Workspace

- `GET /account/workspaces`
- `POST /account/workspaces`
- `PATCH /account/workspaces/:id`
- `DELETE /account/workspaces/:id`
- `POST /account/workspaces/:id/members`
- `DELETE /account/workspaces/:id/members/:userId`
- `GET /account/workspaces/:id/items`
- `POST /account/workspaces/:id/items`
- `POST /account/workspaces/:id/projects`
- `POST /account/workspaces/:id/folders`

## Pipelines

- `GET /account/pipelines`
- `POST /account/pipelines`
- `PATCH /account/pipelines/:id`
- `DELETE /account/pipelines/:id`
- `POST /account/pipelines/:id/run`

## Automation

- `GET /account/automation-rules`
- `POST /account/automation-rules`
- `PATCH /account/automation-rules/:id`
- `DELETE /account/automation-rules/:id`

Automation rules are automatically applied in `POST /jobs` for authenticated users.

## File Intelligence

- `POST /account/file-intelligence/analyze`

Returns recommended target format and estimated output size.

## Collaboration

- `GET /account/collaboration/comments`
- `POST /account/collaboration/comments`

## Integrations

- `GET /account/integrations`
- `POST /account/integrations`
- `DELETE /account/integrations/:provider`

Providers: `google_drive`, `dropbox`, `notion`, `zapier`.

## User Insights

- `GET /account/insights/dashboard`

Returns conversion success rate, average time-to-result, and workspace counters.

## Positioning

- `GET /account/platform/capabilities`
