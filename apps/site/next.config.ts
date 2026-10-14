import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  devIndicators: false,
  experimental: {
    // Photo uploads (gallery, menu, partners) go through server actions; files are capped at 8 MB in lib/storage.ts.
    serverActions: { bodySizeLimit: '10mb' },
  },
  images: {
    // Square catalog photos and Vercel Blob uploads.
    remotePatterns: [
      { protocol: 'https', hostname: '*.squarecdn.com' },
      { protocol: 'https', hostname: 'items-images-production.s3.us-west-2.amazonaws.com' },
      { protocol: 'https', hostname: 'items-images-sandbox.s3.us-west-2.amazonaws.com' },
      { protocol: 'https', hostname: '*.public.blob.vercel-storage.com' },
    ],
  },
};

export default nextConfig;
