// eslint-disable-next-line import/no-mutable-exports
let BASE_URL = '';

if (process.env.APP_ENV === 'production') {
  BASE_URL = 'https://xmobile.com.tm';
} else if (process.env.APP_ENV === 'staging') {
  BASE_URL = 'https://216.250.13.115:3001';
} else {
  BASE_URL = `http://${process.env.NEXT_PUBLIC_HOST ?? 'localhost'}:${process.env.NEXT_PUBLIC_PORT ?? 3000}`;
}

export default BASE_URL;
