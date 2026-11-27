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

// OAuth discovery for the MCP server (/api/mcp). Clients look for these at
// the site root, so they are rewritten to API routes, which 404 while
// MCP_ENABLED is off. No `locale: false`: with i18n on, Next matches rewrites
// against the path with its locale added, so such a source never matched.
const mcpRewrites = [
  {
    source: '/.well-known/oauth-protected-resource',
    destination: '/api/mcp/well-known/protected-resource',
  },
  {
    source: '/.well-known/oauth-protected-resource/api/mcp',
    destination: '/api/mcp/well-known/protected-resource',
  },
  {
    source: '/.well-known/oauth-authorization-server',
    destination: '/api/mcp/well-known/authorization-server',
  },
];

let mediaRewrites = [];
if (localMediaOrigin) {
  mediaRewrites = [
    {
      source: '/media/:path*',
      destination: `${localMediaOrigin}/media/:path*`,
    },
  ];
} else if (process.env.NODE_ENV === 'development') {
  // Local dev without a Docker nginx: serve uploaded media (e.g. banners) from
  // disk via the /api/media fallback route. Dev-only — production serves /media
  // through its own web server, so this rewrite is never added there.
  mediaRewrites = [
    {
      source: '/media/:path*',
      destination: '/api/media/:path*',
    },
  ];
}

nextConfig.rewrites = async () => [...mcpRewrites, ...mediaRewrites];

// The MCP consent page and the sign-in page that leads to it never load in a
// frame, so neither can be clickjacked into an approval. Set here as well as
// by the consent page itself, so they hold however the page is reached.
const noFraming = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
];
nextConfig.headers = async () => [
  { source: '/oauth/:path*', headers: noFraming },
  { source: '/user/signin', headers: noFraming },
];

export default nextConfig;
