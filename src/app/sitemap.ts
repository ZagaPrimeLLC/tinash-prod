import type { MetadataRoute } from "next";
import { services } from "@/lib/services";
import { site } from "@/lib/site";
import { getOpenJobs } from "@/lib/public-jobs";

export const dynamic = "force-dynamic";

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
    lastModified: new Date(),
    changeFrequency: "monthly" as const,
    priority: p === "" ? 1 : 0.7,
  }));

  const servicePages = services.map((s) => ({
    url: `${site.url}/services/${s.slug}`,
    lastModified: new Date(),
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
