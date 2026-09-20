# Data Model: CI Runtime Parity & Container Integrity Hardening

**Feature**: `152-ci-runtime-audit-fixes`  
**Date**: 2026-09-21

---

This feature does not introduce new data entities or modify existing IndexedDB schemas. It modifies build/test infrastructure configuration and deployment artifacts. The entities below describe the configuration and artifact structures involved.

## Configuration Entities

### PublicUrlConfig (unchanged from spec 151)

Defined in `src/config/publicOrigin.ts`. No schema changes.

```
PublicUrlConfig {
  origin: string          // Normalized origin (protocol + hostname + port), no trailing slash
  basePath: string        // Normalized base path, guaranteed leading & trailing slashes, e.g. "/dichtruyen/"
  canonicalAppUrl: string // origin + basePath, e.g. "https://example.com/dichtruyen/"
}
```

**Validation rules (hardened)**:
- `origin`: Must be parseable by `new URL()`, protocol must be `http:` or `https:`, hostname must be non-empty. Falls back to `DEFAULT_PUBLIC_URL` on failure.
- `basePath`: Trims whitespace, guarantees leading `/`, guarantees trailing `/`. Defaults to `/`.

---

### Nginx Configuration Template (new)

```
nginx.conf.template {
  listen: number           // 80
  server_name: string      // localhost
  root: string             // /usr/share/nginx/html
  base_location: string    // Substituted from ${VITE_BASE_URL}, e.g. "/dichtruyen/"
  try_files: string        // "$uri $uri/ /<basePath>index.html"
}
```

- Created as `/etc/nginx/templates/default.conf.template` inside the Docker image.
- Processed by the `nginx:alpine` entrypoint script at container startup via `envsubst`.
- Supports both root (`/`) and arbitrary sub-path deployments.

---

### EPUB Archive Structure (unchanged)

No changes to the EPUB archive generation logic. Only test assertions are tightened.

```
EPUB ZIP archive {
  mimetype                    // First entry, STORE compression (method 0), no extra field
  META-INF/container.xml      // Points to OEBPS/content.opf
  OEBPS/content.opf           // Package manifest
  OEBPS/toc.ncx               // NCX table of contents
  OEBPS/nav.xhtml             // EPUB3 navigation document
  OEBPS/cover.xhtml           // Book cover page
  OEBPS/style.css             // Reading stylesheet
  OEBPS/chap_N.xhtml          // Chapter content files
}
```

**Assertion rules (tightened)**:
- `mimetype` local file header bytes 8-9 (compression method) must be `0x0000` (STORE).
- No reliance on JSZip `options.compression` property after `loadAsync()`.

---

## File Inventory (Modified/New)

| File | Action | Purpose |
|------|--------|---------|
| `package.json` | MODIFY | Downgrade jsdom to 29.1.1, remove @types/jsdom |
| `package-lock.json` | REGENERATE | Reflect dependency changes |
| `vite.config.ts` | MODIFY | Use `publicConfig.basePath` for Vite `base:` |
| `src/config/publicOrigin.ts` | MODIFY | Harden `normalizeOrigin()` with `new URL()` |
| `src/tests/originConfig.test.ts` | MODIFY | Remove conditional guards, add strict assertions |
| `src/utils/__tests__/customDomainAssets.test.ts` | MODIFY | Update string assertion for new `base:` line |
| `src/hooks/__tests__/useEpubExport.test.ts` | MODIFY | Binary header STORE verification |
| `Dockerfile` | MODIFY | Replace inline RUN echo with template mechanism |
| `nginx.conf.template` | NEW | Nginx config template with env substitution |
| `specs/151-audit-verification-hardening/tasks.md` | MODIFY | Add cross-reference note for T001/T021 |
