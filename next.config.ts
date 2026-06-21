import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emit a self-contained server bundle for a small Docker runtime image.
  output: "standalone",
  // Agents may push large artifacts (APKs etc.) through Server Actions / routes.
  experimental: {
    serverActions: {
      bodySizeLimit: "2gb",
    },
  },
};

export default nextConfig;
