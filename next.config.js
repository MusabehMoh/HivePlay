/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['i.ytimg.com', 'img.youtube.com'],
  },
  // Moved from experimental to root level as per Next.js 15.3.1 requirements
  serverExternalPackages: ['redis', 'cheerio', 'yt-search'],
  experimental: {
    // serverComponentsExternalPackages has been moved to root level
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Don't resolve 'redis', 'net', and 'tls' on the client to avoid errors
      config.resolve = config.resolve || {};
      config.resolve.fallback = {
        redis: false,
        net: false,
        tls: false,
      };
    }
    return config;
  },
  // Disable type checking during build
  typescript: {
    ignoreBuildErrors: true,
  },
  // Disable ESLint during build
  eslint: {
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;
