/**
 * Contract: Public Origin & Sub-Path Configuration Utilities
 * Module: src/config/publicOrigin.ts
 */

export interface PublicUrlConfig {
  origin: string;
  basePath: string;
  canonicalAppUrl: string;
}

export interface PublicOriginResolverContract {
  /**
   * Resolves, validates, and normalizes origin and base path.
   * Enforces HTTP/HTTPS protocol scheme and normalizes trailing/leading slashes.
   */
  resolvePublicOrigin(envOrigin?: string, envBase?: string): PublicUrlConfig;

  /**
   * Replaces %VITE_PUBLIC_URL% tokens with canonical application URL.
   * Replaces legacy hard-coded domain with canonical application URL.
   */
  transformSitemap(sitemapXml: string, config: PublicUrlConfig): string;

  /**
   * Transforms HTML index document:
   * - Injects canonicalAppUrl into %VITE_PUBLIC_URL% / %VITE_CANONICAL_URL%
   * - Preserves or adapts %BASE_URL% asset placeholders
   */
  transformIndexHtml(html: string, config: PublicUrlConfig): string;
}
