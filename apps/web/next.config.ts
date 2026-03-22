import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NextConfig } from "next";

const currentDir = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(currentDir, '../..'),
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'api.dicebear.com',
      },
    ],
  },
  // Use Turbopack (default in Next.js 16)
  turbopack: {
    // Configure externals for native modules
    resolveAlias: {
      'utf-8-validate': 'commonjs utf-8-validate',
      'bufferutil': 'commonjs bufferutil',
      'fflate': 'commonjs fflate',
      'jspdf': 'jspdf/dist/jspdf.umd.min.js',
    },
  },
};

export default nextConfig;
