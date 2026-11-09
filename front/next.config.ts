import type { NextConfig } from 'next';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const user = process.env.USER_SERVICE_URL ?? 'http://localhost:3001';
const projects = process.env.PROJECT_MANAGER_URL ?? 'http://localhost:3002';
const generation = process.env.AI_GENERATION_URL ?? 'http://localhost:3003';

const nextConfig: NextConfig = {
  turbopack: { root: dirname(fileURLToPath(import.meta.url)) },
  // `npm run typecheck` is the authoritative type check; avoids Next's
  // --showConfig parser incompatibility in the current monorepo toolchain.
  typescript: { ignoreBuildErrors: true },
  async rewrites() {
    return [
      { source: '/backend/auth/:path*', destination: `${user}/api/auth/:path*` },
      { source: '/backend/projects/:path*', destination: `${projects}/api/projects/:path*` },
      { source: '/backend/generations/:path*', destination: `${generation}/api/generations/:path*` },
    ];
  },
};

export default nextConfig;
