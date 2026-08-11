import path from 'node:path';

import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    unoptimized: true,
  },
  turbopack: {
    // The app imports repo-root shared/styles/*.css; without widening the
    // Turbopack root to the monorepo root, Next >= 16.3 fails the build with
    // "FileSystemPath leaves the filesystem root".
    root: path.join(__dirname, '..', '..'),
  },
};

export default nextConfig;
