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
   - This wipes the database, applies the schema, and inserts a bootstrap API key
3. Port-forward API: `kubectl port-forward svc/apphoster-service 8000:3000`
4. Test endpoints using the bootstrap API key (see below)

## API Key Authentication
- All /api endpoints require an API key in the `x-api-key` header
- The bootstrap key is set during deployment (see deploy-minikube.sh)

## Endpoints
- `POST /api/apps/upload` (multipart/form-data, file upload)
- `GET /api/apps` (list apps)
- `GET /api/apps/:id/download` (download app file)
- `DELETE /api/apps/:id` (delete app)

## Example Usage
```bash
# List apps
curl -H "x-api-key: <bootstrap-key>" http://localhost:8000/api/apps

# Upload a file
curl -X POST -H "x-api-key: <bootstrap-key>" -F "file=@yourfile.txt" http://localhost:8000/api/apps/upload

# Download a file
curl -H "x-api-key: <bootstrap-key>" http://localhost:8000/api/apps/1/download -o ~/Downloads/yourfile.txt

# Delete a file
curl -X DELETE -H "x-api-key: <bootstrap-key>" http://localhost:8000/api/apps/1
```

## Notes
- `.env` and sensitive files are excluded via `.gitignore`
- Database is reset on each deployment for rapid schema iteration
- S3 integration is planned for production

---
For questions or contributions, contact the maintainer.