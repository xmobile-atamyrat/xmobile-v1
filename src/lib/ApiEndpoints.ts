const BASE_URL =
  process.env.NODE_ENV === 'production'
    ? 'https://xmobile.com.tm'
    : 'http://localhost:3000';

export default BASE_URL;
