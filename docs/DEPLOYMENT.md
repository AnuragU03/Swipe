# Deployment Guide

## Container image workflow

### Build and push image

1. Login to ACR:
   - `az acr login -n <acr-name>`
2. Build image:
   - `docker build -t <acr-login-server>/<image-name>:<tag> .`
3. Push image:
   - `docker push <acr-login-server>/<image-name>:<tag>`

## Azure Container Apps rollout

Update running app image:

- `az containerapp update -n <app-name> -g <resource-group> --image <acr-login-server>/<image-name>:<tag>`

Check revision and state:

- `az containerapp show -n <app-name> -g <resource-group> --query "{latestRevision:properties.latestRevisionName,readyRevision:properties.latestReadyRevisionName,state:properties.runningStatus}" -o json`

## Post-deploy validation

- Health endpoint:
  - `curl -I https://<domain>/api/health`
- Canonical redirect check (`www` -> apex):
  - `curl -I https://www.<domain>/api/health`

Expected:

- Apex health returns `200`
- `www` returns `301` to apex

## Runtime requirements

Set environment variables in Container App for:

- Cosmos DB connection settings
- Blob Storage connection settings
- JWT secret and expiries

## Static asset serving

Frontend is built into `client/dist` and served by `server.js` in production.

## Domain behavior

Server middleware enforces canonical redirect from `www.giggidy.work` to `giggidy.work`.

## Rollback strategy

If a revision fails validation:

- Deploy previous known-good image tag back to app.
- Confirm `latestReadyRevisionName` and health endpoint.
