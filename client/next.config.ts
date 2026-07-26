import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A stray package-lock.json further up the tree — in the home directory, or at
  // the repo root — makes Turbopack walk up and infer the wrong project root.
  // This app's package.json and node_modules both live in this directory, so pin
  // it here.
  //
  // `import.meta.dirname` rather than `__dirname`: Next compiles this config to
  // an ES module, where `__dirname` does not exist and the failure surfaces as a
  // confusing "Failed to load next.config.ts".
  turbopack: {
    root: import.meta.dirname,
  },
};

export default nextConfig;
