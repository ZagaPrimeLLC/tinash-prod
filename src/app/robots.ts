import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

// The team CRM, sign-in, auth callbacks, onboarding links and APIs are closed
// to every crawler. Everything public is meant to be found.
const PRIVATE = ["/dashboard", "/login", "/auth", "/welcome", "/design-preview", "/api"];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: PRIVATE },
    sitemap: `${site.url}/sitemap.xml`,
  };
}
