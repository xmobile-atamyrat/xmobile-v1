/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  pageExtensions: ['page.tsx', 'page.ts'],
  i18n: {
    locales: ['en', 'ru', 'tk', 'ch', 'tr'],
    defaultLocale: 'ru',
    localeDetection: false,
  },
};

export default nextConfig;
