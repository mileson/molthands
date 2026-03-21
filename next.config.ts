import type { NextConfig } from "next";

const analyticsScriptSources = [
  'https://*.googletagmanager.com',
  'https://hm.baidu.com',
  'https://www.clarity.ms',
  'https://*.clarity.ms',
];

const analyticsConnectSources = [
  'https://*.googletagmanager.com',
  'https://*.google-analytics.com',
  'https://*.analytics.google.com',
  'https://*.clarity.ms',
  'https://c.bing.com',
  'https://hm.baidu.com',
];

const analyticsImageSources = [
  'https://*.supabase.co',
  'https://*.googletagmanager.com',
  'https://*.google-analytics.com',
  'https://*.analytics.google.com',
  'https://*.clarity.ms',
  'https://c.bing.com',
  'https://hm.baidu.com',
];

const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline' 'unsafe-eval' ${analyticsScriptSources.join(' ')}`,
      "style-src 'self' 'unsafe-inline'",
      `img-src 'self' data: blob: ${analyticsImageSources.join(' ')}`,
      "font-src 'self'",
      `connect-src 'self' https://*.supabase.co wss://*.supabase.co ${analyticsConnectSources.join(' ')}`,
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  },
];

const nextConfig: NextConfig = {
  serverExternalPackages: ['@prisma/client', 'prisma'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
