# Product Requirements Document (PRD) Template
## Product: CreativeSwipe
## Release: [vX.Y.Z]
## Date: [YYYY-MM-DD]
## Owner: [Name]
## Status: Draft / In Review / Approved

---

## 1) Executive Summary
CreativeSwipe is a collaborative creative review platform where creators upload image sets, invite reviewers through a short link, collect like/dislike decisions plus annotations, and export consolidated results.

This PRD defines product requirements, technical scope, and Azure deployment readiness for the next release.

---

## 2) Problem Statement
Creative teams need fast, structured feedback on visual assets without long meetings or scattered comments. Existing workflows are slow, fragmented, and hard to analyze.

### Current pain points
- Review feedback is distributed across channels and difficult to aggregate.
- Decision rationale (annotations) is not tied consistently to specific images.
- Exportable reporting for stakeholders is manual and error-prone.

---

## 3) Goals and Non-Goals
### Goals
- Enable secure creator login and session management.
- Enable reviewer participation via short links and optional session password.
- Capture image-level decisions and annotations.
- Provide creator dashboards and exportable session results.
- Deploy reliably on Azure with repeatable environment setup.

### Non-Goals
- Real-time collaborative editing.
- Fine-grained RBAC beyond creator/reviewer roles.
- Complex workflow orchestration or AI-assisted scoring in this release.

---

## 4) Personas
### Creator
- Registers/logs in, creates sessions, uploads images, monitors submissions, exports results.

### Reviewer
- Joins session via short URL, reviews images, adds annotations, submits one response per session.

### Admin/Operator
- Manages Azure resources, app settings, deployment pipeline, monitoring, and incident response.

---

## 5) Success Metrics (KPIs)
- Session creation success rate: >= 99%.
- Image upload success rate: >= 98% for files <= 25 MB.
- Review submission completion rate: >= 85% once reviewer joins.
- API p95 latency:
  - Auth/session endpoints: <= 500 ms
  - Image listing endpoints: <= 1000 ms
- Deployment lead time: <= 30 minutes from tagged commit to production.

---

## 6) Scope
### In Scope
- Creator auth and profile retrieval.
- Session CRUD and reviewer join flow.
- Image upload/list/delete for session assets.
- Reviewer submit flow and creator-side submission visibility.
- Session export in XLSX/CSV format.
- Azure Static Web Apps deployment with integrated Azure Functions API.
- Cosmos DB + Blob Storage connectivity.

### Out of Scope
- Multi-tenant organizations and billing.
- Native mobile apps.
- Offline-first support.

---

## 7) Functional Requirements

### FR-1 Authentication
- Creator can register and log in with email/password.
- JWT-based access for creator operations.
- Reviewer JWT scoped to a single session.

**Acceptance Criteria**
- Invalid credentials return 401.
- Expired/invalid token returns 401.
- Unauthorized role access returns 403.

### FR-2 Session Management
- Creator can create, list, get, update, and delete sessions.
- Session includes title, status, optional deadline, max reviewers, optional reviewer password.

**Acceptance Criteria**
- Session creation requires title.
- Closed/expired sessions reject new reviewers.
- Creator can only access own sessions.

### FR-3 Reviewer Join and Review
- Reviewer joins via `/r/{sessionId}` and optional password.
- Reviewer submits exactly one review per session.
- Submission includes decisions and optional annotations.

**Acceptance Criteria**
- Duplicate submission by same reviewer returns 409.
- Missing reviewer name returns 400.

### FR-4 Image Handling
- Creator uploads up to 100 images per session.
- Max image size per file: 25 MB.
- Signed URLs used for image access.

**Acceptance Criteria**
- Oversized files are rejected or skipped per API behavior.
- Image list returns ordered data.

### FR-5 Results and Export
- Creator sees session summary and submissions.
- Export endpoint supports XLSX/CSV download.

**Acceptance Criteria**
- Export returns valid file and proper content type.
- Unauthorized export request is blocked.

---

## 8) API Surface (Current Baseline)

### Auth
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`

### Sessions
- `POST /api/sessions`
- `GET /api/sessions`
- `GET /api/sessions/{id}`
- `PATCH /api/sessions/{id}`
- `DELETE /api/sessions/{id}`
- `POST /api/sessions/{id}/join`
- `GET /api/sessions/{id}/export?format=xlsx|csv`

### Images
- `POST /api/sessions/{id}/images`
- `GET /api/sessions/{id}/images`
- `DELETE /api/sessions/{id}/images/{imageId}`

### Reviews
- `POST /api/sessions/{id}/submit`
- `GET /api/sessions/{id}/submissions`

---

## 9) Non-Functional Requirements
- Security headers enforced through `staticwebapp.config.json`.
- HTTPS-only production access.
- Secrets must not be committed to source control.
- Monitoring enabled (Application Insights / logs).
- Data backup/retention policy documented for Cosmos DB and Blob Storage.

---

## 10) Data and Storage Requirements
### Cosmos DB
- Database: `creativeswipe` (default)
- Containers:
  - `creators` (partition key `/id`)
  - `sessions` (partition key `/creatorId`)
  - `images` (partition key `/sessionId`)
  - `submissions` (partition key `/sessionId`)

### Blob Storage
- Container: `creatives` (default)
- Blob naming: `{sessionId}/{uuid}.{ext}`
- Access: private blobs + generated read SAS URL

---

## 11) Azure Architecture (Target)
- Frontend: Azure Static Web Apps (React/Vite output)
- API: Azure Functions (Node.js, integrated with SWA)
- Database: Azure Cosmos DB (NoSQL)
- Object Storage: Azure Storage Account (Blob)
- Observability: Application Insights + Azure Monitor
- Secrets/Config: Static Web App Application Settings (or Key Vault-backed process)

---

## 12) Security and Compliance Requirements
- JWT secret must be production-grade random string (>= 32 chars).
- Restrict CORS to required origins in production.
- Rotate secrets on incident or periodic schedule.
- Log authentication failures and suspicious traffic patterns.
- Define PII handling for reviewer names and creator emails.

---

## 13) Delivery Plan
### Milestone 1: Readiness
- Finalize app settings and resources.
- Validate staging deployment.

### Milestone 2: Production Deployment
- Deploy frontend + functions.
- Run smoke tests and rollback checks.

### Milestone 3: Stabilization
- Monitor error budgets and latency for 72 hours.
- Patch critical issues.

---

## 14) Test Plan
### Functional
- Auth, session lifecycle, upload, submit, export.

### Integration
- Cosmos + Blob connectivity.
- Reviewer/creator auth boundary checks.

### Regression
- Existing session data retrieval and dashboard rendering.

### Deployment Validation
- App settings resolved correctly in production.
- API responds under production URL.

---

## 15) Risks and Mitigations
- **Risk:** Misconfigured secrets in production.
  - **Mitigation:** Pre-flight app settings checklist and startup validation.
- **Risk:** Blob SAS failures due to key parsing.
  - **Mitigation:** Automated smoke test for image retrieval.
- **Risk:** RU throttling in Cosmos under load.
  - **Mitigation:** Monitor RU metrics and scale throughput.

---

## 16) Open Questions
- Do we enforce stronger creator password policy this release?
- Do we move storage access to managed identity in next iteration?
- What retention period is required for annotations and exports?

---

## 17) Approval
- Product Owner: [Name / Date]
- Engineering Lead: [Name / Date]
- Operations Lead: [Name / Date]
