import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { NextConfig } from 'next';

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const nextConfig: NextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  turbopack: {
    root: workspaceRoot,
  },
  transpilePackages: [
    '@megaconvert/client-sdk',
    '@megaconvert/config',
    '@megaconvert/contracts',
    '@megaconvert/design-system',
  ],
  typescript: {
    ignoreBuildErrors: false,
  },
};

export default nextConfig;
