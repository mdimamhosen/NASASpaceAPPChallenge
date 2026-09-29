import type { NextConfig } from 'next';

const nextConfig: NextConfig = { transpilePackages: ['@mars-explorer/shared'], distDir: process.env.MARS_NEXT_DIST_DIR || '.next' };
export default nextConfig;
