
require('dotenv').config();

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
    ],
  },
  serverActions: {
    // Increase timeout for long-running AI operations like speech generation
    bodySizeLimit: '4.5mb',
    // Hobby tier on Vercel has a 15s timeout, Pro has much longer. 
    // Setting to 120s for robustness, but Pro tier is recommended for heavy use.
    executionTimeout: 120, 
  },
};

module.exports = nextConfig;
