/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  pageExtensions: ['page.tsx', 'page.ts'],
  i18n: {
    locales: ['en', 'ru', 'tk', 'ch'],
    defaultLocale: 'tk',
    localeDetection: false,
  },
  images: {
    domains: ['https://presumably-patient-yak.ngrok-free.app'],
  },
};

export default nextConfig;
