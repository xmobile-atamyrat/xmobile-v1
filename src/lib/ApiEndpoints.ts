import { isNative } from './runtime';

/**
 * Gets the base URL for API calls
 * - In native mobile apps (Capacitor): Always uses production URL
 * - In web production: Uses production URL
 * - In web development: Uses localhost with configured host/port
 */
const getBaseUrl = (): string => {
  // If running in native mobile app (iOS or Android), always use production URL
  if (isNative()) {
    return 'https://xmobile.com.tm';
  }

  // For web, use existing logic
  return process.env.NODE_ENV === 'production'
    ? 'https://xmobile.com.tm'
    : `http://${process.env.NEXT_PUBLIC_HOST ?? 'localhost'}:${process.env.NEXT_PUBLIC_PORT ?? 3000}`;
};

const BASE_URL = getBaseUrl();

export default BASE_URL;
