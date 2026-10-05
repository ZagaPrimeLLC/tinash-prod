import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // Services were split into Home Care and DDD lines (Oct 2026).
      { source: "/services/ddd-services", destination: "/ddd-services", permanent: true },
      { source: "/services/community-support", destination: "/services/community-based-supports", permanent: true },

      // Old WordPress URLs (from its sitemap and menus) -> the new pages, so
      // search rankings and shared links carry over. /about, /services,
      // /careers and /contact keep their paths.
      { source: "/application", destination: "/careers", permanent: true },
      { source: "/metform-form/:path*", destination: "/careers", permanent: true },
      { source: "/care-plans", destination: "/services", permanent: true },
      { source: "/ddd-care", destination: "/ddd-services", permanent: true },
      { source: "/mmd-care", destination: "/ddd-services", permanent: true },
      { source: "/registration", destination: "/contact", permanent: true },
      { source: "/hello-world", destination: "/", permanent: true },
      { source: "/category/:path*", destination: "/", permanent: true },
      { source: "/feed", destination: "/", permanent: true },
      { source: "/comments/feed", destination: "/", permanent: true },
    ];
  },
};

export default nextConfig;
