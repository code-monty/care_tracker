import type { NextConfig } from "next";

const nextConfig: NextConfig = {
 allowedDevOrigins: ["192.168.18.10"],
 experimental: { serverActions: { bodySizeLimit: "3mb" } },
};

export default nextConfig;
