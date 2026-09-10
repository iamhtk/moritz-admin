import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone is for the Dockerfile only. Vercel's builder fails when this
  // is always on (missing next-server.js.nft.json during onBuildComplete).
  ...(process.env.DOCKER_BUILD === "1" ? { output: "standalone" as const } : {}),
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          // CSP is intentionally omitted: a tight policy needs a dedicated
          // pass for Next inline scripts, fonts, and Supabase realtime.
        ],
      },
    ];
  },
};

export default nextConfig;
