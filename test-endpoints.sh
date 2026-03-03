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

fail() {
  echo "[FAIL] $1"
  exit 1
}

# 1. List apps (should be empty)
echo "\n[GET] List apps:"
LIST=$(curl -s -H "x-api-key: $API_KEY" "$API_URL/apps")
echo "$LIST"
[[ "$LIST" == "[]" ]] || fail "Expected empty app list"

# 2. Upload a dummy file
echo "\n[POST] Upload app file:"
echo "test file for endpoint testing" > test-endpoint.txt
UPLOAD_RESPONSE=$(curl -s -X POST -H "x-api-key: $API_KEY" -F "file=@test-endpoint.txt" "$API_URL/apps/upload")
echo "$UPLOAD_RESPONSE"
APP_ID=$(echo "$UPLOAD_RESPONSE" | grep -o '"id":[0-9]*' | grep -o '[0-9]*')
[[ "$UPLOAD_RESPONSE" == *'"success":true'* ]] || fail "Upload failed"
[[ -n "$APP_ID" ]] || fail "App ID not found after upload"

# 3. List apps (should show uploaded file)
echo "\n[GET] List apps after upload:"
LIST2=$(curl -s -H "x-api-key: $API_KEY" "$API_URL/apps")
echo "$LIST2"
[[ "$LIST2" == *'"filename":"test-endpoint.txt"'* ]] || fail "Uploaded file not listed"

# 4. Download the uploaded file
echo "\n[GET] Download app file:"
curl -s -H "x-api-key: $API_KEY" "$API_URL/apps/$APP_ID/download" -o downloaded-endpoint.txt
cat downloaded-endpoint.txt
[[ $(cat downloaded-endpoint.txt) == "test file for endpoint testing" ]] || fail "Downloaded file contents incorrect"

# 5. Delete the uploaded file
echo "\n[DELETE] Delete app file:"
DEL=$(curl -s -X DELETE -H "x-api-key: $API_KEY" "$API_URL/apps/$APP_ID")
echo "$DEL"
[[ "$DEL" == *'"success":true'* ]] || fail "Delete failed"

# 6. List apps (should be empty again)
echo "\n[GET] List apps after delete:"
LIST3=$(curl -s -H "x-api-key: $API_KEY" "$API_URL/apps")
echo "$LIST3"
[[ "$LIST3" == "[]" ]] || fail "App list not empty after delete"

# 7. Error handling tests

# Upload with no file
echo "\n[POST] Upload with no file (should fail):"
NOFILE=$(curl -s -X POST -H "x-api-key: $API_KEY" "$API_URL/apps/upload")
echo "$NOFILE"
[[ "$NOFILE" == *'No file uploaded'* ]] || fail "Expected error for missing file"

# Download with invalid ID
echo "\n[GET] Download with invalid ID (should fail):"
BADID=$(curl -s -H "x-api-key: $API_KEY" "$API_URL/apps/abc/download")
echo "$BADID"
[[ "$BADID" == *'Invalid app ID'* ]] || fail "Expected error for invalid app ID"

# Delete with invalid ID
echo "\n[DELETE] Delete with invalid ID (should fail):"
BADDEL=$(curl -s -X DELETE -H "x-api-key: $API_KEY" "$API_URL/apps/xyz")
echo "$BADDEL"
[[ "$BADDEL" == *'Invalid app ID'* ]] || fail "Expected error for invalid app ID"

# Download non-existent app
echo "\n[GET] Download non-existent app (should fail):"
NOTFOUND=$(curl -s -H "x-api-key: $API_KEY" "$API_URL/apps/9999/download")
echo "$NOTFOUND"
[[ "$NOTFOUND" == *'App not found'* ]] || fail "Expected error for missing app"

# Delete non-existent app
echo "\n[DELETE] Delete non-existent app (should fail):"
NOTDEL=$(curl -s -X DELETE -H "x-api-key: $API_KEY" "$API_URL/apps/9999")
echo "$NOTDEL"
[[ "$NOTDEL" == *'App not found'* ]] || fail "Expected error for missing app"

# Cleanup
echo "\nCleaning up test files..."
rm -f test-endpoint.txt downloaded-endpoint.txt

echo "\nAll endpoint tests completed successfully."
