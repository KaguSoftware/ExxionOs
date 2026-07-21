import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    /**
     * Client-side router cache. Keeps an already-visited route's rendered
     * output for this long, so moving between sections is instant instead of
     * re-fetching on every click.
     *
     * ⚠️ Experimental. If a Next upgrade breaks the build, this is the first
     * thing to drop — nothing depends on it for correctness, only for feel.
     */
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
  },
};

export default nextConfig;
