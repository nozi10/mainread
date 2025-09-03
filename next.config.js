
require('dotenv').config();
const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');


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
            ],
        })
    );
    
    return config;
  },
};

module.exports = nextConfig;
