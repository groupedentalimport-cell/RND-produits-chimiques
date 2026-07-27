import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  async rewrites() {
    return {
      beforeFiles: [
        // Forward socket.io polling requests to the notifications mini-service
        // when the client accesses the dev server directly on port 3000 (no
        // Caddy gateway). The gateway already handles this on port 81, but
        // this rewrite makes the realtime connection work in pure-dev too.
        {
          source: "/",
          has: [{ type: "query", key: "XTransformPort", value: "3003" }],
          destination: "http://localhost:3003/",
        },
      ],
    };
  },
};

export default nextConfig;
