import path from "node:path";

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A stray package-lock.json in the home directory makes Turbopack infer the
  // wrong workspace root. Pin it so builds resolve modules from this project.
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
