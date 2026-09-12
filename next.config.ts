import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: process.env.MOBILE_BUILD === "1" ? ("export" as const) : process.env.DOCKER_BUILD === "1" ? ("standalone" as const) : undefined,
  images: {
    unoptimized: process.env.MOBILE_BUILD === "1",
    remotePatterns: [],
  },
};

export default nextConfig;
