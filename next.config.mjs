/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    typedRoutes: false,
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "firstlight.to" },
      { protocol: "https", hostname: "*.firstlight.to" },
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "*.higgsfield.ai" },
      { protocol: "https", hostname: "*.vercel.app" },
    ],
  },
  // Lint locally; skip during Vercel build for now.
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
