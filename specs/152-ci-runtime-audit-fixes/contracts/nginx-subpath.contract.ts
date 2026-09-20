/**
 * Contract: Nginx Sub-Path Routing
 *
 * When VITE_BASE_URL is set to a sub-path (e.g. "/dichtruyen/"),
 * the container's Nginx configuration MUST:
 *
 * 1. Serve static assets under the sub-path prefix with correct MIME types.
 *    Example: GET /dichtruyen/assets/index-abc123.js → 200 application/javascript
 *
 * 2. Route unknown paths under the sub-path to index.html for SPA client-side routing.
 *    Example: GET /dichtruyen/auto-translate → 200 text/html (index.html)
 *
 * 3. When VITE_BASE_URL is "/" (default), behave identically to the current root config.
 *
 * Implementation:
 *   - Use nginx:alpine's built-in envsubst template mechanism.
 *   - Place template at: /etc/nginx/templates/default.conf.template
 *   - Template uses ${VITE_BASE_URL} for the location block.
 *   - ENV VITE_BASE_URL must be set in the Dockerfile runner stage.
 *
 * Dockerfile Contract:
 *   - Builder stage: ARG VITE_BASE_URL=/ and ENV VITE_BASE_URL=$VITE_BASE_URL
 *   - Runner stage: ENV VITE_BASE_URL=${VITE_BASE_URL:-/}
 *   - Template file COPY'd to /etc/nginx/templates/default.conf.template
 *   - No static RUN echo for Nginx config
 */

export interface NginxSubPathContract {
  /** The base URL path, always with leading and trailing slashes */
  baseUrl: string;

  /** Expected behavior for static asset requests */
  staticAssetBehavior: {
    /** Request path includes baseUrl prefix */
    requestPath: string;
    /** File is served from root of html directory (no sub-folder) */
    resolvedFilePath: string;
    /** Response status */
    expectedStatus: 200;
  };

  /** Expected behavior for SPA route requests */
  spaRouteBehavior: {
    /** Request path for a client-side route */
    requestPath: string;
    /** Falls back to index.html within the base path */
    fallbackPath: string;
    /** Response status */
    expectedStatus: 200;
  };
}
