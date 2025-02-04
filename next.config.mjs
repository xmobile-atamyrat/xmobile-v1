import os from 'os';
import qrcode from 'qrcode-terminal';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  pageExtensions: ['page.tsx', 'page.ts'],
  i18n: {
    locales: ['en', 'ru', 'tk', 'ch', 'tr'],
    defaultLocale: 'ru',
    localeDetection: false,
  },
  env: {
    NEXT_PUBLIC_HOST: process.env.NODE_ENV !== 'production' && getLocalIpAddress(),
  },
};

function getLocalIpAddress() {
  const networkInterfaces = os.networkInterfaces();
  
  for (const interfaceName in networkInterfaces) {
    const interfaces = networkInterfaces[interfaceName];
    for (const iface of interfaces) {
      if (iface.family === 'IPv4' && !iface.internal) {
        const localUrl = `http://${iface.address}:3003`;
        console.log('Local server: ', localUrl);
        qrcode.generate(localUrl, { small: true });

        return iface.address;
      }
    }
  }
  return 'localhost';
}

export default nextConfig;
