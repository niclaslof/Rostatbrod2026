import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // This app lives in a subfolder of the johan35 repo; pin the workspace root
  // so Next doesn't pick the parent lockfile.
  turbopack: { root: __dirname },
  images: {
    formats: ["image/webp"],
    deviceSizes: [420, 640, 768, 1024, 1280],
    imageSizes: [200, 300, 400],
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com" },
      { protocol: "https", hostname: "*.blob.vercel-storage.com" },
      { protocol: "https", hostname: "image.mux.com" },
    ],
  },
};

export default nextConfig;
