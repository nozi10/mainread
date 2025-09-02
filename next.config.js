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
  webpack: (config, { isServer }) => {
    // This is to fix a build issue with the get-audio-duration library.
    // It attempts to import a README.md file, which webpack can't handle.
    config.module.rules.push({
      test: /README\.md$/,
      use: 'raw-loader',
    });
    return config;
  },
};

module.exports = nextConfig;
