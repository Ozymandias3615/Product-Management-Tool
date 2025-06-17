# Deployment Guide

## Security Checklist Before Pushing to GitHub

### ✅ Files Already Protected
- `firebase-credentials.json` - Already in `.gitignore`
- Database files - Now excluded in `.gitignore`
- Environment variables - `.env` files excluded

### 🔧 Environment Variables Setup

Create a `.env` file in your project root (this will be ignored by git):

```bash
# Flask Configuration
SECRET_KEY=your-super-secret-key-here
FLASK_ENV=development

# Firebase Configuration
FIREBASE_API_KEY=your-firebase-api-key
FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_STORAGE_BUCKET=your-project.appspot.com
FIREBASE_MESSAGING_SENDER_ID=123456789
FIREBASE_APP_ID=1:123456789:web:abcdef
FIREBASE_MEASUREMENT_ID=G-ABCDEFGHIJ
```

### 🚀 Production Deployment

For production deployment, set these environment variables:

```bash
FLASK_ENV=production
SECRET_KEY=your-production-secret-key
PORT=5000
```

The app will automatically:
- Disable debug mode
- Bind to `0.0.0.0` instead of localhost
- Use the PORT environment variable

### 🛡️ Security Features Implemented

1. **Debug Mode Control**: Automatically disabled in production
2. **Secret Key Protection**: Uses environment variables
3. **Firebase Credentials**: Excluded from version control
4. **Database Protection**: Instance folder excluded from git

### 📋 Deployment Platforms

#### Heroku
```bash
heroku config:set SECRET_KEY=your-secret-key
heroku config:set FLASK_ENV=production
heroku config:set FIREBASE_API_KEY=your-key
# ... set other Firebase variables
```

#### Railway/Render
Set environment variables in the platform's dashboard.

#### Docker
Create a `docker-compose.yml` with environment variables or use `.env` file mounting.

### ⚠️ Important Notes

- Never commit the actual `.env` file
- Always use strong, unique secret keys in production
- Consider using a secrets management service for production
- The Firebase credentials file should be uploaded directly to your production environment, not through git 