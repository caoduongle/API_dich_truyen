/**
 * Contract: Public Origin Resolution & Static Transformation
 * Governs the resolution of VITE_PUBLIC_URL across build-time configurations and static outputs.
 */

export interface PublicOriginResolver {
  /**
   * Resolves the canonical public origin from environment records with fallback.
   * Strips any trailing slashes to guarantee clean sub-path joins.
   */
  resolveOrigin(env: Record<string, string | undefined>, defaultFallback?: string): string;

  /**
   * Replaces origin placeholders in HTML string.
   */
  transformHtml(html: string, origin: string): string;

  /**
   * Replaces origin placeholders or hard-coded domain references in sitemap XML string.
   */
  transformSitemap(sitemapXml: string, origin: string): string;
}
