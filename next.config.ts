import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Im Home-Verzeichnis liegt eine weitere package-lock.json; Wurzel explizit setzen.
  outputFileTracingRoot: process.cwd(),
  experimental: {
    // Logo- und Foto-Uploads über Server Actions
    serverActions: { bodySizeLimit: "5mb" },
  },
};

export default nextConfig;
