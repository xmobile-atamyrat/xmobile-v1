/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  pageExtensions: ['page.tsx', 'page.ts'],
  // Only enable static export when building for Capacitor/static export
  // Set NEXT_EXPORT=true environment variable to enable static export
  ...(process.env.NEXT_EXPORT === 'true' && {
    output: 'export',
    images: {
      unoptimized: true,
    },
  }),
};

export default nextConfig;
