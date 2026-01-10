export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
}

/**
 * Get Firebase configuration from environment variables
 * Falls back to hardcoded values if env vars are not set
 */
export function getFirebaseConfig(): FirebaseConfig {
  return {
    apiKey:
      process.env.NEXT_PUBLIC_FIREBASE_API_KEY ||
      'AIzaSyB6uDU2Mwzj-pbl1EEs2iOTvKHbznRurYI',
    authDomain:
      process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ||
      'xmobile-54bc9.firebaseapp.com',
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'xmobile-54bc9',
    storageBucket:
      process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
      'xmobile-54bc9.firebasestorage.app',
    messagingSenderId:
      process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '872118016510',
    appId:
      process.env.NEXT_PUBLIC_FIREBASE_APP_ID ||
      '1:872118016510:web:fe45e3367c39bceecf08af',
    measurementId:
      process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || 'G-0FBC3LXD1Z',
  };
}
