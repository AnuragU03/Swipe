# API Reference

Base path: `/api`

## Health

- `GET /api/health`

## Creator auth

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`

## Reviewer account auth

- `POST /api/reviewer/register`
- `POST /api/reviewer/login`
- `GET /api/reviewer/me`
- `POST /api/reviewer/sessions/:id/claim`
- `GET /api/reviewer/sessions`

## Sessions (creator)

- `POST /api/sessions`
- `GET /api/sessions`
- `GET /api/sessions/:id`
- `PATCH /api/sessions/:id`
- `DELETE /api/sessions/:id`
- `DELETE /api/sessions?scope=all|client|project&clientId=...&projectId=...`

## Reviewer access

- `POST /api/sessions/:id/join`
- `POST /api/sessions/:id/submit`
- `GET /api/sessions/:id/reviewer-history`

## Public session preview

- `GET /api/public/sessions/:id/preview`

## Images

- `POST /api/sessions/:id/images`
- `GET /api/sessions/:id/images`
- `DELETE /api/sessions/:id/images/:imageId`

## Submissions and exports

- `GET /api/sessions/:id/submissions`
- `GET /api/sessions/:id/export?format=xlsx|csv`

## Authentication model

### Creator token

Used for creator dashboard/session management routes.

### Reviewer session token

Issued by join endpoint and scoped to one session for review submission.

### Reviewer account token

Used for reviewer account routes and session claims.

## Core request/response notes

### Create session (`POST /api/sessions`)

Important fields:

- `title`
- `clientName`
- `projectName`
- `clientId` (optional)
- `projectId` (optional)
- `expectedReviewers` (array of name/email)
- `deadline` (optional)
- `password` or `reviewerPassword` (optional)

### Upload images (`POST /api/sessions/:id/images`)

Each image item supports:

- `fileName`
- `data` (base64)
- `contentType`
- `templateChannel` (`LinkedIn`, `Instagram`, `YouTube`)
- `templateText`
- `rowId`
- `rowOrder`

### Submit review (`POST /api/sessions/:id/submit`)

- `decisions`: array of `{ imageId, liked }`
- `annotations`: array of pins/comments

Reviewer identity matching prioritizes reviewer email for history and status continuity.
