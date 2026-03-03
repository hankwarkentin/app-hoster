#!/bin/bash
# test-endpoints.sh: Automated script to test all AppHoster API endpoints
# Usage: ./test-endpoints.sh <api-key>

set -e
API_KEY="$1"
API_URL="http://localhost:8000/api"

if [ -z "$API_KEY" ]; then
  echo "Usage: $0 <api-key>"
  exit 1
fi

# 1. List apps (should be empty)
echo "\n[GET] List apps:"
curl -s -H "x-api-key: $API_KEY" "$API_URL/apps"

# 2. Upload a dummy file
echo "\n[POST] Upload app file:"
echo "test file for endpoint testing" > test-endpoint.txt
UPLOAD_RESPONSE=$(curl -s -X POST -H "x-api-key: $API_KEY" -F "file=@test-endpoint.txt" "$API_URL/apps/upload")
echo "$UPLOAD_RESPONSE"
APP_ID=$(echo "$UPLOAD_RESPONSE" | grep -o '"id":[0-9]*' | grep -o '[0-9]*')

# 3. List apps (should show uploaded file)
echo "\n[GET] List apps after upload:"
curl -s -H "x-api-key: $API_KEY" "$API_URL/apps"

# 4. Download the uploaded file
echo "\n[GET] Download app file:"
curl -s -H "x-api-key: $API_KEY" "$API_URL/apps/$APP_ID/download" -o downloaded-endpoint.txt
cat downloaded-endpoint.txt

# 5. Delete the uploaded file
echo "\n[DELETE] Delete app file:"
curl -s -X DELETE -H "x-api-key: $API_KEY" "$API_URL/apps/$APP_ID"

# 6. List apps (should be empty again)
echo "\n[GET] List apps after delete:"
curl -s -H "x-api-key: $API_KEY" "$API_URL/apps"

# Cleanup
echo "\nCleaning up test files..."
rm -f test-endpoint.txt downloaded-endpoint.txt

echo "\nAll endpoint tests completed."
