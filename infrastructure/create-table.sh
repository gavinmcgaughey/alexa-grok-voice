#!/usr/bin/env bash
# Create the Grok Voice DynamoDB table (AWS CLI).
# Usage: ./create-table.sh [region]

set -euo pipefail
REGION="${1:-us-east-1}"
TABLE_NAME="${DYNAMODB_TABLE_NAME:-GrokVoiceUsers}"

aws dynamodb create-table \
  --region "$REGION" \
  --table-name "$TABLE_NAME" \
  --billing-mode PAY_PER_REQUEST \
  --attribute-definitions AttributeName=userId,AttributeType=S \
  --key-schema AttributeName=userId,KeyType=HASH \
  --tags Key=Application,Value=GrokVoice

echo "Waiting for table ACTIVE..."
aws dynamodb wait table-exists --region "$REGION" --table-name "$TABLE_NAME"
echo "Table $TABLE_NAME ready in $REGION."
