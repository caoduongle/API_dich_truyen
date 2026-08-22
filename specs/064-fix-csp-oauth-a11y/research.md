# Research: Fix CSP Blocking Google OAuth PKCE and Accessibility Defects

**Feature**: [`064-fix-csp-oauth-a11y`](./spec.md)  
**Date**: 2026-08-23  

---

## 1. Research Topic: CSP Directives for Google OAuth2 PKCE Flow

### Context & Problem
In `server.ts`, production helmet CSP configuration specifies:
```ts
connectSrc: ["'self'", "ws:", "wss:"]
```
The client-side Google Drive synchronization implementation (`src/services/googleAuthService.ts`) uses direct client-side OAuth2 PKCE token exchange:
- `https://oauth2.googleapis.com/token` (Authorization code exchange for Access Token)
- `https://www.googleapis.com/oauth2/v3/userinfo` (User profile fetching)

When running in `NODE_ENV=production`, browser Content Security Policy blocks these `fetch()` requests because `oauth2.googleapis.com` and `www.googleapis.com` are not in the `connect-src` allowlist.

### Decision
Update `connectSrc` in `server.ts` to:
```ts
connectSrc: [
  "'self'",
  "ws:",
  "wss:",
  "https://oauth2.googleapis.com",
  "https://www.googleapis.com"
]
```

### Rationale
1. **Least Privilege**: Only the two specific, required Google endpoints are permitted.
2. **Zero Wildcards**: Avoids `*.googleapis.com`, which would unnecessarily open network access to hundreds of unrelated Google APIs.
3. **Preserves Architecture**: Maintains the zero-knowledge, client-side PKCE architecture established in specs 057 and 060.

### Alternatives Considered
- **Wildcard allowlist (`*.googleapis.com`)**: Overly broad and violates least privilege principle. Rejected.
- **Server proxy for token exchange**: Contradicts the user requirement and design constraints (zero server storage/keys). Rejected.

---

## 2. Research Topic: Theme Initialization Inline Script vs CSP `script-src`

### Context & Problem
In `index.html` (lines 7–28), an inline `<script>` reads stored theme preferences from `localStorage` and applies `data-theme` and custom CSS properties to `document.documentElement` before rendering:
```html
<script>
  (function() {
    try {
      var storedTheme = localStorage.getItem('ai_dich_truyen_theme');
      var theme = storedTheme || (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
      document.documentElement.setAttribute('data-theme', theme);
      if (theme === 'custom') {
        var customColors = localStorage.getItem('ai_dich_truyen_custom_colors');
        if (customColors) {
          var parsed = JSON.parse(customColors);
          var style = document.documentElement.style;
          if (parsed.ink) style.setProperty('--color-ink', parsed.ink);
          if (parsed.parchment) style.setProperty('--color-parchment', parsed.parchment);
          if (parsed.parchment2) style.setProperty('--color-parchment-2', parsed.parchment2);
          if (parsed.textMain) style.setProperty('--color-text-main', parsed.textMain);
          if (parsed.textMuted) style.setProperty('--color-text-muted', parsed.textMuted);
          if (parsed.polish) style.setProperty('--color-polish', parsed.polish);
        }
      }
    } catch (e) {}
  })();
</script>
```
Under production CSP (`script-src 'self'`), inline scripts without nonce/hash or `'unsafe-inline'` are blocked by the browser with error:
`Content Security Policy blocks inline execution of scripts (script-src-elem)`.

### Decision
1. Extract the exact script contents into `public/theme-init.js`.
2. In `index.html`, replace the inline script block with:
```html
<script src="/theme-init.js"></script>
```

### Rationale
- Vite serves static files in `public/` at `/theme-init.js` both in development (`localhost:5173/theme-init.js`) and production (`dist/theme-init.js`).
- Served from the same origin, the script is fully compliant with `script-src 'self'`.
- Eliminates inline script violations completely without adding `'unsafe-inline'` or requiring dynamic server-side nonce injection.

### Alternatives Considered
- **Add `'unsafe-inline'` to `scriptSrc`**: Severely weakens CSP security against XSS. Strictly forbidden.
- **CSP Nonce / Sha256 Hash**: Nonce requires dynamic server template rendering; Sha256 requires updating server config whenever the script changes. An external static file is idiomatic for static/SPA frontend setups.

---

## 3. Research Topic: Accessibility Label-Input Association in GoogleSyncModal

### Context & Problem
Chrome DevTools accessibility audit flagged missing form control labels in `src/components/google-sync/GoogleSyncModal.tsx`:
- Line 325: `<label className="...">OAuth Client ID...</label>` has no `htmlFor`.
- Line 346: `<input ... />` has no `id` or `name`.
- Line 371: `<label className="...">Picker API Key...</label>` has no `htmlFor`.
- Line 392: `<input ... />` has no `id` or `name`.

### Decision
Assign matching IDs and `htmlFor` attributes:
- Client ID label: `htmlFor="google-oauth-client-id"`
- Client ID input: `id="google-oauth-client-id"`
- Picker API Key label: `htmlFor="google-picker-api-key"`
- Picker API Key input: `id="google-picker-api-key"`

### Rationale
- Explicit `htmlFor` - `id` pairing is the standard WCAG technique (H44) for accessible form controls.
- Clicking the label triggers focus on the input element.
- Screen readers announce the label accurately when navigating form controls.
- Zero visual or styling alterations to existing Tailwind CSS classes.

---

## 4. Research Topic: Google Fonts "Verify Stylesheet URLs" Notice

### Context & Problem
Chrome DevTools shows a notice "Verify stylesheet URLs (4 resources)".
In `server.ts`, CSP already permits:
- `styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"]`
- `fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"]`

### Decision & Action Plan
- Do not make speculative CSP edits for Google Fonts.
- After completing Tasks 1-3, perform network verification to inspect if font requests are encountering HTTP errors or if this is a standard DevTools diagnostic check.
