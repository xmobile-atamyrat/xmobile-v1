const BASE_URL =
  process.env.NEXT_PUBLIC_NGROK ||
  `http://${process.env.NEXT_PUBLIC_HOST || 'localhost'}:${process.env.NEXT_PUBLIC_PORT || '3000'}`;

export default BASE_URL;
