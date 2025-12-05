import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Image domains for external images (Supabase storage, avatars, etc.)
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'elmxwvimjxcswjbrzznq.supabase.co',
        pathname: '/storage/v1/object/**',
      },
      {
        protocol: 'https',
        hostname: 'supabase.co',
        pathname: '/storage/v1/object/**',
      },
    ],
  },
  // Force dynamic rendering for auth-dependent app
  output: 'standalone',
  };

export default nextConfig;
