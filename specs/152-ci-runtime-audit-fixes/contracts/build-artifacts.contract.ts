/**
 * Contract: Build Artifact Verification
 *
 * Build integration tests MUST unconditionally assert the existence and
 * correctness of production build artifacts. Conditional guards
 * (if existsSync → check, else → skip) are prohibited.
 *
 * Required assertions after `npm run build`:
 *
 * 1. dist/index.html MUST exist
 * 2. dist/sitemap.xml MUST exist
 * 3. dist/index.html MUST NOT contain unreplaced placeholder tokens
 *    (%VITE_PUBLIC_URL%, %VITE_CANONICAL_URL%)
 * 4. dist/sitemap.xml MUST NOT contain unreplaced placeholder tokens
 * 5. dist/sitemap.xml MUST contain resolved <loc>http... entries
 *
 * Vite base configuration:
 *
 * 6. vite.config.ts `base:` MUST use the normalized basePath from
 *    publicOrigin.ts (publicConfig.basePath), not the raw env var.
 */

export interface BuildArtifactContract {
  /** dist/index.html must exist and contain no placeholders */
  indexHtml: {
    exists: true;
    noPlaceholders: true;
    containsCanonicalUrl: true;
  };

  /** dist/sitemap.xml must exist and contain resolved URLs */
  sitemapXml: {
    exists: true;
    noPlaceholders: true;
    containsResolvedLocs: true;
  };

  /** Vite base config uses normalized path */
  viteBase: {
    usesNormalizedBasePath: true;
  };
}
