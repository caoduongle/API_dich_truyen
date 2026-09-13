# Contract: HTML Escaping & Security Headers Policy

## 1. Function Contract: `escapeHtml` in `src/lib/text.ts`

### TypeScript Signature
```typescript
export function escapeHtml(text: string): string;
```

### Pre-conditions
- `text`: Can be any string, empty string, or undefined/null coerced.

### Post-conditions
- If `!text` or not string: returns `""`.
- Exact replacements applied in this sequence:
  1. `&` $\rightarrow$ `&amp;`
  2. `<` $\rightarrow$ `&lt;`
  3. `>` $\rightarrow$ `&gt;`
  4. `"` $\rightarrow$ `&quot;`
  5. `'` $\rightarrow$ `&#39;`
- Returns sanitized string safe for interpolation into XML and XHTML.

---

## 2. EPUB Generation Contract: `src/hooks/useEpubExport.ts`

### Interface Contract
```typescript
export function useEpubExport(): {
  isExportingEpub: string | null;
  handleExportEpub: (proj: StoryProject) => Promise<void>;
};
```

### Behavioral Guarantees
1. All XML document files written into the ZIP package:
   - `OEBPS/cover.xhtml`: `<title>`, `<h1>`, `.author`, `.genre`, `.tone`, and `.description` MUST contain escaped text.
   - `OEBPS/chap_*.xhtml`: `<title>`, `<h1>`, and each `<p>` paragraph MUST contain escaped text.
   - `OEBPS/nav.xhtml`: All `<a>` link text MUST contain escaped text.
   - `OEBPS/toc.ncx`: `<docTitle><text>` and `<navLabel><text>` MUST contain escaped text.
   - `OEBPS/content.opf`: `<dc:title>`, `<dc:creator>`, `<dc:description>` MUST contain escaped text.
2. In `cover.xhtml`, description newline transformation:
   - Raw description is escaped FIRST: `escapeHtml(proj.description)`
   - THEN newline sequence is replaced: `.replace(/\n+/g, '<br/>')`
   - Result preserves `<br/>` as well-formed XHTML self-closing tag.

---

## 3. Configuration Contract: Security Headers Triple Parity

### Target Files
- `render.yaml`
- `vercel.json`
- `public/_headers`

### Invariants
1. `connect-src` MUST NOT contain `ws:` or `wss:`.
2. `Content-Security-Policy` header value in `render.yaml` MUST be character-for-character identical to the value in `vercel.json` and `public/_headers`.
3. If `'unsafe-inline'` is removed from `script-src` or `style-src`, it must be removed in all three files simultaneously.
4. If testing determines that `'unsafe-inline'` is strictly required for certain runtime features (e.g. inline style attributes in React or Google GIS), the reason must be documented and the directive retained identically across all 3 files.
