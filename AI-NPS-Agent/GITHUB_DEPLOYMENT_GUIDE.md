# 🚀 GitHub Actions Deployment Guide
## Deploy AI NPS Assistant to Azure Free Tier

This guide will help you deploy your AI NPS Assistant to Azure using GitHub Actions, avoiding the CLI authentication issues.

---

## 📋 Prerequisites

1. **GitHub Account** with repository access
2. **Azure Account** (free tier eligible)
3. **Your project code** (already ready in this repository)

---

## 🔧 Step 1: Create Azure Static Web App

### Option A: Using Azure Portal (Recommended)
1. Go to [Azure Portal](https://portal.azure.com)
2. Search for "Static Web Apps"
3. Click "Create"
4. Fill in the details:
   - **Subscription**: Your Azure subscription
   - **Resource Group**: Create new `ai-nps-assistant-rg`
   - **Name**: `ai-nps-frontend-[random]` (e.g., `ai-nps-frontend-abc123`)
   - **Plan type**: Free
   - **Region**: East US
   - **Source**: GitHub
   - **GitHub account**: Your GitHub account
   - **Organization**: Your GitHub username
   - **Repository**: `AI-NPS-Agent` (or your repo name)
   - **Branch**: `main` or `master`
   - **Build Presets**: Custom
   - **App location**: `/frontend`
   - **API location**: `/azure-functions`
   - **Output location**: `dist`

5. Click "Review + Create" then "Create"

### Option B: Using Azure CLI (if working)
```bash
az staticwebapp create \
  --name ai-nps-frontend-$(date +%s) \
  --resource-group ai-nps-assistant-rg \
  --location eastus \
  --output-location "frontend/dist" \
  --api-location "azure-functions" \
  --source-branch "main" \
  --app-location "frontend" \
  --sku Free
```

---

## 🔑 Step 2: Get Deployment Token

After creating the Static Web App:

1. Go to your Static Web App in Azure Portal
2. Click on "Manage deployment token"
3. Copy the **Deployment Token**
4. This token will be used in GitHub Secrets

---

## ⚙️ Step 3: Configure GitHub Secrets

1. Go to your GitHub repository
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add these secrets:

### Required Secrets:
- **Name**: `AZURE_STATIC_WEB_APPS_API_TOKEN`
- **Value**: [Your deployment token from Step 2]

### Optional Secrets (for advanced deployment):
- **Name**: `AZURE_CREDENTIALS`
- **Value**: [Azure service principal credentials]

---

## 🚀 Step 4: Push to GitHub

1. Commit and push your code to the main branch:
```bash
git add .
git commit -m "Add GitHub Actions deployment workflow"
git push origin main
```

2. The deployment will start automatically!

---

## 📊 Step 5: Monitor Deployment

1. Go to your GitHub repository
2. Click **Actions** tab
3. Watch the "Deploy to Azure Static Web Apps" workflow
4. Wait for completion (usually 5-10 minutes)

---

## 🌐 Step 6: Access Your Live App

After successful deployment:

1. Go to your Static Web App in Azure Portal
2. Click on the **URL** to access your live application
3. Your app will be available at: `https://[your-app-name].azurestaticapps.net`

---

## 🔧 Step 7: Configure Environment Variables

In Azure Portal, go to your Static Web App:

1. Click **Configuration** → **Application settings**
2. Add these environment variables:
   - `ENVIRONMENT=production`
   - `DATABASE_URL=[your-azure-sql-connection-string]` (if using Azure SQL)
   - `JWT_SECRET_KEY=[your-secret-key]`

---

## 🎯 Expected Results

After deployment, you should have:

- ✅ **Frontend**: React app running on Azure Static Web Apps
- ✅ **Backend**: FastAPI functions running on Azure Functions (free tier)
- ✅ **Database**: SQLite (local) or Azure SQL (production)
- ✅ **Domain**: `https://[your-app-name].azurestaticapps.net`
- ✅ **API**: `https://[your-app-name].azurestaticapps.net/api`

---

## 🛠️ Troubleshooting

### Common Issues:

1. **Build Fails**: Check Node.js version and dependencies
2. **API Not Working**: Verify Azure Functions configuration
3. **Environment Variables**: Ensure all required vars are set
4. **CORS Issues**: Check CORS configuration in backend

### Debug Steps:

1. Check GitHub Actions logs
2. Verify Azure Static Web App logs
3. Test API endpoints individually
4. Check browser console for errors

---

## 💰 Cost Information

**Azure Free Tier Includes:**
- Static Web Apps: 100GB bandwidth/month
- Azure Functions: 1M executions/month
- Storage: 5GB
- **Total Cost: $0/month**

---

## 🎉 Success!

Once deployed, your AI NPS Assistant will be live and accessible to users worldwide!

**Live URLs:**
- Frontend: `https://[your-app-name].azurestaticapps.net`
- API Docs: `https://[your-app-name].azurestaticapps.net/api/docs`
- Health Check: `https://[your-app-name].azurestaticapps.net/api/health`

---

## 📞 Support

If you encounter issues:
1. Check the GitHub Actions logs
2. Review Azure Static Web App logs
3. Verify all secrets are configured correctly
4. Ensure your code is pushed to the correct branch

**Happy Deploying! 🚀**