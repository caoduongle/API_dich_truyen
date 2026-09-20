/**
 * Public Origin & Sub-Path Configuration Utilities
 * Authoritative module for URL resolution, validation, and build/dev transformations.
 */

export const DEFAULT_PUBLIC_URL = 'https://api-dich-truyen.onrender.com';
export const DEFAULT_BASE_PATH = '/';

export interface PublicUrlConfig {
  origin: string;
  basePath: string;
  canonicalAppUrl: string;
}

/**
 * Validates that an origin string begins with http:// or https:// and has a valid web origin structure.
 */
export function isValidWebProtocol(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  try {
    const parsed = new URL(url.trim());
    return (parsed.protocol === 'http:' || parsed.protocol === 'https:') && Boolean(parsed.hostname);
  } catch {
    return false;
  }
}

/**
 * Normalizes the public origin:
 * - Trims whitespace
 * - Enforces http:// or https:// scheme via URL parsing (falls back to DEFAULT_PUBLIC_URL if invalid)
 * - Returns only protocol + host + port (origin), discarding paths, queries, or trailing slashes
 */
export function normalizeOrigin(originInput?: string | null): string {
  if (!originInput || typeof originInput !== 'string') {
    return DEFAULT_PUBLIC_URL;
  }
  const trimmed = originInput.trim();
  if (!trimmed) {
    return DEFAULT_PUBLIC_URL;
  }
  try {
    const parsed = new URL(trimmed);
    if ((parsed.protocol !== 'http:' && parsed.protocol !== 'https:') || !parsed.hostname) {
      return DEFAULT_PUBLIC_URL;
    }
    return parsed.origin && parsed.origin !== 'null' ? parsed.origin : `${parsed.protocol}//${parsed.host}`;
  } catch {
    return DEFAULT_PUBLIC_URL;
  }
}

/**
 * Normalizes the base path:
 * - Trims whitespace
 * - Guarantees leading slash '/'
 * - Guarantees trailing slash '/'
 * - Defaults to '/' if empty or '/'
 */
export function normalizeBasePath(baseInput?: string | null): string {
  if (!baseInput || typeof baseInput !== 'string') {
    return DEFAULT_BASE_PATH;
  }
  const trimmed = baseInput.trim();
  if (!trimmed || trimmed === '/') {
    return DEFAULT_BASE_PATH;
  }
  let path = trimmed;
  if (!path.startsWith('/')) {
    path = '/' + path;
  }
  if (!path.endsWith('/')) {
    path = path + '/';
  }
  return path;
}

/**
 * Resolves the unified PublicUrlConfig from environment variables.
 * Calculates canonicalAppUrl = origin + basePath.
 */
export function resolvePublicOrigin(envOrigin?: string | null, envBase?: string | null): PublicUrlConfig {
  const origin = normalizeOrigin(envOrigin);
  const basePath = normalizeBasePath(envBase);
  const canonicalAppUrl = origin + (basePath === '/' ? '/' : basePath);
  return {
    origin,
    basePath,
    canonicalAppUrl,
  };
}

/**
 * Transforms sitemap.xml to use canonical application URLs.
 * Handles sub-path deployments by joining canonicalAppUrl with each route.
 */
export function transformSitemap(sitemapXml: string, config: PublicUrlConfig): string {
  const baseWithoutSlash = config.canonicalAppUrl.replace(/\/+$/, '');
  return sitemapXml
    .replaceAll('%VITE_PUBLIC_URL%/', config.canonicalAppUrl)
    .replaceAll('%VITE_PUBLIC_URL%', baseWithoutSlash)
    .replaceAll('https://api-dich-truyen.onrender.com/', config.canonicalAppUrl)
    .replaceAll('https://api-dich-truyen.onrender.com', baseWithoutSlash);
}

/**
 * Transforms HTML index document:
 * - Replaces %VITE_CANONICAL_URL% and %VITE_PUBLIC_URL% with canonicalAppUrl
 * - Converts /og-image.svg to absolute canonical URL for social card crawlers
 * - Rewrites root-relative static asset paths to sub-path if basePath !== '/'
 */
export function transformIndexHtml(html: string, config: PublicUrlConfig): string {
  const baseWithoutSlash = config.canonicalAppUrl.replace(/\/+$/, '');
  let transformed = html
    .replaceAll('%VITE_CANONICAL_URL%', config.canonicalAppUrl)
    .replaceAll('%VITE_PUBLIC_URL%/', config.canonicalAppUrl)
    .replaceAll('%VITE_PUBLIC_URL%', baseWithoutSlash)
    .replaceAll('https://api-dich-truyen.onrender.com/', config.canonicalAppUrl)
    .replaceAll('https://api-dich-truyen.onrender.com', baseWithoutSlash);

  // Transform social preview image to absolute URL
  transformed = transformed
    .replaceAll('content="/og-image.svg"', `content="${config.canonicalAppUrl}og-image.svg"`);

  // If deployed on sub-path (basePath !== '/'), rewrite root-relative assets to match basePath
  if (config.basePath !== '/') {
    transformed = transformed
      .replaceAll('href="/favicon.svg"', `href="${config.basePath}favicon.svg"`)
      .replaceAll('src="/theme-init.js"', `src="${config.basePath}theme-init.js"`)
      .replaceAll('href="/site.webmanifest"', `href="${config.basePath}site.webmanifest"`);
  }

  return transformed;
}
