import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone is for the Dockerfile only. Vercel traces serverless functions
  // itself; enabling both on Next 16 + Turbopack leaves Vercel looking for a
  // missing .next/next-server.js.nft.json during onBuildComplete.
  ...(process.env.DOCKER_BUILD === "1" ? { output: "standalone" as const } : {}),
};

export default nextConfig;
