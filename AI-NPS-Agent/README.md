Azure-Hosted AI Chat Assistant for NPS Prediction & Detractor Prevention

Overview
This repository contains a full-stack prototype for an Azure-ready AI assistant that monitors live customer-agent chats, predicts NPS detractor risk in real time, and proactively alerts agents to prevent poor outcomes. The system is designed to run locally with mock data and can be deployed to Azure App Service with Azure SQL, SignalR, Communication Services, Azure OpenAI, Azure ML, and Azure AD B2C scaffolding.

Key Features
- Secure login (mock locally, Azure AD B2C scaffolded)
- Live chat UI with proactive popup alerts to agents
- Real-time NPS detractor risk predictions
- Manager dashboard for NPS history (last 3 months)
- Training pipeline to retrain the model from CSV
- Azure-ready infra (Dockerfiles, docker-compose, GitHub Actions, Bicep placeholders)

Project Structure
AI-NPS-Agent/
- frontend/        React + Vite + MUI chat UI, alerts, manager dashboard
- backend/         FastAPI APIs: /predict, /chat (WebSocket), /auth, /manager
- ai/              Training pipeline and mock CSV data
- database/        SQLite schema and seed data (Azure SQL ready)
- infra/           Dockerfiles, docker-compose, Azure deploy workflows, Bicep
- README.md        This file

Quick Start (Local)
Prerequisites
- Node.js 18+
- Python 3.10+
- Docker (optional for containerized run)

1) Backend setup
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python -m app.main  # first run will train a model if none exists

Or run with uvicorn:
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

2) Database init (local SQLite)
cd ../database
python init_db.py

3) Frontend setup
cd ../frontend
npm install
npm run dev

Open http://localhost:5173 and log in with the mock user (or use the Azure AD B2C configuration placeholders to integrate).

Docker Compose (Optional)
From repository root:
cd infra
cp .env.example .env
docker compose up --build

This will start the backend on port 8000 and the frontend on port 5173.

Demo Workflow
1) Customer starts a chat session
2) Agent chats via the UI
3) Backend monitors messages, computes sentiment and prediction
4) If risk > threshold, the agent sees a popup alert in <2 seconds
5) Manager dashboard shows NPS summary and recent chats

Azure Deployment Overview
Services used (scaffolded):
- Azure App Service: host frontend and backend
- Azure Communication Services: live chat (local demo uses WebSocket)
- Azure SignalR Service: real-time alerts (local demo uses WebSocket broadcast)
- Azure SQL Database: store NPS, transcripts, metadata (local uses SQLite)
- Azure OpenAI Service: embeddings + prediction (optional at runtime)
- Azure Machine Learning: training pipeline (example script and pointers)
- Azure AD B2C: authentication (scaffolded, mock fallback)

Steps
1) Provision resources via Bicep templates in infra/azure/bicep (edit parameters.json)
2) Set app settings (connection strings, API keys) in App Service and GitHub Secrets
3) Push to main to trigger GitHub Actions in infra/azure/*.yml
4) Configure Azure Front Door or App Service routing as needed

Configuration
Environment variables (backend .env):
- AUTH_PROVIDER=mock | azureb2c
- JWT_SECRET=change_me
- SQLITE_DB_PATH=../database/app.db
- MODEL_PATH=../ai/model/model.pkl
- AZURE_OPENAI_ENDPOINT=
- AZURE_OPENAI_API_KEY=
- AZURE_OPENAI_DEPLOYMENT=
- SIGNALR_CONNECTION_STRING=
- ACS_CONNECTION_STRING=
- AZURE_SQL_CONNECTION_STRING=

Environment variables (frontend .env):
- VITE_API_BASE=http://localhost:8000
- VITE_WS_URL=ws://localhost:8000/ws/chat
- VITE_AUTH_PROVIDER=mock | azureb2c
- VITE_AAD_B2C_TENANT=your-tenant
- VITE_AAD_B2C_CLIENT_ID=client-id
- VITE_AAD_B2C_SIGNIN_USER_FLOW=B2C_1_signin

APIs
- GET /health
- POST /auth/login (mock)
- GET /auth/me (mock)
- WS /ws/chat?sessionId=<id>
- POST /predict { transcript, history? }
- GET /manager/summary

AI Training
- Data: ai/data/mock_nps_chats.csv (schema: date&time,chat_ID,Chat_Transcript,NPS score,chat_Reason_CWC,M1,M2,M3,Segment,Lang,HandledAgentlogin,HandledAgentsite)
- Run training: python ai/train_model.py --data ai/data/mock_nps_chats.csv --out ai/model/model.pkl
- The backend auto-trains a small model on first run if model is missing

Notes
- The prototype uses WebSocket for real-time alerts locally. Azure SignalR/ACS client code is scaffolded for future integration.
- Azure AD B2C integration is scaffolded; use mock auth locally.
- Do not use this prototype in production without security hardening.

License
MIT

