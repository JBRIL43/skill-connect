import path from "node:path";

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A stray package-lock.json in the home directory makes Turbopack infer the
  // wrong workspace root. Pin it so builds resolve modules from this project.
  turbopack: {
    root: path.resolve(__dirname),
  },
  // `next build` and `next dev` both write to .next, and running one while the
  // other is up corrupts it. Setting NEXT_DIST_DIR lets a build run beside the
  // dev server instead of taking it down first.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
