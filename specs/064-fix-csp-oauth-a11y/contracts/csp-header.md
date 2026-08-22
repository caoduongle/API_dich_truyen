# Contract: Content-Security-Policy Production Header

**Feature**: [`064-fix-csp-oauth-a11y`](../spec.md)  
**Date**: 2026-08-23  

---

## 1. HTTP Response Header Specification

### Header Name
`Content-Security-Policy`

### Production Response Value Contract
```http
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; imgSrc 'self' data: blob:; connect-src 'self' ws: wss: https://oauth2.googleapis.com https://www.googleapis.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'
```

### Directive Evaluation Matrix

| Directive | Allowed Sources | Intended Operation |
|---|---|---|
| `connect-src` | `'self'`, `ws:`, `wss:`, `https://oauth2.googleapis.com`, `https://www.googleapis.com` | Allows client REST APIs, WebSocket sync relay, Google OAuth PKCE token exchange, and Google UserInfo API |
| `script-src` | `'self'` | Allows scripts hosted on same origin (e.g. `/theme-init.js`, `/src/main.tsx` bundled into `/assets/*.js`). Inline scripts without hash/nonce are blocked. |
| `style-src` | `'self'`, `'unsafe-inline'`, `https://fonts.googleapis.com` | Allows internal Tailwind styles and Google Fonts stylesheet links |
| `font-src` | `'self'`, `https://fonts.gstatic.com`, `data:` | Allows Google Fonts webfont files and data URIs |
