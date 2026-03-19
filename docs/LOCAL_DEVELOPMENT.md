# Local Development Guide

## Prerequisites

- Node.js 18+
- npm
- Optional: Docker

## Setup

1. Install all dependencies:
   - `npm run install:all`
2. Create `.env` in repo root using `.env.example`.

## Run modes

### Full local development

- Command: `npm run dev`
- Starts:
  - API workspace (`api`, via `func start` script)
  - Frontend Vite app (`client`)

### Production-like local run

1. Build frontend:
   - `npm run build`
2. Start Node server:
   - `npm start`

Server runs on `PORT` env var or `8080`.

## Data behavior

- If Cosmos DB and Blob Storage env vars are missing, app uses in-memory storage.
- In-memory mode is useful for UI/dev testing but data is not persistent.

## Common tasks

- Build frontend: `npm run build`
- Start backend/server: `npm start`
- Docker build: `npm run docker:build`
- Docker run: `npm run docker:run`

## Troubleshooting

### App boots but no saved data persists

Likely running in in-memory mode. Configure Azure env vars in `.env`.

### Reviewer or creator auth failing unexpectedly

Check `JWT_SECRET` and token expiries in env.

### Upload issues

Verify Blob Storage connection string and container name.

### CORS or route mismatch

Ensure requests target `/api/*` routes and app/server are running from same base origin in production mode.
