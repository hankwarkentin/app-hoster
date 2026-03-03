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
# Insert superadmin customer and API key
SQL="DO \$\$ 
DECLARE
  cid INTEGER;
BEGIN
  INSERT INTO customers (name, email, role) VALUES ('$NAME', '$NAME@example.com', 'superadmin');
  SELECT id INTO cid FROM customers WHERE name = '$NAME';
  INSERT INTO api_keys (customer_id, key_hash, revoked) VALUES (cid, '$KEY', FALSE);
END\$\$ LANGUAGE plpgsql;"
echo "$SQL" | kubectl exec -i "$POD" -- bash -c "PGPASSWORD=password psql -U postgres -d apphoster"
echo "Superadmin user '$NAME' and API key '$KEY' added for testing."