# Feature Specification: Harden Security Headers in Render Blueprint and Refine ZumiNovel Network Error Diagnostics

**Feature Branch**: `126-harden-security-headers`

**Created**: 2026-09-13

**Status**: Draft

**Input**: User description: "Tối ưu thêm các Header bảo mật trong render.yaml cập nhật thêm 3 chỉ thị sau vào file render.yaml: Chặn tải nội dung qua HTTP thường (upgrade-insecure-requests): Thêm vào đầu giá trị Content-Security-Policy để trình duyệt tự động nâng cấp mọi request phát sinh thành HTTPS. Thêm Cross-Origin-Resource-Policy: Ngăn các website khác đọc trộm tài nguyên tĩnh (code/assets) của bạn. Mở rộng Permissions-Policy: Chặn thêm các API phần cứng không cần thiết (payment, usb, screen-wake-lock). Đoạn headers tối ưu lại cho render.yaml: [YAML]. Sửa lại đoạn message trong ZuminovelNetworkError (src/services/zuminovel/zuminovelRestClient.ts) — nó vẫn đang khẳng định chắc nịch là do CORS cần proxy, giờ biết chắc là sai (ZumiNovel CORS ổn, vấn đề thật nằm ở CSP + service trùng lặp), để nguyên dễ gây hiểu lầm cho ai đọc code sau này."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Enforce Hardened Security Headers on Production Deployments (Priority: P1)

As a security auditor and end user accessing the web application deployed on Render, I want the web server to enforce robust HTTP response security headers—automatically upgrading insecure HTTP subrequests to HTTPS, preventing unauthorized cross-origin resource leakage, and restricting unnecessary hardware device APIs (payment, usb, screen-wake-lock)—so that the application's attack surface is minimized and client communications remain secure.

**Why this priority**: Security hardening at the infrastructure/deployment layer protects authentication tokens, Google Drive OAuth exchanges, and translation assets from cross-site exploitation, clickjacking, and unauthorized resource embedding.

**Independent Test**: Inspect the configuration in `render.yaml` and verify that the security header declarations strictly comply with production hardening standards: `upgrade-insecure-requests` in CSP, `Cross-Origin-Resource-Policy: same-origin`, and `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), screen-wake-lock=()`.

**Acceptance Scenarios**:

1. **Given** a user loading the application from Render, **When** the browser parses the `Content-Security-Policy` header, **Then** the policy begins with `upgrade-insecure-requests;` ensuring all subrequests are automatically upgraded to HTTPS, while preserving all existing permitted domains (Google APIs, Google Accounts, Google Fonts, Gemini API, and `https://zuminovel.com`).
2. **Given** an external website attempting to hotlink or read static assets (scripts, styles, icons) from the application, **When** the request is made, **Then** the browser enforces `Cross-Origin-Resource-Policy: same-origin` and prevents the cross-origin reading.
3. **Given** scripts or embedded contexts attempting to query browser device APIs (camera, microphone, geolocation, payment, usb, screen-wake-lock), **When** invoked, **Then** the browser immediately rejects access based on `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), screen-wake-lock=()`.

---

### User Story 2 - Accurate and Meaningful Network Error Diagnostics for ZumiNovel (Priority: P2)

As a translator publishing novel chapters to ZumiNovel from the client-side SPA, when a network error or fetch failure occurs (e.g., loss of Internet connectivity, DNS failure, browser extension/adblocker interference, or CSP block), I want the error message and code comments in `ZuminovelNetworkError` to provide accurate diagnostics rather than falsely claiming that ZumiNovel requires a server-side proxy due to CORS.

**Why this priority**: The existing message in `ZuminovelNetworkError` asserts that ZumiNovel blocks direct browser requests and demands a backend proxy. This claim is incorrect because ZumiNovel supports direct browser CORS, and the real issue was resolved through CSP configuration. Preserving false assertions causes confusion for developers and misleading feedback for users.

**Independent Test**: Instantiate or trigger `ZuminovelNetworkError` in `src/services/zuminovel/zuminovelRestClient.ts` and verify that the message and JSDoc documentation correctly point to transport, DNS, adblocker, or security policy issues without suggesting an unnecessary backend proxy.

**Acceptance Scenarios**:

1. **Given** a fetch-level failure (e.g. `TypeError: Failed to fetch`) occurring during an API call in `zuminovelRestClient.ts`, **When** `ZuminovelNetworkError` is thrown, **Then** its message informs the user that the connection failed due to network connectivity, DNS, adblocker/security extension, or security policy restrictions, without asserting a need for a CORS proxy.
2. **Given** a developer reviewing `zuminovelRestClient.ts`, **When** reading the JSDoc for `ZuminovelNetworkError`, **Then** the documentation clearly explains that ZumiNovel supports direct browser requests and that network errors stem from connection drops, DNS issues, adblocker interference, or Content-Security-Policy restrictions.

---

### Edge Cases

- **What happens if a legacy browser does not support `upgrade-insecure-requests`?**: Modern browsers automatically rewrite HTTP URLs to HTTPS; older browsers that do not recognize the directive simply ignore it, with `Strict-Transport-Security` (HSTS) continuing to enforce HTTPS at the transport layer.
- **What happens if an adblocker or privacy extension blocks requests to `zuminovel.com`?**: The browser will reject the fetch call with `Failed to fetch`. The revised `ZuminovelNetworkError` explicitly cites browser extensions and adblockers as a likely cause, helping the user self-resolve by whitelisting the domain.
- **What happens if ZumiNovel returns an HTTP error code (401, 403, 429, etc.)?**: The request successfully receives an HTTP response and throws `ZuminovelApiError`, which is handled independently from `ZuminovelNetworkError`.
- **What happens if GIS (Google Identity Services) popup authentication is triggered?**: The `Cross-Origin-Opener-Policy: same-origin-allow-popups` remains unchanged, ensuring Google Drive and OAuth authentication flows continue to work uninterrupted.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST configure `upgrade-insecure-requests;` at the beginning of the `Content-Security-Policy` header in `render.yaml` for path `/*`.
- **FR-002**: System MUST configure `Cross-Origin-Resource-Policy: same-origin` in `render.yaml` for path `/*` to protect static assets from cross-origin theft or embedding.
- **FR-003**: System MUST expand `Permissions-Policy` in `render.yaml` for path `/*` to explicitly disable `payment=()`, `usb=()`, and `screen-wake-lock=()`, resulting in `camera=(), microphone=(), geolocation=(), payment=(), usb=(), screen-wake-lock=()`.
- **FR-004**: System MUST preserve all existing security headers in `render.yaml`, including `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Cross-Origin-Opener-Policy: same-origin-allow-popups`, `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`, and all authorized CSP domains for Google services, Gemini API, and `https://zuminovel.com`.
- **FR-005**: System MUST update the error message of `ZuminovelNetworkError` in `src/services/zuminovel/zuminovelRestClient.ts` to remove the outdated claim that ZumiNovel blocks direct browser requests requiring a server proxy, and instead explain potential causes: mất kết nối internet, lỗi DNS, tiện ích chặn quảng cáo/bảo vệ quyền riêng tư, hoặc chính sách bảo mật trình duyệt (CSP).
- **FR-006**: System MUST update the JSDoc documentation of `ZuminovelNetworkError` in `src/services/zuminovel/zuminovelRestClient.ts` to accurately document direct browser integration and realistic root causes for fetch errors.
- **FR-007**: System MUST maintain compatibility with existing consumers of `ZuminovelNetworkError`, including `src/hooks/useZuminovelPublish.ts` and test suite `src/services/zuminovel/__tests__/zuminovelRestClient.test.ts`.

### Key Entities

- **RenderSecurityHeader**: Represents HTTP header definitions in `render.yaml` with attributes `path`, `name`, and `value`.
- **ZuminovelNetworkError**: Custom error class inheriting from `Error`, encapsulating fetch transport failures and preserving `originalError`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of defined HTTP security headers in `render.yaml` conform to the hardened security blueprint (`upgrade-insecure-requests` in CSP, `Cross-Origin-Resource-Policy: same-origin`, and expanded `Permissions-Policy`).
- **SC-002**: Zero references suggesting "cần proxy phía server do CORS" remain in `zuminovelRestClient.ts` code or documentation.
- **SC-003**: All automated verification commands (`npm run lint`, `npm test`, `npm run build`) pass cleanly with 0 type errors and 0 test regressions.

## Assumptions

- The static site hosting infrastructure (Render) accurately applies headers declared under `services[].headers` to all HTTP responses matching `path: /*`.
- ZumiNovel's external API properly serves CORS response headers (`Access-Control-Allow-Origin`), enabling direct client-side browser requests without needing an intermediate proxy.
- The web application does not depend on payment APIs, WebUSB, or screen wake lock APIs; disabling them via Permissions-Policy has no negative impact on user workflows.

