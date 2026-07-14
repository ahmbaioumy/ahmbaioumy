# NPS Hero - Customer Service AI Chat System

A comprehensive end-to-end application for customer service AI chat with real-time sentiment analysis, NPS prediction, and intelligent recommendations.

## 🚀 Features

### Core Features
- **Live Chat Interface** - Real-time chat between agents and customers
- **AI Sentiment Analysis** - Real-time sentiment prediction using Azure Cognitive Services
- **NPS Prediction** - Automatic customer type classification (Detractor, Neutral, Promoter)
- **AI Recommendations** - Intelligent suggestions for agents to improve customer satisfaction
- **Role-Based Dashboards** - Different views for Agents, Managers, and Admins
- **Real-Time Notifications** - Live updates using Azure SignalR Service

### Technology Stack
- **Frontend**: React.js with Azure Static Web Apps
- **Backend**: Node.js Azure Functions (Serverless)
- **Database**: Azure Cosmos DB for chat history and user data
- **Real-Time**: Azure SignalR Service for live updates
- **AI Services**: Azure Cognitive Services - Text Analytics
- **Authentication**: Azure Active Directory (AAD)
- **Storage**: Azure Blob Storage for chat logs

## 📁 Project Structure

```
nps-hero/
├── frontend/                 # React.js frontend application
│   ├── src/
│   │   ├── components/       # Reusable React components
│   │   ├── pages/           # Main application pages
│   │   ├── services/        # API service layer
│   │   └── App.js          # Main application component
│   ├── public/             # Static assets
│   └── package.json        # Frontend dependencies
├── backend/                 # Azure Functions backend
│   ├── analyzeSentiment/   # Sentiment analysis function
│   ├── predictNps/        # NPS prediction function
│   ├── saveChat/          # Chat storage function
│   ├── chatHub/           # SignalR hub function
│   ├── dashboardData/     # Dashboard data function
│   ├── recommendations/   # AI recommendations function
│   └── package.json       # Backend dependencies
├── azure-deploy.json       # ARM template for Azure resources
├── deploy.sh              # Deployment script
└── README.md              # This file
```

## 🛠️ Setup and Installation

### Prerequisites
- Node.js 18+ and npm
- Azure CLI
- Azure subscription
- Git

### 1. Clone the Repository
```bash
git clone <repository-url>
cd nps-hero
```

### 2. Install Dependencies
```bash
# Install all dependencies
npm run install-all

# Or install separately
npm run install-frontend
npm run install-backend
```

### 3. Configure Environment Variables

#### Frontend Configuration
Copy `frontend/.env.example` to `frontend/.env` and update with your values:
```bash
cp frontend/.env.example frontend/.env
```

#### Backend Configuration
Update `backend/local.settings.json` with your Azure service keys.

### 4. Deploy to Azure

#### Option 1: Automated Deployment
```bash
# Make deployment script executable
chmod +x deploy.sh

# Run deployment script
./deploy.sh
```

#### Option 2: Manual Deployment
```bash
# Create resource group
az group create --name rg-nps-assistant --location eastus

# Deploy Azure resources
az deployment group create \
    --resource-group rg-nps-assistant \
    --template-file azure-deploy.json \
    --parameters appName=npsHero location=eastus

# Deploy Azure Functions
cd backend
func azure functionapp publish npsHeroBackend --javascript

# Deploy Static Web App
cd ../frontend
az staticwebapp create \
    --name npsHeroFrontend \
    --resource-group rg-nps-assistant \
    --source . \
    --location eastus \
    --branch main
```

## 🎯 Usage

### 1. Access the Application
After deployment, access your application at the Static Web App URL provided in the deployment output.

### 2. Authentication
- Sign in using Azure Active Directory
- Different roles have different access levels:
  - **Agents**: Chat interface and basic dashboard
  - **Managers**: Team performance and NPS trends
  - **Admins**: User management and system settings

### 3. Using the Chat Interface
1. Navigate to the chat interface
2. Start a conversation with a customer
3. Real-time sentiment analysis will appear
4. NPS prediction will be calculated automatically
5. AI recommendations will be provided

### 4. Dashboard Features
- **Agent Dashboard**: View personal metrics and recent chats
- **Manager Dashboard**: Monitor team performance and NPS trends
- **Admin Panel**: Manage users, settings, and system health

## 🔧 Configuration

### Azure Services Configuration
The application uses the following Azure services:

1. **Azure Cognitive Services - Text Analytics**
   - Endpoint: `TEXT_ANALYTICS_ENDPOINT`
   - Key: `TEXT_ANALYTICS_KEY`

2. **Azure Cosmos DB**
   - Endpoint: `COSMOS_DB_ENDPOINT`
   - Key: `COSMOS_DB_KEY`
   - Database: `npsHeroDB`
   - Container: `chatLogs`

3. **Azure SignalR Service**
   - Connection String: `SIGNALR_CONNECTION_STRING`

4. **Azure Blob Storage**
   - Connection String: `STORAGE_CONNECTION_STRING`

### System Settings
Configure system behavior through the admin panel:
- NPS thresholds (Detractor/Promoter)
- Sentiment confidence threshold
- Auto-notification settings
- Chat retention period

## 📊 API Endpoints

### Core APIs
- `POST /api/analyze-sentiment` - Analyze text sentiment
- `POST /api/predict-nps` - Predict NPS score
- `POST /api/save-chat` - Save chat log
- `GET /api/chat-history` - Retrieve chat history

### Dashboard APIs
- `GET /api/dashboard-data` - Get dashboard metrics
- `GET /api/manager-dashboard` - Get manager dashboard data
- `GET /api/team-performance` - Get team performance metrics
- `GET /api/nps-trends` - Get NPS trend data

### Admin APIs
- `GET /api/admin-data` - Get admin dashboard data
- `GET /api/users` - Get user list
- `PUT /api/users/{userId}/role` - Update user role
- `GET /api/system-settings` - Get system settings
- `PUT /api/system-settings` - Update system settings

### Utility APIs
- `GET /api/health` - Health check
- `GET /api/recommendations` - Get AI recommendations

## 🔒 Security

### Authentication
- Azure Active Directory integration
- Role-based access control (RBAC)
- Secure token handling

### Data Protection
- All communication encrypted with SSL/TLS
- Sensitive data encrypted at rest
- Secure API endpoints with authentication

### Compliance
- GDPR compliant data handling
- Configurable data retention policies
- Audit logging for all operations

## 🚀 Deployment Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React App     │    │  Azure Functions │    │   Azure Cosmos  │
│ (Static Web App)│◄──►│   (Serverless)   │◄──►│      DB         │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Azure AD      │    │  Text Analytics │    │  Blob Storage   │
│ (Authentication)│    │   (AI Service)  │    │  (Chat Logs)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │  SignalR Service │
                       │ (Real-time Comm)│
                       └─────────────────┘
```

## 📈 Monitoring and Analytics

### Application Insights
- Performance monitoring
- Error tracking
- Usage analytics
- Custom metrics

### Health Monitoring
- Service health checks
- Dependency monitoring
- Performance metrics
- Alert notifications

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Check the documentation
- Contact the development team

## 🔄 Updates and Maintenance

### Regular Updates
- Security patches
- Feature enhancements
- Performance optimizations
- Bug fixes

### Monitoring
- Regular health checks
- Performance monitoring
- Security audits
- Backup verification

---

**NPS Hero** - Empowering customer service teams with AI-driven insights and real-time analytics.