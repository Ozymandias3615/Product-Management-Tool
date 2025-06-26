# 🚀 Product Compass - Deployment Guide

Deploy your Product Compass web app to make it publicly accessible on the internet.

## 📋 Prerequisites

Before deploying, ensure you have:
- ✅ Your app working locally
- ✅ Firebase project set up (for Google authentication)
- ✅ Google OAuth credentials configured

## 🔥 Option 1: Heroku (Recommended - Easy & Free)

### Step 1: Install Heroku CLI
Download from: https://devcenter.heroku.com/articles/heroku-cli

### Step 2: Login and Create App
```bash
# Login to Heroku
heroku login

# Create a new app (replace 'my-product-compass' with your desired name)
heroku create my-product-compass

# Add PostgreSQL database (free tier)
heroku addons:create heroku-postgresql:mini
```

### Step 3: Set Environment Variables
```bash
# Set Flask environment
heroku config:set FLASK_ENV=production

# Set your secret key (generate a secure random string)
heroku config:set SECRET_KEY="your-super-secret-key-here"

# Firebase configuration
heroku config:set FIREBASE_API_KEY="your-firebase-api-key"
heroku config:set FIREBASE_AUTH_DOMAIN="your-project.firebaseapp.com"
heroku config:set FIREBASE_PROJECT_ID="your-project-id"
heroku config:set FIREBASE_STORAGE_BUCKET="your-project.appspot.com"
heroku config:set FIREBASE_MESSAGING_SENDER_ID="123456789"
heroku config:set FIREBASE_APP_ID="1:123456789:web:abcdef"

# Google OAuth
heroku config:set GOOGLE_CLIENT_ID="your-google-client-id.apps.googleusercontent.com"
```

### Step 4: Deploy
```bash
# Initialize git if not already done
git init
git add .
git commit -m "Initial deployment"

# Add Heroku remote and deploy
heroku git:remote -a my-product-compass
git push heroku main
```

### Step 5: Initialize Database
```bash
# Run database setup
heroku run python -c "from app import app, db; app.app_context().push(); db.create_all()"
```

**🎉 Your app will be live at: `https://my-product-compass.herokuapp.com`**

---

## ☁️ Option 2: Vercel (Fast & Free)

### Step 1: Install Vercel CLI
```bash
npm install -g vercel
```

### Step 2: Configure for Vercel
Create `vercel.json`:
```json
{
  "version": 2,
  "builds": [
    {
      "src": "app.py",
      "use": "@vercel/python"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "app.py"
    }
  ],
  "env": {
    "FLASK_ENV": "production"
  }
}
```

### Step 3: Deploy
```bash
vercel --prod
```

Add environment variables via Vercel dashboard or CLI:
```bash
vercel env add FIREBASE_API_KEY
vercel env add GOOGLE_CLIENT_ID
# ... add all your environment variables
```

---

## 🌊 Option 3: DigitalOcean App Platform

### Step 1: Create App
1. Go to DigitalOcean App Platform
2. Connect your GitHub repository
3. Choose "Web Service" type

### Step 2: Configure
- **Build Command:** `pip install -r requirements.txt`
- **Run Command:** `gunicorn app:app`
- **Environment Variables:** Add all Firebase and Google OAuth variables

### Step 3: Add Database
- Add PostgreSQL database component
- Database URL will be automatically provided

---

## 🔧 Option 4: Railway (Simple & Modern)

### Step 1: Deploy
1. Visit [railway.app](https://railway.app)
2. Connect GitHub and select your repository
3. Railway auto-detects Python and deploys

### Step 2: Add Database
- Add PostgreSQL plugin from Railway dashboard
- Environment variables are automatically set

### Step 3: Configure Environment
Add your Firebase and Google OAuth variables in Railway dashboard.

---

## 🐳 Option 5: Docker + Any Cloud

### Step 1: Create Dockerfile
```dockerfile
FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

ENV FLASK_ENV=production
EXPOSE 5000

CMD ["gunicorn", "--bind", "0.0.0.0:5000", "app:app"]
```

### Step 2: Build and Deploy
```bash
# Build image
docker build -t product-compass .

# Run locally to test
docker run -p 5000:5000 product-compass

# Deploy to your preferred cloud provider
# (AWS ECS, Google Cloud Run, Azure Container Instances, etc.)
```

---

## 🔒 Essential Security Setup

### 1. Generate Strong Secret Key
```python
import secrets
print(secrets.token_hex(32))
```

### 2. Configure Google OAuth
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Enable Google+ API
3. Create OAuth 2.0 credentials
4. Add your production domain to authorized origins:
   - `https://your-app-name.herokuapp.com`

### 3. Update Firebase Configuration
1. Go to Firebase Console
2. Add your production domain to authorized domains
3. Update OAuth redirect URLs

### 4. Environment Variables Checklist
```bash
# Required for production
SECRET_KEY=your-secret-key
FLASK_ENV=production
DATABASE_URL=postgresql://... (auto-provided by cloud platforms)

# Firebase (required for Google auth)
FIREBASE_API_KEY=your-api-key
FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_STORAGE_BUCKET=your-project.appspot.com
FIREBASE_MESSAGING_SENDER_ID=123456789
FIREBASE_APP_ID=1:123456789:web:abcdef

# Google OAuth
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

---

## 🎯 Custom Domain Setup

### For Heroku:
```bash
# Add custom domain
heroku domains:add www.yourcompany.com

# Configure DNS CNAME record
# CNAME: www -> your-app-name.herokuapp.com
```

### For Other Platforms:
Follow each platform's custom domain documentation.

---

## 📊 Monitoring & Analytics

### 1. Application Monitoring
- **Heroku:** Built-in metrics dashboard
- **Vercel:** Analytics in dashboard
- **Railway:** Real-time logs and metrics

### 2. Database Monitoring
- Monitor PostgreSQL performance
- Set up automated backups
- Configure connection pooling for high traffic

### 3. Error Tracking
Consider adding Sentry for error tracking:
```bash
pip install sentry-sdk[flask]
```

---

## 🚀 Performance Optimization

### 1. Enable CDN
- Use cloud provider's CDN for static assets
- Configure caching headers

### 2. Database Optimization
- Add database indexes for frequently queried fields
- Configure connection pooling
- Use database connection limits

### 3. Caching
Add Redis for session storage and caching:
```bash
pip install redis flask-session
```

---

## 🔄 CI/CD Pipeline

### GitHub Actions Example
Create `.github/workflows/deploy.yml`:
```yaml
name: Deploy to Heroku
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: akhileshns/heroku-deploy@v3.12.12
        with:
          heroku_api_key: ${{secrets.HEROKU_API_KEY}}
          heroku_app_name: "your-app-name"
          heroku_email: "your-email@example.com"
```

---

## 🏁 Quick Start Commands

Choose your preferred platform and run these commands:

### Heroku (Fastest):
```bash
heroku create my-product-compass
heroku addons:create heroku-postgresql:mini
heroku config:set FLASK_ENV=production SECRET_KEY="your-secret-key"
git push heroku main
heroku run python -c "from app import app, db; app.app_context().push(); db.create_all()"
```

### Vercel:
```bash
npm install -g vercel
vercel --prod
```

### Railway:
1. Push to GitHub
2. Connect repository at railway.app
3. Add PostgreSQL plugin
4. Configure environment variables

**🎉 Your Product Compass app will be live and accessible worldwide!**

## 📞 Need Help?

- **Heroku Issues:** Check [Heroku Dev Center](https://devcenter.heroku.com)
- **Firebase Setup:** [Firebase Documentation](https://firebase.google.com/docs)
- **Google OAuth:** [Google OAuth Setup Guide](https://developers.google.com/identity/protocols/oauth2)

---

**💡 Pro Tip:** Start with Heroku for the easiest deployment, then migrate to other platforms as your needs grow! 