import type { NextConfig } from "next";

// Old URL -> new URL. Each one also matches its trailing-slash form (WordPress
// links always ended in "/"), so every old link lands in a single 308 hop.
const legacyRedirects: [source: string, destination: string][] = [
  // Services were split into Home Care and DDD lines (Oct 2026).
  ["/services/ddd-services", "/ddd-services"],
  ["/services/community-support", "/services/community-based-supports"],

  // Old WordPress URLs (from its sitemap and menus) -> the new pages, so
  // search rankings and shared links carry over. /about, /services,
  // /careers and /contact keep their paths.
  ["/application", "/careers"],
  ["/metform-form/:path*", "/careers"],
  ["/care-plans", "/services"],
  ["/ddd-care", "/ddd-services"],
  ["/mmd-care", "/ddd-services"],
  ["/registration", "/contact"],
  ["/hello-world", "/"],
  ["/author/:path*", "/about"],
  ["/category/:path*", "/"],
  ["/feed", "/"],
  ["/comments/feed", "/"],
];

// WordPress / SEO-plugin sitemap URLs that crawlers still request.
const legacySitemaps = ["/sitemap.rss", "/wp-sitemap.xml", "/sitemap_index.xml"];

const nextConfig: NextConfig = {
  // Next's own trailing-slash redirect runs before the redirects below, which
  // made "/ddd-care/" take two hops. src/proxy.ts strips trailing slashes
  // instead (after these redirects), so old URLs resolve in one.
  skipTrailingSlashRedirect: true,

  async redirects() {
    return [
      ...legacyRedirects.flatMap(([source, destination]) =>
        [source, `${source}/`].map((s) => ({ source: s, destination, permanent: true })),
      ),
      ...legacySitemaps.map((source) => ({ source, destination: "/sitemap.xml", permanent: true })),
    ];
  },
};

export default nextConfig;
