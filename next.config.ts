import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Disable built-in image optimisation to avoid requiring the `sharp`
  // native binary, which fails to compile on Railway without extra build
  // tooling.  Images are served as-is; resize in the browser via CSS.
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
