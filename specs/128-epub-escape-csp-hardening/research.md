# Technical Research: EPUB Export Content Escaping, Dead Protocol Pruning & CSP Hardening

## Overview
This document records technical decisions, trade-offs, and empirical testing strategies across the three requirement groups:
1. **Nhóm A**: Centralized HTML escaping in `src/lib/text.ts` and EPUB XHTML/XML sanitization.
2. **Nhóm B**: Pruning WebSocket directives from CSP and removing dead dependencies (`y-websocket`, `y-protocols`).
3. **Nhóm C**: Empirical validation of tightening `'unsafe-inline'` in `script-src` and `style-src` while maintaining 100% parity across `render.yaml`, `vercel.json`, and `public/_headers`.

---

## 1. Centralized HTML Escaping Architecture (`src/lib/text.ts`)

### Decision
Create a single, exported utility function `escapeHtml(text: string): string` in `src/lib/text.ts`:
```typescript
export function escapeHtml(text: string): string {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
```

### Rationale
- **Deterministic order**: Replacing `&` first is non-negotiable. If `<` was replaced with `&lt;` before `&`, a subsequent `&` replacement would convert `&lt;` into `&amp;lt;` (double-escaping).
- **Exact 5-character set**: The XML 1.0 and XHTML 1.0 specifications mandate escaping for five predefined entities: `&amp;`, `&lt;`, `&gt;`, `&quot;`, `&#39;` (or `&apos;`, but `&#39;` is universally supported by both HTML4/5 and XML parsers).
- **Consolidation**: Eliminates duplicate local declarations in `DiffModal.tsx` and `zuminovelPublishService.ts`, ensuring single-source-of-truth semantics.

### Call Sites in `src/hooks/useEpubExport.ts`
All dynamic text injected into XML/XHTML files within the EPUB zip container must pass through `escapeHtml`:
1. `cover.xhtml`:
   - Title: `escapeHtml(proj.title)` in `<title>` and `<h1>`
   - Metadata: `escapeHtml(proj.author || "Khuyết Danh")`, `escapeHtml(proj.genre || "Chưa phân loại")`, `escapeHtml(proj.tone || "Chuẩn")`
   - Description: `escapeHtml(proj.description).replace(/\n+/g, '<br/>')` (CRITICAL: escape the raw text first before converting newlines to `<br/>`, so `<br/>` remains a valid tag in the XHTML)
2. Chapter XHTML (`chap_*.xhtml`):
   - Title: `escapeHtml(chap.title)` in `<title>` and `<h1>`
   - Body: `paragraphs.map(p => `<p>${escapeHtml(p)}</p>`).join('\n  ')`
3. Navigation (`nav.xhtml`):
   - Anchor labels: `escapeHtml(chap.title)`
4. NCX (`toc.ncx`):
   - DocTitle: `<text>${escapeHtml(proj.title)}</text>`
   - NavLabel: `<text>${escapeHtml(chap.title)}</text>`
5. Package Manifest (`content.opf`):
   - Metadata tags: `<dc:title>${escapeHtml(proj.title)}</dc:title>`, `<dc:creator>${escapeHtml(proj.author || "Khuyết Danh")}</dc:creator>`, `<dc:description>${escapeHtml(proj.description || "")}</dc:description>`

---

## 2. WebSocket Protocol Removal & Dead Dependency Cleanup

### Decision
1. Remove `ws:` and `wss:` from `connect-src` in `vercel.json` and `public/_headers` (already absent in `render.yaml`).
2. Remove `"y-websocket"` and `"y-protocols"` from `package.json` `dependencies`.
3. Retain `"yjs"` and `"y-indexeddb"` for client-side CRDT state merging during Google Drive multi-device sync.
4. Run `npm install` to update `package-lock.json`.

### Rationale
- Codebase grep confirmed zero imports of `y-websocket` and zero imports of `y-protocols` anywhere in `src/`.
- Permitting `ws:` and `wss:` in CSP violates the principle of least privilege, opening WebSocket exfiltration vectors.
- Reducing dead dependencies minimizes supply chain vulnerability surface and shrinks `package-lock.json`.

---

## 3. CSP `'unsafe-inline'` Tightening & Verification Protocol

### Current CSP Directives across Hosting Targets
Target files:
- `render.yaml` (Render static site blueprint)
- `vercel.json` (Vercel deployment headers)
- `public/_headers` (Cloudflare Pages / Netlify static headers)

Current unified baseline CSP:
```text
upgrade-insecure-requests; default-src 'self'; script-src 'self' 'unsafe-inline' https://apis.google.com https://accounts.google.com; style-src 'self' 'unsafe-inline' https://accounts.google.com https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: *.googleusercontent.com; connect-src 'self' https://generativelanguage.googleapis.com https://*.googleapis.com https://www.googleapis.com https://accounts.google.com https://content.googleapis.com https://oauth2.googleapis.com https://apis.google.com https://zuminovel.com; frame-src https://drive.google.com https://docs.google.com https://accounts.google.com https://content.googleapis.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none';
```

### Empirical Test Plan for `'unsafe-inline'` Removal
We test removing `'unsafe-inline'` from `script-src` and `style-src` on the preview server:
1. **Flow A (Initial Load & JSON-LD)**:
   - Check if `<script type="application/ld+json">` is executed or ignored.
   - Check if Vite bundles require inline scripts.
2. **Flow B (Google Identity Services Auth)**:
   - GIS dynamically renders buttons and iframe overlays (`accounts.google.com`). Does GIS require `'unsafe-inline'` for its script callbacks or iframe messaging?
3. **Flow C (Google Drive Picker)**:
   - Google Picker API (`apis.google.com/js/api.js`) loads the picker iframe (`docs.google.com`). Does it inject inline scripts?
4. **Flow D (Custom Theme Modal & Inline Styles)**:
   - React components in this codebase heavily use inline style attributes: `style={{ backgroundColor: ... }}`, `style={{ width: `${percent}%` }}` for progress bars, dynamic heights, and custom palettes.
   - In CSP Level 2 and Level 3, removing `'unsafe-inline'` from `style-src` blocks all inline `style="..."` attributes on elements, triggering `[Report Only / Refused to apply inline style because it violates the following Content Security Policy directive: "style-src ..."]`.
   - If inline styles are blocked, progress bars and color swatches fail to render.

### Conclusion of Test Protocol
- We will execute the empirical verification on `npm run preview` using browser devtools / console monitoring.
- If removing `'unsafe-inline'` from `style-src` breaks React inline styles (which is standard browser behavior for elements with `style=`), or if Google SDKs require `'unsafe-inline'`, we retain `'unsafe-inline'` specifically where necessary, add clear in-code rationale comments in `render.yaml`, and enforce 100% character-for-character parity across all 3 files.
