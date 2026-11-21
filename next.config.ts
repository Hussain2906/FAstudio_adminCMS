import type { NextConfig } from "next";

const backendApiUrl = (
  process.env.NEXT_PUBLIC_API_URL ??
  "https://fa-studio-backend-452750258410.northamerica-northeast2.run.app/api/v1"
).replace(/\/+$/, "");

const nextConfig: NextConfig = {
  transpilePackages: ["@fs/design-system", "@fs/cms-contracts"],
  images: { remotePatterns: [{ protocol: "https", hostname: "res.cloudinary.com" }] },
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${backendApiUrl}/:path*`,
      },
    ];
  },
};

export default nextConfig;
