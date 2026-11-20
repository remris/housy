import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Im Home-Verzeichnis liegt eine weitere package-lock.json; Wurzel explizit setzen.
  outputFileTracingRoot: process.cwd(),
};

export default nextConfig;
