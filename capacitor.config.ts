import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'tm.com.xmobile',
  appName: 'Xmobile',
  webDir: 'out',
  server: {
    url: 'https://xmobile.com.tm',
    cleartext: true,
  },
};

export default config;
