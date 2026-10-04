import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // Services were split into Home Care and DDD lines (Oct 2026).
      { source: "/services/ddd-services", destination: "/ddd-services", permanent: true },
      { source: "/services/community-support", destination: "/services/community-based-supports", permanent: true },
    ];
  },
};

export default nextConfig;
