import type { NextConfig } from 'next';
import type { Configuration } from 'webpack';

const nextConfig: NextConfig = {
  images: {
    domains: ['i.ytimg.com', 'img.youtube.com'],
  },
  // Moved from experimental to root level as per Next.js 15.3.1 requirements
  serverExternalPackages: ['redis'],
  experimental: {
    // serverComponentsExternalPackages has been moved to root level
  },
  webpack: (config: Configuration, { isServer }: { isServer: boolean }) => {
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
};

export default nextConfig;
