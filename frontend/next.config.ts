import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Uploads accept files up to 25 MB (spec 028 FR-012); every request passes
  // through the proxy/middleware layer, which defaults to a 10 MB cap
  // independent of any route handler's own logic. Without raising this,
  // requests between ~10 MB and 25 MB would be silently truncated instead of
  // cleanly succeeding or failing with FR-012's size error.
  experimental: {
    proxyClientMaxBodySize: "30mb",
  },
};

export default nextConfig;
