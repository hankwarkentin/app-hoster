#!/usr/bin/env bash
set -euo pipefail

# Clears the configured local S3 buckets (intended for localstack or S3-compatible dev endpoints)
# Usage: ./clear-localstack-buckets.sh
# Optional env vars:
#  LOCALSTACK_S3_ENDPOINT - default: http://localhost:4566
#  AWSCLI - path to aws CLI binary (default: aws)

ENDPOINT="${LOCALSTACK_S3_ENDPOINT:-http://localhost:4566}"
AWS_CMD="${AWSCLI:-aws}"

# If AWS credentials are not provided, set sensible test defaults for localstack
# These are safe for local development only and will be exported for aws CLI to use
AWS_ACCESS_KEY_ID="${AWS_ACCESS_KEY_ID:-test}"
AWS_SECRET_ACCESS_KEY="${AWS_SECRET_ACCESS_KEY:-test}"
AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-us-east-1}"

export AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_DEFAULT_REGION

BUCKETS=("app-bucket" "app-icon-bucket")

  if ! command -v "$AWS_CMD" >/dev/null 2>&1; then
  echo "Error: AWS CLI not found at '$AWS_CMD'. Install aws CLI or set AWSCLI env var." >&2
  exit 1
fi

echo "Clearing S3 buckets at endpoint: $ENDPOINT"
for b in "${BUCKETS[@]}"; do
  echo "- Emptying bucket: $b"
  # Use exported credentials (or defaults) when calling aws
  "$AWS_CMD" --endpoint-url "$ENDPOINT" s3 rm "s3://$b" --recursive || echo "  (warning) failed to empty $b"
done

echo "Done."
