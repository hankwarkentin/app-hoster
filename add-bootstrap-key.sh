#!/bin/bash
# Add a bootstrap API key to the database after migration
# Usage: ./add-bootstrap-key.sh <key> <customer_name>
set -e
KEY="$1"
NAME="$2"
if [ -z "$KEY" ] || [ -z "$NAME" ]; then
  echo "Usage: $0 <key> <customer_name>"
  exit 1
fi
POD=$(kubectl get pods -l app=postgres -o jsonpath='{.items[0].metadata.name}')
# Compute SHA-256 hash of the key
HASH=$(echo -n "$KEY" | shasum -a 256 | awk '{print $1}')
kubectl exec "$POD" -- bash -c "PGPASSWORD=password psql -U postgres -d apphoster -c \"INSERT INTO customers (name, email, api_key_hash, role) VALUES ('$NAME', '$NAME@example.com', '$HASH', 'admin');\""
echo "Bootstrap API key '$KEY' for customer '$NAME' added."
