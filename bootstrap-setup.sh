#!/bin/bash
# Add a bootstrap API key and test user to the database after migration
# Usage: ./bootstrap-setup.sh <key> <customer_name>
set -e
KEY="$1"
NAME="$2"
if [ -z "$KEY" ] || [ -z "$NAME" ]; then
  echo "Usage: $0 <key> <customer_name>"
  exit 1
fi
POD=$(kubectl get pods -l app=postgres -o jsonpath='{.items[0].metadata.name}')
HASH=$(node ./scripts/create-bcrypt-hash.js "$KEY")
# Insert superadmin customer and API key (UUID) with bcrypt hash
SQL="DO \$\$
DECLARE
  cid UUID;
BEGIN
  INSERT INTO customers (name, email, role) VALUES ('$NAME', 'bootstrap@example.com', 'superadmin') ON CONFLICT (email) DO NOTHING;
  SELECT id INTO cid FROM customers WHERE name = '$NAME';
  INSERT INTO api_keys (customer_id, key_hash, revoked) VALUES (cid, '$HASH', FALSE);
END\$\$ LANGUAGE plpgsql;"
echo "$SQL" | kubectl exec -i "$POD" -- bash -c "PGPASSWORD=postgres psql -U postgres -d apphoster"
echo "Superadmin user '$NAME' and API key '$KEY' added for testing."
# Insert test user for bootstrap customer using bcrypt hash
USER_EMAIL="bootstrap.user@example.com"
USER_PASSWORD="testpassword"
USER_NAME="Bootstrap User"
USER_ROLE="admin"
echo "Adding test user '$USER_EMAIL' with bcrypt password hash..."
USER_BCRYPT_HASH='$2b$10$PPkJqDpvMZa5h37nSy5D/unNbbC/WL1OHUHEbUoJHnRLl9ntMDN0C'
USER_SQL="DO \$\$
DECLARE
  cid UUID;
BEGIN
  SELECT id INTO cid FROM customers WHERE name = '$NAME';
  INSERT INTO users (customer_id, email, password_hash, name, role) VALUES (cid, '$USER_EMAIL', '$USER_BCRYPT_HASH', '$USER_NAME', '$USER_ROLE') ON CONFLICT (email) DO NOTHING;
END\$\$ LANGUAGE plpgsql;"
echo "$USER_SQL" | kubectl exec -i "$POD" -- bash -c "PGPASSWORD=postgres psql -U postgres -d apphoster"
echo "Test user '$USER_EMAIL' added for bootstrap customer."
