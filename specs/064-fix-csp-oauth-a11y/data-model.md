# Data Model: CSP Policy Configuration & Accessibility Attributes

**Feature**: [`064-fix-csp-oauth-a11y`](./spec.md)  
**Date**: 2026-08-23  

---

## 1. Security Header Directives (Server Configuration)

### Production Content-Security-Policy Structure

```typescript
interface CspDirectives {
  defaultSrc: string[];    // ["'self'"]
  scriptSrc: string[];     // ["'self'"]
  styleSrc: string[];      // ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"]
  fontSrc: string[];       // ["'self'", "https://fonts.gstatic.com", "data:"]
  imgSrc: string[];        // ["'self'", "data:", "blob:"]
  connectSrc: string[];    // ["'self'", "ws:", "wss:", "https://oauth2.googleapis.com", "https://www.googleapis.com"]
  objectSrc: string[];     // ["'none'"]
  baseUri: string[];       // ["'self'"]
  formAction: string[];    // ["'self'"]
  frameAncestors: string[]; // ["'none'"]
}
```

---

## 2. Client-Side Theme Storage Entity

### Stored Keys in `localStorage`

| Key | Type | Possible Values / Schema | Purpose |
|---|---|---|---|
| `ai_dich_truyen_theme` | `string` | `'dark' \| 'light' \| 'custom'` | Active UI color theme |
| `ai_dich_truyen_custom_colors` | `string (JSON)` | `{"ink": string, "parchment": string, "parchment2": string, "textMain": string, "textMuted": string, "polish": string}` | Custom color overrides applied via CSS custom properties on `:root` |

---

## 3. Google Sync Credential Form Controls (DOM Binding)

### Accessibility Attribute Mapping

| Field Description | Label `htmlFor` | Input `id` | Input `type` |
|---|---|---|---|
| OAuth Client ID | `google-oauth-client-id` | `google-oauth-client-id` | `text \| password` (toggled by reveal state) |
| Picker API Key | `google-picker-api-key` | `google-picker-api-key` | `text \| password` (toggled by reveal state) |
