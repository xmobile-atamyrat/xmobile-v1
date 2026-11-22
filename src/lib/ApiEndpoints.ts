// eslint-disable-next-line import/no-mutable-exports
let BASE_URL = '';
// Keyed on the app env rather than NODE_ENV: staging also runs a production
// build, and would otherwise open its chat socket on production.
// eslint-disable-next-line import/no-mutable-exports
let WS_BASE_URL: string | undefined;

if (process.env.NEXT_PUBLIC_APP_ENV === 'production') {
  BASE_URL = 'https://xmobile.com.tm';
  WS_BASE_URL = 'wss://xmobile.com.tm';
} else if (process.env.NEXT_PUBLIC_APP_ENV === 'staging') {
  BASE_URL = 'https://dev.xmobile.com.tm';
  WS_BASE_URL = 'wss://dev.xmobile.com.tm';
} else {
  BASE_URL = `http://${process.env.NEXT_PUBLIC_HOST ?? 'localhost'}:${process.env.NEXT_PUBLIC_PORT ?? 3000}`;
  WS_BASE_URL = process.env.NEXT_PUBLIC_WS_URL;
}

export { WS_BASE_URL };

export default BASE_URL;
