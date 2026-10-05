import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import staticAssetsIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache";

// Free-plan tuning (Cloudflare Workers Free: 3 MiB gzip bundle, tight CPU):
// - Pre-rendered pages are served straight from Workers static assets, and
//   cache interception answers them before Next.js loads, so they cost almost
//   no CPU. This cache is read-only: pages that must change between deploys
//   (careers, sitemap) are force-dynamic instead of using `revalidate`.
// - Webpack produces a much smaller server bundle than Turbopack.
const config = defineCloudflareConfig({
  incrementalCache: staticAssetsIncrementalCache,
  enableCacheInterception: true,
});

export default { ...config, buildCommand: "npx next build --webpack" };
