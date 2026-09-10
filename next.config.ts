import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Required by Dockerfile's standalone copy; harmless on Vercel.
  output: "standalone",
};

export default nextConfig;
