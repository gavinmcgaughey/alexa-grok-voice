# Create the Grok Voice DynamoDB table (AWS CLI on Windows).
# Usage: .\create-table.ps1 [-Region us-east-1]

param(
  [string]$Region = "us-east-1",
  [string]$TableName = $(if ($env:DYNAMODB_TABLE_NAME) { $env:DYNAMODB_TABLE_NAME } else { "GrokVoiceUsers" })
)

aws dynamodb create-table `
  --region $Region `
  --table-name $TableName `
  --billing-mode PAY_PER_REQUEST `
  --attribute-definitions AttributeName=userId,AttributeType=S `
  --key-schema AttributeName=userId,KeyType=HASH `
  --tags Key=Application,Value=GrokVoice

Write-Host "Waiting for table ACTIVE..."
aws dynamodb wait table-exists --region $Region --table-name $TableName
Write-Host "Table $TableName ready in $Region."
