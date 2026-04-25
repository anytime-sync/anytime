/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    typedRoutes: false,
  },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
  // Lint locally; skip during Vercel build for now.
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
