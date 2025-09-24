#!/bin/bash

echo "🚀 Preparing to push AI NPS Assistant to GitHub for deployment..."

# Check if we're in a git repository
if [ ! -d ".git" ]; then
    echo "❌ Not in a git repository. Initializing..."
    git init
    git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
    echo "⚠️  Please update the remote URL above with your actual GitHub repository URL"
fi

# Add all files
echo "📁 Adding files to git..."
git add .

# Commit changes
echo "💾 Committing changes..."
git commit -m "Add GitHub Actions deployment workflow for Azure free tier

- Added static-web-app-deploy.yml workflow
- Added azure-deploy-free-tier.yml workflow  
- Added GitHub deployment guide
- Ready for Azure Static Web Apps deployment"

# Push to main branch
echo "🚀 Pushing to GitHub..."
git push origin main

echo "✅ Code pushed to GitHub!"
echo ""
echo "📋 Next steps:"
echo "1. Go to your GitHub repository"
echo "2. Follow the GITHUB_DEPLOYMENT_GUIDE.md"
echo "3. Create Azure Static Web App"
echo "4. Configure GitHub Secrets"
echo "5. Watch the deployment in GitHub Actions"
echo ""
echo "🎯 Your app will be live at: https://[your-app-name].azurestaticapps.net"