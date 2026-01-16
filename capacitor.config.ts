import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'tm.com.xmobile.app',
  appName: 'Xmobile',
  webDir: '.next',
  // Use server URL approach: WebView loads from production server
  // This allows SSR/ISR to work in mobile app without static export
  // Development: Set server.url to localhost for testing
  // Production: WebView loads from https://xmobile.com.tm
  server:
    process.env.NODE_ENV === 'development'
      ? {
          url: 'http://localhost:3003',
          cleartext: true, // Allow HTTP in development
        }
      : {
          url: 'https://xmobile.com.tm',
          cleartext: false, // HTTPS in production
        },
};

export default config;
