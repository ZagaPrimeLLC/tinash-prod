import type { Metadata } from "next";
import { site } from "@/lib/site";

// Per-page SEO metadata. Next merges metadata shallowly, so a page that sets
// `openGraph` replaces the root layout's whole object: shared OG fields live
// here and every page gets its own canonical + og:url (relative paths resolve
// against metadataBase in the root layout).
export const ogDefaults = {
  siteName: site.name,
  images: [{ url: "/media/hero-poster.webp", width: 1920, height: 1080 }],
  locale: "en_US",
  type: "website" as const,
};

// JSON-LD node ids, so pages can point at the business defined in the root layout.
export const ldIds = {
  organization: `${site.url}/#organization`,
  website: `${site.url}/#website`,
  business: `${site.url}/#business`,
};

type PageMeta = Omit<Metadata, "title" | "description"> & {
  title: string | { absolute: string };
  description: string;
};

export function pageMetadata(path: string, { title, description, ...rest }: PageMeta): Metadata {
  const ogTitle = typeof title === "string" ? `${title} — ${site.name}` : title.absolute;
  return {
    title,
    description,
    ...rest,
    alternates: { canonical: path },
    openGraph: { ...ogDefaults, title: ogTitle, description, url: path },
  };
}

/** BreadcrumbList JSON-LD from [name, path] pairs (Home is added first). */
export function breadcrumbLd(trail: [string, string][]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [["Home", "/"] as [string, string], ...trail].map(([name, path], i) => ({
      "@type": "ListItem",
      position: i + 1,
      name,
      item: `${site.url}${path === "/" ? "" : path}`,
    })),
  };
}

/** JSON.stringify for <script type="application/ld+json">, with "<" escaped. */
export const ldJson = (data: unknown) => JSON.stringify(data).replace(/</g, "\\u003c");
