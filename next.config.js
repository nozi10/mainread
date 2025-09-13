
require('dotenv').config();
const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');


/** @type {import('next').NextConfig} */
const nextConfig = {
  serverActions: {
    bodySizeLimit: '10mb',
  },
  async headers() {
    return [
      {
        // matching all API routes
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Credentials", value: "true" },
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET,DELETE,PATCH,POST,PUT" },
          { key: "Access-Control-Allow-Headers", value: "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version" },
        ]
      }
    ]
  },
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
  webpack: (config) => {
    // Aliases to handle module resolution issues in a Next.js environment
    config.resolve.alias.canvas = false;
    config.resolve.alias.encoding = false;

    // Copy the pdf.worker.min.js file to the static directory
    config.plugins.push(
        new CopyPlugin({
            patterns: [
                {
                    from: path.join(__dirname, 'node_modules/pdfjs-dist/build/pdf.worker.min.js'),
                    to: path.join(__dirname, 'public/static'),
                },
                {
                    from: path.join(__dirname, 'node_modules/pdfjs-dist/build/pdf.min.js'),
                    to: path.join(__dirname, 'public/static'),
                },
            ],
        })
    );
    
    return config;
  },
};

module.exports = nextConfig;
