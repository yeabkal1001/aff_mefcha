import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // A stray package-lock.json in the home directory makes Turbopack infer the
  // wrong root. Pin it to the pnpm workspace root, which is where the shared
  // node_modules store these symlinks resolve into actually lives.
  turbopack: {
    root: path.join(__dirname, ".."),
  },
};

export default nextConfig;
