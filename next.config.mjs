/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  swcMinify: true, // Force minification
  compress: true, // Enable gzip/brotli compression
  pageExtensions: ['page.tsx', 'page.ts'],
  i18n: {
    locales: ['en', 'ru', 'tk', 'ch', 'tr'],
    defaultLocale: 'ru',
    localeDetection: false,
  },
  experimental: {
    workerThreads: false,
    cpus: 2,
  },
  staticPageGenerationTimeout: 180
};

export default nextConfig;
