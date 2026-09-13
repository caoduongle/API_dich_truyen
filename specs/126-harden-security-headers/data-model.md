# Data Model: Security Headers & Error Diagnostics

## Entities

### 1. RenderSecurityHeader

Represents a declared HTTP security response header within the Render Blueprint infrastructure configuration (`render.yaml`).

| Field | Type | Description | Constraints / Validation |
| :--- | :--- | :--- | :--- |
| `path` | `string` | URL path pattern to which this header rule applies | Must be `/*` to ensure full SPA route coverage |
| `name` | `string` | Canonical HTTP response header name | Must be a recognized standard header (e.g. `Content-Security-Policy`, `Cross-Origin-Resource-Policy`, `Permissions-Policy`) |
| `value` | `string` | The policy value or directives string | Valid syntax per relevant RFC/W3C specification |

#### Active Header Directives Inventory

1. **`X-Content-Type-Options`**:
   - `path`: `/*`
   - `value`: `nosniff`
2. **`X-Frame-Options`**:
   - `path`: `/*`
   - `value`: `DENY`
3. **`Referrer-Policy`**:
   - `path`: `/*`
   - `value`: `strict-origin-when-cross-origin`
4. **`Cross-Origin-Opener-Policy`**:
   - `path`: `/*`
   - `value`: `same-origin-allow-popups` (Required for Google Identity Services popup login)
5. **`Cross-Origin-Resource-Policy`** *(NEW)*:
   - `path`: `/*`
   - `value`: `same-origin` (Restricts code and assets from cross-origin reading)
6. **`Permissions-Policy`** *(EXPANDED)*:
   - `path`: `/*`
   - `value`: `camera=(), microphone=(), geolocation=(), payment=(), usb=(), screen-wake-lock=()`
7. **`Strict-Transport-Security`**:
   - `path`: `/*`
   - `value`: `max-age=31536000; includeSubDomains; preload`
8. **`Content-Security-Policy`** *(UPDATED)*:
   - `path`: `/*`
   - `value`: `"upgrade-insecure-requests; default-src 'self'; script-src 'self' 'unsafe-inline' https://apis.google.com https://accounts.google.com; style-src 'self' 'unsafe-inline' https://accounts.google.com https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: *.googleusercontent.com; connect-src 'self' https://generativelanguage.googleapis.com https://*.googleapis.com https://www.googleapis.com https://accounts.google.com https://content.googleapis.com https://oauth2.googleapis.com https://apis.google.com https://zuminovel.com; frame-src https://drive.google.com https://docs.google.com https://accounts.google.com https://content.googleapis.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none';"`

---

### 2. ZuminovelNetworkError

Domain error model extending the JavaScript standard `Error` class, raised by `ZuminovelRestClient` whenever a low-level fetch transport rejection occurs.

| Field | Type | Description |
| :--- | :--- | :--- |
| `name` | `string` | Canonical error class name (`'ZuminovelNetworkError'`) |
| `message` | `string` | User-facing explanatory message with actionable troubleshooting steps |
| `originalError` | `unknown` | Original underlying exception thrown by `fetch()` (typically `TypeError: Failed to fetch`) |

#### State & Message Definition

```typescript
export class ZuminovelNetworkError extends Error {
  public readonly originalError?: unknown;

  constructor(originalError?: unknown) {
    super(
      'Không kết nối được tới ZumiNovel. Vui lòng kiểm tra lại kết nối mạng, cài đặt DNS, ' +
      'tiện ích chặn quảng cáo/bảo vệ quyền riêng tư, hoặc chính sách bảo mật trình duyệt (CSP).'
    );
    this.name = 'ZuminovelNetworkError';
    this.originalError = originalError;
  }
}
```

#### Consumer Relationships

```text
fetch(ZUMINOVEL_API_BASE_URL + path)
  │ (TypeError: Failed to fetch)
  ▼
ZuminovelRestClient.request()
  │ throws ZuminovelNetworkError
  ▼
useZuminovelPublish hook
  │ catches err instanceof ZuminovelNetworkError
  ▼
Returns err.message to UI toast / publish status display
```
