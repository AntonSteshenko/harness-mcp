import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Uploads accept files up to 25 MB (spec 028 FR-012); every request passes
  // through the proxy/middleware layer, which defaults to a 10 MB cap
  // independent of any route handler's own logic. Without raising this,
  // requests would be silently truncated instead of cleanly succeeding or
  // failing with FR-012's size error. 40 MB (not just 25 MB, or the 30 MB
  // spec 028 originally set) is needed because /mcp's binary-upload tools
  // (spec 029) send content base64-encoded — a 25 MB file becomes ≈35 MB of
  // base64 text plus JSON-RPC envelope overhead — and /mcp passes through
  // this same proxy layer (middleware.ts's matcher excludes only
  // _next/static, _next/image, and favicon.ico).
  experimental: {
    proxyClientMaxBodySize: "40mb",
  },
};

export default nextConfig;
