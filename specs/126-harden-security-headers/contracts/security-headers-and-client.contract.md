# Contract: Security Headers Specification & Client Error Interface

## 1. Infrastructure Contract: `render.yaml`

The static web service in `render.yaml` MUST declare the following HTTP headers block under `services[0].headers`:

```yaml
    headers:
      # 1. Chống MIME-sniffing
      - path: /*
        name: X-Content-Type-Options
        value: nosniff

      # 2. Ngăn chặn clickjacking (chặn nhúng iframe từ bên ngoài)
      - path: /*
        name: X-Frame-Options
        value: DENY

      # 3. Bảo vệ referrer khi điều hướng ra domain ngoài
      - path: /*
        name: Referrer-Policy
        value: strict-origin-when-cross-origin

      # 4. Cho phép popup đăng nhập Google Identity Services (GIS) giao tiếp với trang mẹ
      - path: /*
        name: Cross-Origin-Opener-Policy
        value: same-origin-allow-popups

      # 5. Ngăn chặn các website khác đọc trộm tài nguyên tĩnh (code/assets)
      - path: /*
        name: Cross-Origin-Resource-Policy
        value: same-origin

      # 6. Vô hiệu hóa các quyền phần cứng không dùng (bảo vệ thiết bị người dùng)
      - path: /*
        name: Permissions-Policy
        value: camera=(), microphone=(), geolocation=(), payment=(), usb=(), screen-wake-lock=()

      # 7. Bắt buộc HTTPS trong 1 năm
      - path: /*
        name: Strict-Transport-Security
        value: max-age=31536000; includeSubDomains; preload

      # 8. Chính sách an ninh nội dung (Content-Security-Policy)
      # - Nâng cấp tự động mọi request HTTP thành HTTPS (upgrade-insecure-requests)
      # - Giữ 'unsafe-inline' cho script-src/style-src để Google Auth & Picker hoạt động
      # - Đã cấp phép connect-src cho Gemini, Google APIs và https://zuminovel.com để đăng chương
      - path: /*
        name: Content-Security-Policy
        value: "upgrade-insecure-requests; default-src 'self'; script-src 'self' 'unsafe-inline' https://apis.google.com https://accounts.google.com; style-src 'self' 'unsafe-inline' https://accounts.google.com https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: *.googleusercontent.com; connect-src 'self' https://generativelanguage.googleapis.com https://*.googleapis.com https://www.googleapis.com https://accounts.google.com https://content.googleapis.com https://oauth2.googleapis.com https://apis.google.com https://zuminovel.com; frame-src https://drive.google.com https://docs.google.com https://accounts.google.com https://content.googleapis.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none';"
```

### Contract Rules for `render.yaml`
1. Must be valid YAML adhering to the Render Blueprint Specification version "1".
2. Every header rule must have `path: /*`.
3. `Cross-Origin-Resource-Policy` must equal `same-origin`.
4. `Permissions-Policy` must include `payment=(), usb=(), screen-wake-lock=()` alongside existing `camera=(), microphone=(), geolocation=()`.
5. `Content-Security-Policy` must start with `upgrade-insecure-requests; ` and keep all existing connect-src domains (`https://zuminovel.com`, `https://generativelanguage.googleapis.com`, etc.).

---

## 2. Code Contract: `ZuminovelNetworkError` in `zuminovelRestClient.ts`

### TypeScript Signature Contract

```typescript
/**
 * Request KHÔNG nhận được response nào từ server (mất mạng, lỗi DNS, tiện ích
 * chặn quảng cáo/bảo vệ quyền riêng tư chặn request, hoặc vi phạm chính sách
 * Content-Security-Policy).
 *
 * Lưu ý: ZumiNovel API hỗ trợ gọi trực tiếp từ trình duyệt (CORS chuẩn, không
 * cần proxy). fetch() ném TypeError "Failed to fetch" khi tầng mạng hoặc chính sách
 * bảo mật trình duyệt chặn request trước khi server kịp phản hồi.
 */
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

### Invariants
1. `err instanceof ZuminovelNetworkError` must evaluate to `true`.
2. `err instanceof Error` must evaluate to `true`.
3. `err.name` must be `'ZuminovelNetworkError'`.
4. `err.message` must contain the updated Vietnamese troubleshooting message.
5. `err.originalError` must hold the caught rejection value (e.g. `TypeError: Failed to fetch`).
6. Zero references to `"cần một proxy nhỏ phía server"` or `"chặn gọi API trực tiếp từ trình duyệt (CORS)"` may exist in the codebase.
