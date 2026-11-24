import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";
// local `next start` over http (LOCAL_PREVIEW=1) must not force https upgrades
const httpsOnly = isProd && process.env.LOCAL_PREVIEW !== "1";
const media = process.env.MEDIA_PUBLIC_URL ? new URL(process.env.MEDIA_PUBLIC_URL) : null;

/**
 * Content-Security-Policy.
 * script-src keeps 'unsafe-inline' because the App Router streams inline RSC
 * payload scripts and the root layout ships a small inline navigation script;
 * nonce-based CSP would force every page to render dynamically (no static/ISR
 * catalogue pages). Everything else is locked down: no third-party script
 * origins, no plugins, no framing, same-origin forms/connections only.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob:${media ? ` ${media.origin}` : ""}`,
  "font-src 'self'",
  `media-src 'self'${media ? ` ${media.origin}` : ""}`,
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(httpsOnly ? ["upgrade-insecure-requests"] : []),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ...(httpsOnly ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }] : []),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Native / WASM modules stay external to the server bundle.
  serverExternalPackages: ["@electric-sql/pglite", "@node-rs/argon2", "sharp", "pg"],
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: media ? [{ protocol: media.protocol.replace(":", "") as "https" | "http", hostname: media.hostname, pathname: "/**" }] : [],
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // uploaded media is immutable (content-addressed file names)
      { source: "/uploads/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }] },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
