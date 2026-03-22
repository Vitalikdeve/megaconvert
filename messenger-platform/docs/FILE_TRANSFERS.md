# Large File Transfers

## Capabilities

- Encrypted client-side file uploads up to 10 GB
- Multipart chunk upload to S3-compatible object storage
- Parallel chunk uploads
- Pause and resume within the active browser session
- Signed download links for encrypted objects

## Backend

- `apps/server/src/modules/uploads/application/s3-multipart-upload.service.ts`
  creates multipart sessions, signs part URLs, inspects uploaded parts for resume, completes uploads, aborts uploads, and generates presigned download links
- `apps/server/src/modules/uploads/presentation/upload.routes.ts`
  exposes:
  - `POST /v1/uploads/initiate`
  - `GET /v1/uploads/:uploadId`
  - `POST /v1/uploads/:uploadId/parts/sign`
  - `POST /v1/uploads/:uploadId/complete`
  - `POST /v1/uploads/:uploadId/abort`
  - `GET /v1/uploads/download-link`

## Frontend

- `apps/web/src/features/uploads/use-encrypted-multipart-upload.ts`
  handles encrypted chunking, parallel PUT uploads, progress tracking, and pause/resume
- `apps/web/src/features/uploads/components/encrypted-upload-panel.tsx`
  renders the transfer manager UI

## Encryption Model

- Each file gets a client-side file key
- Each chunk is encrypted before upload
- S3 stores ciphertext only
- The backend stores opaque chunk manifests and cannot decrypt the file

## Operational Note

Browser multipart uploads need the S3 bucket CORS policy to allow `PUT` from the web origin and expose the `ETag` response header, otherwise the client cannot complete multipart uploads.

## Current Limitation

Pause and resume are fully implemented for the active browser session. Cross-refresh resume still needs a persisted file-handle flow or a File System Access integration so the browser can reconnect an existing upload session to the same local file.
