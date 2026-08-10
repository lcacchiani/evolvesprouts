import path from 'node:path';

import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // The repo root, so Turbopack can resolve ../../shared/styles imports
  // that live outside apps/training.
  turbopack: {
    root: path.join(__dirname, '..', '..'),
  },
  output: 'export',
  trailingSlash: true,
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
