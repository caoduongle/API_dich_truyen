import { useEffect } from 'react';
import { SEO_CONFIG } from '../utils/seoConfig';

export interface SeoMetadataOptions {
  title: string;
  description?: string;
  canonicalPath?: string;
  ogType?: 'website' | 'article';
}

/**
 * Hook quản lý On-Page SEO động: <title>, <meta description>, <link canonical>, Open Graph
 */
export function useSeoMetadata({
  title,
  description = SEO_CONFIG.defaultDescription,
  canonicalPath = '',
  ogType = 'website',
}: SeoMetadataOptions): void {
  useEffect(() => {
    if (typeof document === 'undefined') return;

    // 1. Cập nhật <title>
    const fullTitle = `${title} | ${SEO_CONFIG.shortName}`;
    document.title = fullTitle;

    // 2. Cập nhật <meta name="description">
    let descMeta = document.querySelector('meta[name="description"]');
    if (!descMeta) {
      descMeta = document.createElement('meta');
      descMeta.setAttribute('name', 'description');
      document.head.appendChild(descMeta);
    }
    descMeta.setAttribute('content', description);

    // 3. Cập nhật <link rel="canonical">
    const canonicalUrl = SEO_CONFIG.getCanonicalUrl(canonicalPath);
    let canonicalLink = document.querySelector('link[rel="canonical"]');
    if (!canonicalLink) {
      canonicalLink = document.createElement('link');
      canonicalLink.setAttribute('rel', 'canonical');
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.setAttribute('href', canonicalUrl);

    // 4. Cập nhật Open Graph tags
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute('content', fullTitle);

    const ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc) ogDesc.setAttribute('content', description);

    const ogUrl = document.querySelector('meta[property="og:url"]');
    if (ogUrl) ogUrl.setAttribute('content', canonicalUrl);

    const ogTypeMeta = document.querySelector('meta[property="og:type"]');
    if (ogTypeMeta) ogTypeMeta.setAttribute('content', ogType);
  }, [title, description, canonicalPath, ogType]);
}

