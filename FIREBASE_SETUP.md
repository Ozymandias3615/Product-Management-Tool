# Firebase Setup Guide

## Current Status
✅ **Firebase Admin SDK**: Working (server-side authentication)  
❌ **Firebase Web SDK**: Missing configuration (client-side authentication)

## Problem
Your Firebase Admin SDK is initialized correctly, but the web authentication features are disabled because the Firebase Web SDK configuration environment variables are not set.

## Solution

### Step 1: Get Firebase Web App Configuration

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project: `product-roadmap-planner`
3. Click the gear icon ⚙️ > **Project settings**
4. Scroll down to **Your apps** section
5. If you don't have a web app, click **Add app** > **Web** and register your app
6. If you have a web app, click on it to see the config
7. Copy the configuration object that looks like this:

```javascript
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "product-roadmap-planner.firebaseapp.com",
  projectId: "product-roadmap-planner",
  storageBucket: "product-roadmap-planner.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123",
  measurementId: "G-XXXXXXXXXX"
};
```

### Step 2: Set Environment Variables

Create a `.env` file in your project root with these values:

```bash
# Firebase Web SDK Configuration (replace with your actual values)
FIREBASE_API_KEY=AIza...
FIREBASE_AUTH_DOMAIN=product-roadmap-planner.firebaseapp.com
FIREBASE_PROJECT_ID=product-roadmap-planner
FIREBASE_STORAGE_BUCKET=product-roadmap-planner.appspot.com
FIREBASE_MESSAGING_SENDER_ID=123456789
FIREBASE_APP_ID=1:123456789:web:abc123
FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX

# Other configuration
SECRET_KEY=your-secret-key-here
DATABASE_URL=sqlite:///instance/roadmap.db
```

### Step 3: Restart Your Application

After setting the environment variables:

```bash
# Stop the current server (Ctrl+C)
# Then restart:
python app.py
```

### Step 4: Verify Configuration

Visit `http://localhost:5000/api/debug/firebase` to verify all configuration is now working.

## Alternative: Quick Setup for Testing

If you want to test without full Firebase setup, you can temporarily disable Firebase authentication by setting:

```bash
DISABLE_FIREBASE=true
```

But this will disable Google Sign-In features.

## Authentication Methods Available

Once Firebase is properly configured, users will be able to:
- ✅ Email/Password authentication (working)
- ✅ Google Sign-In (will work after Firebase Web SDK setup)
- ✅ Team invitations (working)
- ✅ All collaboration features (comments, mentions, notifications)

## Need Help?

1. Check the Firebase Console for your project configuration
2. Ensure Authentication is enabled in Firebase Console > Authentication > Sign-in method
3. Add your domain (localhost:5000) to authorized domains in Firebase Console
4. Verify the debug endpoint: `http://localhost:5000/api/debug/firebase` 