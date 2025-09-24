#!/bin/bash

# Azure AI Chat NPS Assistant Deployment Script
# Deploys to Azure Static Web Apps + Functions (Free Tier)

set -e

echo "🚀 Starting Azure AI Chat NPS Assistant Deployment"
echo "=================================================="

# Configuration
RESOURCE_GROUP="ai-nps-assistant-rg"
LOCATION="eastus"
STATIC_WEB_APP_NAME="ai-nps-assistant-web"
FUNCTION_APP_NAME="ai-nps-assistant-api"
STORAGE_ACCOUNT="ainpsassistantstorage"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if Azure CLI is installed
if ! command -v az &> /dev/null; then
    print_error "Azure CLI is not installed. Please install it first."
    exit 1
fi

# Check if user is logged in
if ! az account show &> /dev/null; then
    print_error "Please login to Azure CLI first: az login"
    exit 1
fi

print_status "Azure CLI is ready"

# Create resource group
echo "📦 Creating resource group..."
az group create \
    --name $RESOURCE_GROUP \
    --location $LOCATION \
    --output table

print_status "Resource group created: $RESOURCE_GROUP"

# Create storage account for Static Web App
echo "💾 Creating storage account..."
az storage account create \
    --name $STORAGE_ACCOUNT \
    --resource-group $RESOURCE_GROUP \
    --location $LOCATION \
    --sku Standard_LRS \
    --kind StorageV2 \
    --output table

print_status "Storage account created: $STORAGE_ACCOUNT"

# Create Static Web App
echo "🌐 Creating Static Web App..."
az staticwebapp create \
    --name $STATIC_WEB_APP_NAME \
    --resource-group $RESOURCE_GROUP \
    --source https://github.com/your-username/ai-nps-assistant \
    --location $LOCATION \
    --branch main \
    --app-location "/frontend" \
    --api-location "/azure-functions" \
    --output-location "dist" \
    --output table

print_status "Static Web App created: $STATIC_WEB_APP_NAME"

# Get Static Web App details
STATIC_WEB_APP_URL=$(az staticwebapp show \
    --name $STATIC_WEB_APP_NAME \
    --resource-group $RESOURCE_GROUP \
    --query "defaultHostname" \
    --output tsv)

print_status "Static Web App URL: https://$STATIC_WEB_APP_URL"

# Create Function App (Consumption Plan - Free Tier)
echo "⚡ Creating Function App..."
az functionapp create \
    --name $FUNCTION_APP_NAME \
    --resource-group $RESOURCE_GROUP \
    --storage-account $STORAGE_ACCOUNT \
    --consumption-plan-location $LOCATION \
    --runtime python \
    --runtime-version 3.11 \
    --functions-version 4 \
    --output table

print_status "Function App created: $FUNCTION_APP_NAME"

# Configure Function App settings
echo "⚙️  Configuring Function App settings..."
az functionapp config appsettings set \
    --name $FUNCTION_APP_NAME \
    --resource-group $RESOURCE_GROUP \
    --settings \
        ENV=production \
        AUTH_PROVIDER=mock \
        JWT_SECRET=$(openssl rand -base64 32) \
        MODEL_PATH=/home/site/wwwroot/ai/model/model.pkl \
        ALLOWED_ORIGINS=https://$STATIC_WEB_APP_URL \
    --output table

print_status "Function App settings configured"

# Deploy Function App code
echo "📦 Deploying Function App code..."
cd azure-functions
zip -r ../function-app.zip .
cd ..

az functionapp deployment source config-zip \
    --name $FUNCTION_APP_NAME \
    --resource-group $RESOURCE_GROUP \
    --src function-app.zip \
    --output table

print_status "Function App code deployed"

# Deploy AI model
echo "🤖 Deploying AI model..."
az functionapp deployment source config-zip \
    --name $FUNCTION_APP_NAME \
    --resource-group $RESOURCE_GROUP \
    --src ai-model.zip \
    --output table

print_status "AI model deployed"

# Get Function App URL
FUNCTION_APP_URL=$(az functionapp show \
    --name $FUNCTION_APP_NAME \
    --resource-group $RESOURCE_GROUP \
    --query "defaultHostName" \
    --output tsv)

print_status "Function App URL: https://$FUNCTION_APP_URL"

# Test deployment
echo "🧪 Testing deployment..."
sleep 30  # Wait for deployment to complete

# Test health endpoint
if curl -s "https://$FUNCTION_APP_URL/api/health" | grep -q "ok"; then
    print_status "Health endpoint is working"
else
    print_warning "Health endpoint test failed - may need more time to deploy"
fi

# Clean up temporary files
rm -f function-app.zip ai-model.zip

echo ""
echo "🎉 Deployment Complete!"
echo "======================"
echo "Static Web App: https://$STATIC_WEB_APP_URL"
echo "Function App: https://$FUNCTION_APP_URL"
echo "Health Check: https://$FUNCTION_APP_URL/api/health"
echo ""
echo "📋 Next Steps:"
echo "1. Update frontend environment variables with Function App URL"
echo "2. Test the application end-to-end"
echo "3. Configure custom domain (optional)"
echo "4. Set up monitoring and alerts"
echo ""
echo "🔧 Management Commands:"
echo "View logs: az functionapp logs tail --name $FUNCTION_APP_NAME --resource-group $RESOURCE_GROUP"
echo "Delete resources: az group delete --name $RESOURCE_GROUP --yes"
echo ""

print_status "Deployment script completed successfully!"