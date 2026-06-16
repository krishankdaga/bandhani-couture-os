import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep development and production artifacts separate. Running `next build`
  // while the dev server is active otherwise corrupts App Router manifests.
  distDir: process.env.NEXT_DIST_DIR || ".next-dev",
  outputFileTracingRoot: process.cwd(),
  images: { remotePatterns: [{ protocol: "https", hostname: "images.unsplash.com" }] },
  devIndicators: false,
};

export default nextConfig;
