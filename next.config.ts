import type { NextConfig } from "next";
import withPWAInit from "next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
  // Exclude auth-related pages from caching to prevent session conflicts
  runtimeCaching: [
    {
      // CRITICAL: Don't cache Supabase API calls
      urlPattern: /^https:\/\/.*\.supabase\.co\/.*/,
      handler: "NetworkOnly" as const,
    },
    {
      // Don't cache auth pages - always fetch from network
      urlPattern: /^\/(login|dashboard|promoter)(\/.*)?$/,
      handler: "NetworkOnly" as const,
    },
    {
      // Don't cache API routes
      urlPattern: /^\/api\/.*/,
      handler: "NetworkOnly" as const,
    },
    {
      // Cache static assets only
      urlPattern: /\.(?:js|css|woff|woff2|png|jpg|jpeg|svg|gif|ico)$/,
      handler: "StaleWhileRevalidate" as const,
      options: {
        cacheName: "static-assets",
        expiration: {
          maxEntries: 100,
          maxAgeSeconds: 60 * 60 * 24, // 24 hours
        },
      },
    },
  ],
} as any);

const nextConfig: NextConfig = {
  // Use webpack explicitly (required for next-pwa)
  turbopack: {},
  
  // Security headers
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          {
            key: "Referrer-Policy",
            value: "origin-when-cross-origin",
          },
        ],
      },
    ];
  },
  // Image optimization
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
    ],
  },
  // Production optimizations
  poweredByHeader: false,
  reactStrictMode: true,
  compiler: {
    removeConsole: process.env.NODE_ENV === "production",
  },
};

export default withPWA(nextConfig);
