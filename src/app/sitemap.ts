import type { MetadataRoute } from "next";
import { services } from "@/lib/services";
import { site } from "@/lib/site";
import { getOpenJobs } from "@/lib/public-jobs";

export const dynamic = "force-dynamic";

// Last real content change for the static and service pages. Bump this when
// their copy changes (a fake "now" on every URL teaches crawlers to ignore it).
const SITE_UPDATED = new Date("2026-10-06");

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages = [
    "",
    "/services",
    "/guide-dementia-care",
    "/ddd-services",
    "/about",
    "/careers",
    "/consulting",
    "/contact",
    "/legal/privacy-policy",
    "/legal/terms",
    "/legal/hipaa-notice",
    "/legal/nondiscrimination",
    "/legal/accessibility",
  ].map((p) => ({
    url: `${site.url}${p}`,
    lastModified: SITE_UPDATED,
    changeFrequency: p.startsWith("/legal/") ? ("yearly" as const) : ("monthly" as const),
    priority: p === "" ? 1 : p.startsWith("/legal/") ? 0.3 : 0.7,
  }));

  const servicePages = services.map((s) => ({
    url: `${site.url}/services/${s.slug}`,
    lastModified: SITE_UPDATED,
    changeFrequency: "monthly" as const,
    priority: 0.8,
  }));

  const jobPages = (await getOpenJobs()).map((j) => ({
    url: `${site.url}/careers/${j.slug}`,
    lastModified: new Date(j.updated_at),
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  return [...staticPages, ...servicePages, ...jobPages];
}
