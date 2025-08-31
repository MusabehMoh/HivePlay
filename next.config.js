/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['i.ytimg.com', 'img.youtube.com'],
  },
  // Allow access from local network devices (phones, tablets, etc.)
  allowedDevOrigins: [
    '192.168.1.0/24',    // Common home network range
    '192.168.0.0/24',    // Alternative home network range
    '10.0.0.0/24',       // Another common range
    '172.16.0.0/16',     // Docker/corporate networks
  ],
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
