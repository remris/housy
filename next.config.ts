import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Im Home-Verzeichnis liegt eine weitere package-lock.json; Wurzel explizit setzen.
  outputFileTracingRoot: process.cwd(),
  // Schriften für die PDF-Erzeugung (Verträge, Nachweise, Arbeitszeitlisten)
  outputFileTracingIncludes: { "/**": ["./src/lib/pdf/schriften/*.ttf"] },
  experimental: {
    // Logo- und Foto-Uploads über Server Actions
    serverActions: { bodySizeLimit: "5mb" },
  },
};

export default nextConfig;
