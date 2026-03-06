# AppHoster Backend

A Node.js + TypeScript API for hosting and distributing IPA, AAB, and APK files for mobile app testing.

## Tech Stack
- Node.js (Express)
- TypeScript
- PostgreSQL (Minikube/Kubernetes, PVC)
- Amazon S3 (future integration)
- API Key Authentication
- Docker, Minikube, Kubernetes

## Deployment & Development

### Local Development
1. Install dependencies: `npm install`
2. Configure environment variables in `.env`
3. Start development server: `npx ts-node src/index.ts`

### Kubernetes/Minikube Deployment
1. Start Minikube: `minikube start`
2. Deploy with DB reset: `bash deploy-minikube.sh --reset`
  - This wipes the database, applies the schema, and inserts an initial API key
3. Port-forward API: `kubectl port-forward svc/apphoster-service 8000:3000`
4. Test endpoints using the initial API key (see below)

## API Key Authentication
- All /api endpoints require an API key in the `x-api-key` header
-- The initial API key is set during deployment (see deploy-minikube.sh)

## API Key Management Endpoints

All API key management endpoints require an admin API key in the `x-api-key` header.

- `GET /api/keys` — List all API keys
- `POST /api/keys` — Create a new API key (body: `{ name, email, role }`)
- `GET /api/keys/:id` — Get metadata for a specific key
- `POST /api/keys/:id/revoke` — Revoke an API key

### Example Usage
```bash
# List API keys
curl -H "x-api-key: <admin-key>" http://localhost:8000/api/keys

# Create a new API key
curl -X POST -H "x-api-key: <admin-key>" -H "Content-Type: application/json" \
  -d '{"name":"user","email":"user@example.com","role":"user"}' \
  http://localhost:8000/api/keys

# Get metadata for a key
curl -H "x-api-key: <admin-key>" http://localhost:8000/api/keys/2

# Revoke a key
curl -X POST -H "x-api-key: <admin-key>" http://localhost:8000/api/keys/2/revoke
```

### Error Handling
- 401: Missing API key
- 403: Invalid or revoked API key
- 404: Key or app not found
- 400: Invalid request format

## Endpoints
- `POST /api/apps/upload` (multipart/form-data, file upload)
- `GET /api/apps` (list apps)
- `GET /api/apps/:id/download` (download app file)
- `DELETE /api/apps/:id` (delete app)

## Example Usage
```bash
# List apps
curl -H "x-api-key: <API_KEY>" http://localhost:8000/api/apps

# Upload a file
curl -X POST -H "x-api-key: <API_KEY>" -F "file=@yourfile.txt" http://localhost:8000/api/apps/upload

# Download a file
curl -H "x-api-key: <API_KEY>" http://localhost:8000/api/apps/1/download -o ~/Downloads/yourfile.txt

# Delete a file
curl -X DELETE -H "x-api-key: <API_KEY>" http://localhost:8000/api/apps/1
```

## Notes
- `.env` and sensitive files are excluded via `.gitignore`
- Database is reset on each deployment for rapid schema iteration
- S3 integration is planned for production

---
For questions or contributions, contact the maintainer.