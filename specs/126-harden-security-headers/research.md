# Research: Security Headers Hardening & ZumiNovel Error Diagnostics

## Overview

This research document analyzes the technical requirements and industry best practices for:
1. Hardening production HTTP headers in `render.yaml` (Content-Security-Policy with `upgrade-insecure-requests`, Cross-Origin-Resource-Policy with `same-origin`, and Permissions-Policy with expanded hardware restrictions).
2. Clarifying diagnostic messaging in `ZuminovelNetworkError` (`src/services/zuminovel/zuminovelRestClient.ts`) to eliminate false claims about CORS proxy requirements.

---

## 1. Content Security Policy: `upgrade-insecure-requests`

### Decision
Prepend `upgrade-insecure-requests;` to the `Content-Security-Policy` header in `render.yaml` for path `/*`.

### Rationale
- **W3C Standard**: The `upgrade-insecure-requests` directive instructs the user agent to treat all of the site's insecure URLs (those served over HTTP) as though they have been replaced with secure URLs (HTTPS).
- **Mixed Content Protection**: In a modern SPA communicating with cloud APIs (Google Gemini, Google Drive, ZumiNovel), accidental references to `http://` resources (e.g. fonts, images, scripts) are automatically rewritten to `https://` prior to dispatching network requests.
- **Defense in Depth**: Complements `Strict-Transport-Security` (HSTS). While HSTS protects the top-level origin upon subsequent navigations, `upgrade-insecure-requests` ensures nested subresource requests cannot trigger mixed-content warnings or insecure fallbacks.

### Alternatives Considered
- *Rely solely on HSTS*: HSTS ensures the primary domain is accessed over HTTPS, but does not rewrite third-party insecure subresource links if they are loaded dynamically.
- *Strict HTTPS redirect rules only*: Server rewrites cannot fix client-side mixed content blocks if the browser blocks insecure scripts/styles before they leave the client. `upgrade-insecure-requests` operates directly inside the browser's fetch/load pipeline.

---

## 2. Cross-Origin-Resource-Policy: `same-origin`

### Decision
Add the `Cross-Origin-Resource-Policy: same-origin` (CORP) header for path `/*` in `render.yaml`.

### Rationale
- **Resource Isolation**: CORP allows servers to declare that their static resources (JavaScript bundles, CSS, images, WebAssembly modules) cannot be loaded by other origins via elements like `<script>`, `<img>`, or `fetch()`.
- **Spectre & XS-Leaks Defense**: Mitigates speculative execution attacks and cross-origin information leaks by ensuring the browser process isolation model does not share memory contexts containing this application's assets with untrusted third parties.
- **Application Fit**: "Bản Thảo Chu Sa" is a standalone single-page application and does not serve a public CDN or embeddable widget library for external consumption. Hence, `same-origin` is the strictly correct policy.

### Alternatives Considered
- *`cross-origin`*: Allows any site to read resources. Appropriate for public CDNs, but unnecessary and insecure for an internal application codebase.
- *`same-site`*: Allows same-site subdomains. Since the application is self-contained on Render, `same-origin` is stricter and preferred.

---

## 3. Permissions-Policy Expansion

### Decision
Expand `Permissions-Policy` in `render.yaml` from `camera=(), microphone=(), geolocation=()` to:
`camera=(), microphone=(), geolocation=(), payment=(), usb=(), screen-wake-lock=()`

### Rationale
- **Principle of Least Privilege**: The application does not require access to the Payment Request API, WebUSB API, or Screen Wake Lock API.
- **Attack Surface Minimization**: Disabling unused hardware capabilities prevents any malicious third-party script, compromised dependency, or injected iframe from attempting to interact with client peripherals or silent transaction APIs.
- **Standards Compliance**: Modern Chromium, Firefox, and Safari engines support these feature identifiers in `Permissions-Policy`.

### Alternatives Considered
- *Leave default permissions*: Leaves hardware APIs in their default permission state (which may prompt the user or remain accessible in insecure contexts).
- *Disable only payment & usb*: The user prompt explicitly indicated `screen-wake-lock` in the text description; including it adheres to both user intent and hardening best practices without affecting reading/editing functionality.

---

## 4. ZumiNovel Network Error Diagnostic Refactor

### Decision
Refactor `ZuminovelNetworkError` in `src/services/zuminovel/zuminovelRestClient.ts`:
1. Update error message string to:
   ```ts
   'Không kết nối được tới ZumiNovel. Vui lòng kiểm tra lại kết nối mạng, cài đặt DNS, ' +
   'tiện ích chặn quảng cáo/bảo vệ quyền riêng tư, hoặc chính sách bảo mật trình duyệt (CSP).'
   ```
2. Update JSDoc documentation to explicitly state:
   - ZumiNovel supports direct browser CORS requests.
   - A `TypeError: Failed to fetch` is caused by transport loss, DNS lookup failure, adblocker interception, or CSP violations—not by a lack of CORS support on ZumiNovel's side.
   - No server proxy is required.

### Rationale
- **Factual Accuracy**: In earlier troubleshooting, the team verified that ZumiNovel's API (`https://zuminovel.com/api/external`) responds with valid CORS headers (`Access-Control-Allow-Origin: *`). Direct client-side requests succeed once `connect-src https://zuminovel.com` is present in CSP.
- **Avoid Misleading Developers**: The previous message ("nhiều khả năng ZumiNovel chặn gọi API trực tiếp từ trình duyệt (CORS) — cần một proxy nhỏ phía server...") caused confusion and misdirected development effort toward creating redundant backend proxies.
- **Clear User Actionability**: When an actual failure occurs, informing users to check their Internet connection, DNS, adblockers (such as uBlock Origin blocking external API calls), or browser settings provides immediate, actionable debugging steps.

### Alternatives Considered
- *Keep message as generic "Lỗi kết nối mạng"*: Less helpful than mentioning DNS, adblocker, and CSP, which are the real-world reasons why a browser fetch to an external domain might fail.
- *Inspect error properties in fetch catch block*: The browser's standard `fetch()` API throws an opaque `TypeError: Failed to fetch` without exposing whether it was blocked by CSP, DNS, or network drop (for security reasons). Therefore, listing the genuine candidate causes in the user-facing message is the industry-standard approach.
