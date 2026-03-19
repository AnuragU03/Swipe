# CreativeSwipe

CreativeSwipe is a collaborative creative review platform for teams to share assets, collect reviewer feedback, and track project progress across clients.

## What this project includes

- Creator authentication and dashboard
- Session creation by client and project
- Multi-image upload with platform template context (LinkedIn, Instagram, YouTube)
- Shareable reviewer links with reviewer identity capture
- Reviewer swipe/tap review flow with comments
- Project-level done/pending reviewer status in dashboard
- Reviewer history (same email, same client/project)
- Export support for session results

## Tech stack

- Frontend: React + Vite
- Backend: Node.js + Express
- Data: Azure Cosmos DB (with local in-memory fallback)
- Media: Azure Blob Storage (with local in-memory fallback)
- Auth: JWT
- Deployment: Docker + Azure Container Apps

## Project structure

- `client/` – React app
- `api/` – Azure Functions workspace artifacts + shared backend service code
- `api/src/services/` – Data, storage, token, export services
- `server.js` – Main Express API and static app server
- `docs/` – Documentation and deployment templates

## Quick start

1. Install dependencies:
   - `npm run install:all`
2. Copy env file:
   - Create `.env` from `.env.example`
3. Run development:
   - `npm run dev`
4. Build frontend:
   - `npm run build`
5. Run production server locally:
   - `npm start`

Default local server: `http://localhost:8080`

## Environment variables

See `.env.example` for full list.

Required for cloud-backed mode:

- `COSMOS_ENDPOINT`
- `COSMOS_KEY`
- `COSMOS_DATABASE`
- `AZURE_STORAGE_CONNECTION_STRING`
- `AZURE_STORAGE_CONTAINER`
- `JWT_SECRET`

Optional:

- `JWT_CREATOR_EXPIRY`
- `JWT_REVIEWER_EXPIRY`
- `CLOUDFLARE_CDN_DOMAIN`
- `CLOUDFLARE_TOKEN_SECRET`
- `SENDGRID_API_KEY`
- `NOTIFICATION_FROM_EMAIL`

If Cosmos/Blob settings are not configured, local in-memory fallback is used.

## Documentation index

- `docs/LOCAL_DEVELOPMENT.md`
- `docs/API_REFERENCE.md`
- `docs/DEPLOYMENT.md`
- `docs/PRD_Azure_Deployment_Template.md`
- `docs/Azure_Deployment_Report_and_Connection_Template.md`

## Key API health check

- `GET /api/health`

## Notes

- Canonical redirect is enforced from `www.giggidy.work` to `giggidy.work`.
- API and frontend are served by the same Node process in production.
