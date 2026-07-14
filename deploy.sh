#!/bin/bash

# NPS Hero Deployment Script
# This script deploys the NPS Hero application to Azure

set -e

echo "🚀 Starting NPS Hero Deployment..."

# Configuration
RESOURCE_GROUP="rg-nps-assistant"
LOCATION="eastus"
APP_NAME="npsHero"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Azure CLI is installed
if ! command -v az &> /dev/null; then
    print_error "Azure CLI is not installed. Please install it first."
    exit 1
fi

# Check if user is logged in
if ! az account show &> /dev/null; then
    print_error "You are not logged in to Azure CLI. Please run 'az login' first."
    exit 1
fi

print_status "Logged in to Azure CLI"

# Create resource group
print_status "Creating resource group: $RESOURCE_GROUP"
az group create --name $RESOURCE_GROUP --location $LOCATION

print_success "Resource group created successfully"

# Deploy Azure resources using ARM template
print_status "Deploying Azure resources..."
az deployment group create \
    --resource-group $RESOURCE_GROUP \
    --template-file azure-deploy.json \
    --parameters appName=$APP_NAME location=$LOCATION

print_success "Azure resources deployed successfully"

# Get deployment outputs
print_status "Getting deployment outputs..."
FUNCTION_APP_NAME=$(az deployment group show --resource-group $RESOURCE_GROUP --name azure-deploy --query properties.outputs.functionAppName.value -o tsv)
STATIC_WEB_APP_NAME=$(az deployment group show --resource-group $RESOURCE_GROUP --name azure-deploy --query properties.outputs.staticWebAppName.value -o tsv)
COSMOS_ENDPOINT=$(az deployment group show --resource-group $RESOURCE_GROUP --name azure-deploy --query properties.outputs.cosmosDbEndpoint.value -o tsv)
TEXT_ANALYTICS_ENDPOINT=$(az deployment group show --resource-group $RESOURCE_GROUP --name azure-deploy --query properties.outputs.textAnalyticsEndpoint.value -o tsv)
SIGNALR_ENDPOINT=$(az deployment group show --resource-group $RESOURCE_GROUP --name azure-deploy --query properties.outputs.signalREndpoint.value -o tsv)

print_success "Deployment outputs retrieved"

# Install backend dependencies
print_status "Installing backend dependencies..."
cd backend
npm install
cd ..

print_success "Backend dependencies installed"

# Deploy Azure Functions
print_status "Deploying Azure Functions..."
cd backend
func azure functionapp publish $FUNCTION_APP_NAME --javascript
cd ..

print_success "Azure Functions deployed successfully"

# Install frontend dependencies
print_status "Installing frontend dependencies..."
cd frontend
npm install
cd ..

print_success "Frontend dependencies installed"

# Build frontend
print_status "Building frontend..."
cd frontend
npm run build
cd ..

print_success "Frontend built successfully"

# Deploy static web app
print_status "Deploying static web app..."
cd frontend
az staticwebapp create \
    --name $STATIC_WEB_APP_NAME \
    --resource-group $RESOURCE_GROUP \
    --source . \
    --location $LOCATION \
    --branch main \
    --app-location "/" \
    --output-location "build"

cd ..

print_success "Static web app deployed successfully"

# Configure CORS for Azure Functions
print_status "Configuring CORS for Azure Functions..."
az functionapp cors add \
    --resource-group $RESOURCE_GROUP \
    --name $FUNCTION_APP_NAME \
    --allowed-origins "*"

print_success "CORS configured"

# Get URLs
FUNCTION_URL="https://$FUNCTION_APP_NAME.azurewebsites.net"
STATIC_URL=$(az staticwebapp show --name $STATIC_WEB_APP_NAME --resource-group $RESOURCE_GROUP --query defaultHostname -o tsv)
STATIC_URL="https://$STATIC_URL"

print_success "Deployment completed successfully!"
echo ""
echo "📋 Deployment Summary:"
echo "======================"
echo "Resource Group: $RESOURCE_GROUP"
echo "Location: $LOCATION"
echo "Function App: $FUNCTION_URL"
echo "Static Web App: $STATIC_URL"
echo "Cosmos DB Endpoint: $COSMOS_ENDPOINT"
echo "Text Analytics Endpoint: $TEXT_ANALYTICS_ENDPOINT"
echo "SignalR Endpoint: $SIGNALR_ENDPOINT"
echo ""
echo "🔧 Next Steps:"
echo "=============="
echo "1. Update frontend environment variables with the Function App URL"
echo "2. Configure Azure Active Directory authentication"
echo "3. Test the application at: $STATIC_URL"
echo "4. Monitor the application using Azure Application Insights"
echo ""
print_success "NPS Hero deployment completed! 🎉"