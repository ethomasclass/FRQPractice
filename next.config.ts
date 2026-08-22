import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * The libSQL client ships a native binding. Bundling it breaks the build on
   * Vercel; leaving it external lets the Node runtime load it normally.
   */
  serverExternalPackages: ["@libsql/client", "libsql"],
};

export default nextConfig;
