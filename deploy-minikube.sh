#!/bin/bash
set -e

# Option to start from scratch (delete PVC)
if [[ "$1" == "--reset" ]]; then
  echo "Shutting down Postgres deployment for PVC reset..."
  kubectl delete deployment postgres --ignore-not-found
  sleep 3
  echo "Deleting Postgres PVC for a fresh start..."
  kubectl delete pvc postgres-pvc --ignore-not-found
  sleep 2
fi

# Switch to Minikube's Docker daemon
if command -v minikube &> /dev/null; then
  echo "Switching shell to Minikube's Docker daemon..."
  eval $(minikube docker-env)
else
  echo "Minikube not found. Please install Minikube."
  exit 1
fi

# Build Docker image in Minikube's Docker
BACKEND_IMAGE=apphoster-backend:latest
FRONTEND_IMAGE=apphoster-frontend:latest
echo "Building backend Docker image in Minikube's Docker..."
docker build -t $BACKEND_IMAGE ./backend


echo "Building frontend Docker image in Minikube's Docker..."
docker build -t $FRONTEND_IMAGE ./frontend



# Deploy Postgres PVC, Secret, and Deployment
kubectl apply -f k8s/postgres-pvc.yaml
kubectl apply -f k8s/postgres-secrets.yaml
kubectl apply -f k8s/postgres-deployment.yaml
kubectl apply -f k8s/postgres-service.yaml

# Wait for Postgres pod to be ready
kubectl wait --for=condition=ready pod -l app=postgres --timeout=60s



# Only apply schema and add bootstrap key when --reset is passed
if [[ "$1" == "--reset" ]]; then
  POSTGRES_POD=$(kubectl get pods -l app=postgres -o jsonpath='{.items[0].metadata.name}')
  kubectl cp db/schema.sql "$POSTGRES_POD":/tmp/schema.sql
  kubectl exec "$POSTGRES_POD" -- bash -c "PGPASSWORD=postgres psql -U postgres -d apphoster -f /tmp/schema.sql"
  BOOTSTRAP_KEY="test-bootstrap-key"
  BOOTSTRAP_NAME="bootstrap"
  echo "Adding bootstrap API key to database..."
  ./add-bootstrap-key.sh "$BOOTSTRAP_KEY" "$BOOTSTRAP_NAME"
fi

# Delete existing deployment to force new image usage

# Delete existing backend and frontend deployments to force new image usage
kubectl delete deployment apphoster-backend --ignore-not-found
kubectl delete deployment apphoster-frontend --ignore-not-found


# Substitute version in deployment.yaml and apply manifests
for manifest in k8s/backend-secret.yaml k8s/backend-deployment.yaml k8s/backend-service.yaml k8s/frontend-deployment.yaml; do
  echo "Applying $manifest..."
  kubectl apply -f $manifest
  sleep 1
done

# Expose service and set up port-forwarding for API access

# API port-forward
SERVICE_NAME=apphoster-backend-service
PORT_FORWARD_LOCAL=8000
PORT_FORWARD_REMOTE=3000
if lsof -Pi :$PORT_FORWARD_LOCAL -sTCP:LISTEN -t >/dev/null; then
  echo "Killing process on port $PORT_FORWARD_LOCAL..."
  lsof -Pi :$PORT_FORWARD_LOCAL -sTCP:LISTEN -t | xargs -r kill
  sleep 1
fi
kubectl port-forward svc/$SERVICE_NAME $PORT_FORWARD_LOCAL:$PORT_FORWARD_REMOTE &
sleep 2
echo "API available at http://localhost:$PORT_FORWARD_LOCAL"

# Frontend port-forward
FRONTEND_SERVICE=apphoster-frontend-service
FRONTEND_PORT_LOCAL=8080
FRONTEND_PORT_REMOTE=80
if lsof -Pi :$FRONTEND_PORT_LOCAL -sTCP:LISTEN -t >/dev/null; then
  echo "Killing process on port $FRONTEND_PORT_LOCAL..."
  lsof -Pi :$FRONTEND_PORT_LOCAL -sTCP:LISTEN -t | xargs -r kill
  sleep 1
fi
kubectl port-forward svc/$FRONTEND_SERVICE $FRONTEND_PORT_LOCAL:$FRONTEND_PORT_REMOTE &
sleep 2
echo "Frontend available at http://localhost:$FRONTEND_PORT_LOCAL"

# Kill any process using port 5432 (for Postgres port-forward)
if lsof -Pi :5432 -sTCP:LISTEN -t >/dev/null; then
  echo "Killing process on port 5432..."
  lsof -Pi :5432 -sTCP:LISTEN -t | xargs -r kill
  sleep 1
fi
# Set up port-forwarding for Postgres
kubectl port-forward svc/postgres 5432:5432 &
sleep 2
echo "Postgres available at localhost:5432"