/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  pageExtensions: ['page.tsx', 'page.ts'],
  i18n: {
    locales: ['en', 'ru', 'tk', 'ch'],
    defaultLocale: 'tk',
    localeDetection: false,
  },
};

export default nextConfig;
