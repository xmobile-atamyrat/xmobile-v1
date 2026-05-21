/** @type {import('next').NextConfig} */

const localMediaOrigin = process.env.LOCAL_NGINX_MEDIA_ORIGIN?.replace(
  /\/$/,
  '',
);

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
  staticPageGenerationTimeout: 180,
};

if (localMediaOrigin) {
  nextConfig.rewrites = async () => [
    {
      source: '/media/:path*',
      destination: `${localMediaOrigin}/media/:path*`,
    },
  ];
}

export default nextConfig;
