@description('Base name for resources')
param baseName string = 'ai-nps-agent'
@description('Location')
param location string = resourceGroup().location

// Placeholders for required services
// App Service Plan + Web Apps (frontend/backend), Azure SQL, SignalR, ACS, AML Workspace, Azure OpenAI, B2C

// App Service plan
resource plan 'Microsoft.Web/serverfarms@2023-01-01' = {
  name: '${baseName}-plan'
  location: location
  sku: {
    name: 'B1'
    tier: 'Basic'
    size: 'B1'
    capacity: 1
  }
}

// Backend Web App
resource backend 'Microsoft.Web/sites@2023-01-01' = {
  name: '${baseName}-backend'
  location: location
  properties: {
    httpsOnly: true
    serverFarmId: plan.id
    siteConfig: {
      appSettings: [
        { name: 'WEBSITES_PORT', value: '8000' }
      ]
    }
  }
}

// Frontend Web App
resource frontend 'Microsoft.Web/sites@2023-01-01' = {
  name: '${baseName}-frontend'
  location: location
  properties: {
    httpsOnly: true
    serverFarmId: plan.id
  }
}

// SignalR Service
resource signalr 'Microsoft.SignalRService/signalr@2023-02-01' = {
  name: '${baseName}-signalr'
  location: location
  sku: {
    name: 'Standard_S1'
    capacity: 1
  }
  properties: {
    tls: {
      clientCertEnabled: false
    }
    features: [
      {
        flag: 'ServiceMode'
        value: 'Default'
      }
    ]
  }
}

// Azure Communication Services (placeholder)
resource acs 'Microsoft.Communication/communicationServices@2023-04-01' = {
  name: '${baseName}-acs'
  location: location
  properties: {
    dataLocation: location
  }
}

// Azure SQL (logical server + db)
resource sqlServer 'Microsoft.Sql/servers@2022-05-01-preview' = {
  name: '${baseName}-sql'
  location: location
  properties: {
    administratorLogin: 'sqladminuser'
    administratorLoginPassword: 'ChangeMe123!'
    publicNetworkAccess: 'Enabled'
  }
}

resource sqlDb 'Microsoft.Sql/servers/databases@2022-05-01-preview' = {
  parent: sqlServer
  name: '${baseName}-db'
  location: location
  sku: {
    name: 'Basic'
    tier: 'Basic'
  }
}

// Outputs
output backendUrl string = backend.properties.defaultHostName
output frontendUrl string = frontend.properties.defaultHostName

