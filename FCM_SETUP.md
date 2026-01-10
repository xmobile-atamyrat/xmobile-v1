# FCM (Firebase Cloud Messaging) Setup Guide

## Required Environment Variables

Add these environment variables to your `.env.local` file (for development) or your production environment:

## How to Get Firebase Credentials

### 1. Firebase Web App Config

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Go to **Project Settings** (gear icon)
4. Scroll down to **Your apps** section
5. Find your web app or create a new one
6. Copy the config values from the `firebaseConfig` object

### 2. VAPID Key (Most Important!)

The VAPID key is required for web push notifications. To get it:

1. Go to Firebase Console → Your Project
2. Go to **Project Settings** → **Cloud Messaging** tab
3. Scroll down to **Web configuration** section
4. Under **Web Push certificates**, you'll see:
   - **Key pair**: This is your VAPID key
   - If you don't have one, click **Generate key pair**
5. Copy the key and set it as `NEXT_PUBLIC_FIREBASE_VAPID_KEY`

**Note**: The VAPID key is critical - without it, FCM tokens cannot be generated for web browsers.

### 3. Firebase Admin SDK Credentials

The Admin SDK credentials file should already exist at:

```
fcm/xmobile-54bc9-firebase-adminsdk-fbsvc-d665c5ae1a.json
```

If you need to regenerate it:

1. Go to Firebase Console → Project Settings
2. Go to **Service accounts** tab
3. Click **Generate new private key**
4. Download the JSON file
5. Place it in the `fcm/` directory
6. Update `FIREBASE_ADMIN_SDK_PATH` if using a different path

## Current Default Values

The code includes default/hardcoded values that match your existing Firebase project. These will be used if environment variables are not set, but it's recommended to use environment variables for better security and flexibility.

## Testing FCM

1. Make sure all environment variables are set
2. Run the app: `yarn dev`
3. Log in to the application
4. Grant notification permission when prompted
5. Check browser console for FCM token registration messages
6. Check server logs to verify token is registered in database

## Troubleshooting

### "VAPID key not found" error

- Make sure `NEXT_PUBLIC_FIREBASE_VAPID_KEY` is set in your environment
- Verify the key is correct in Firebase Console

### "Service worker not registered" error

- Make sure service worker registration is working
- Check browser console for service worker errors
- Verify `/sw.js` is accessible

### "Firebase Admin SDK initialization failed"

- Check that `FIREBASE_ADMIN_SDK_PATH` points to the correct file
- Verify the JSON file exists and is valid
- Check file permissions

### Notifications not working

- Verify notification permission is granted
- Check browser console for errors
- Verify FCM token is registered in database
- Check server logs for FCM send errors
