# Feature Specification: EPUB Export Content Escaping, Dead Protocol Pruning & CSP Hardening

**Feature Branch**: `128-epub-escape-csp-hardening`

**Created**: 2026-09-13

**Status**: Draft

**Input**: User prompt detailing:
- Nhóm A (Lỗi thật, ưu tiên cao nhất): Tạo hàm `escapeHtml(text: string): string` duy nhất trong `src/lib/text.ts` (escape đúng 5 ký tự `&`, `<`, `>`, `"`, `'` theo thứ tự `&` trước tiên); tái sử dụng trong `DiffModal.tsx` và `zuminovelPublishService.ts`, xóa bản sao trùng lặp; sửa `useEpubExport.ts` bọc `escapeHtml` cho mọi trường nội suy vào XHTML/XML (`proj.title`, `author`, `genre`, `tone`, các đoạn `p`, `chap.title`, `proj.description` escape trước khi thay newline thành `<br/>`); viết test xác nhận XHTML hợp lệ khi chứa `<`, `>`, `&`.
- Nhóm B (Đúng và cần sửa ngay): Xóa `ws:` và `wss:` khỏi `connect-src` trong cả 3 file (`render.yaml`, `vercel.json`, `public/_headers`); gỡ `y-websocket` và `y-protocols` khỏi `package.json`, chạy `npm install` cập nhật `package-lock.json`, xác nhận `npm run build` thành công.
- Nhóm C (Thử nghiệm có kiểm chứng): Thử bỏ `'unsafe-inline'` khỏi `script-src` và `style-src` trong cả 3 file cùng lúc; kiểm chứng thực tế qua 4 luồng (tải trang lần đầu, Google GIS đăng nhập, Google Drive Picker, đổi màu theme tùy chỉnh); nếu sạch hoàn toàn thì giữ và thêm comment, nếu vi phạm thì xác định nguồn gốc và chỉ thêm lại mức tối thiểu cần thiết; giữ 3 file đồng bộ 100% không lệch ký tự nào.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Secure and Well-Formed EPUB Document Generation (Priority: P1)

As a reader or author exporting translated novels to EPUB format, I want all metadata fields (title, author, genre, tone, description) and chapter contents (titles, paragraphs) containing special characters such as `<`, `>`, `&`, `"`, and `'` to be properly escaped in the internal XHTML and XML files, so that e-readers (such as Apple Books, Calibre, Kindle, Thorium) parse the file as well-formed XML without corrupting the document, crashing, or triggering XML parsing errors.

**Why this priority**: EPUB 3.0 packages require strictly well-formed XHTML and XML. Injecting unescaped `<`, `>`, or `&` (very common in novel titles, chapter notes, quotes, or dialogue) breaks the XML parser of e-reader applications, rendering exported books unreadable. Centralizing HTML escaping in a single utility prevents regressions across EPUB export, translation difference review, and novel syndication.

**Independent Test**: Create or import a novel with title `Đấu Phá & Thương Khung <Phần 1>`, description with multiple lines and quotes, and chapter content containing `<Nhân vật A>`, `A & B`. Export to EPUB and verify that all generated XHTML and XML files (`cover.xhtml`, `chap_*.xhtml`, `nav.xhtml`, `toc.ncx`, `content.opf`) contain valid escaped entities (`&amp;`, `&lt;`, `&gt;`) and parse cleanly as well-formed XML.

**Acceptance Scenarios**:

1. **Given** a project title, author, genre, tone, or chapter title containing `&`, `<`, `>`, `"`, or `'`, **When** the user exports the project as EPUB, **Then** all injected values in `cover.xhtml`, chapter XHTML files, `nav.xhtml`, `toc.ncx`, and `content.opf` are escaped, preventing broken XML markup.
2. **Given** chapter body paragraphs containing dialogue with `<` and `>`, or ampersands `&`, **When** chapter XHTML pages are constructed, **Then** each paragraph `<p>` contains escaped content without raw unescaped XML delimiters.
3. **Given** a multi-line project description, **When** formatting the cover page, **Then** the raw text is HTML-escaped first before newline characters are replaced with line break tags (`<br/>`), ensuring the tags themselves are not double-escaped.
4. **Given** existing modules performing HTML escaping (`DiffModal.tsx` dictionary highlight and `zuminovelPublishService.ts` chapter HTML packaging), **When** these modules are updated, **Then** they consume the single unified escaping utility from `src/lib/text.ts` and maintain identical highlighting and publishing behaviors.

---

### User Story 2 - Elimination of Stale WebSocket Directives and Dead Dependencies (Priority: P2)

As a security auditor and maintainer of the Zero-Backend client application, I want the Content Security Policy to eliminate stale WebSocket connection privileges (`ws:`, `wss:`) and the repository to remove unused collaboration packages (`y-websocket`, `y-protocols`), so that the application minimizes its attack surface, eliminates unnecessary supply-chain dependencies, and aligns server headers with the true client-side architecture.

**Why this priority**: After migrating from an Express/Redis/WebSocket architecture to a Pure Client-Side SPA using IndexedDB and Google Drive v3 REST API, WebSocket connectivity is no longer used anywhere in the codebase. Permitting `ws:` and `wss:` in CSP opens unnecessary exfiltration channels, and retaining unused dependencies bloats `package-lock.json` and poses supply chain risk.

**Independent Test**: Inspect `render.yaml`, `vercel.json`, and `public/_headers` to ensure `ws:` and `wss:` are absent from `connect-src`. Inspect `package.json` to verify `y-websocket` and `y-protocols` are removed while `yjs` and `y-indexeddb` remain intact. Run `npm test` and `npm run build` to confirm zero build or runtime regressions.

**Acceptance Scenarios**:

1. **Given** the deployment header configurations in `render.yaml`, `vercel.json`, and `public/_headers`, **When** inspecting `connect-src`, **Then** neither `ws:` nor `wss:` is present in any of the three files.
2. **Given** the project dependencies in `package.json`, **When** inspecting `dependencies`, **Then** `y-websocket` and `y-protocols` are removed, while `yjs` and `y-indexeddb` remain installed.
3. **Given** the package lockfile and build pipeline, **When** executing `npm run build`, **Then** the build completes successfully without missing module errors.

---

### User Story 3 - Controlled CSP Inline Tightening & Triple-File Parity Enforcement (Priority: P3)

As an application security engineer, I want to test tightening Content Security Policy by evaluating whether `'unsafe-inline'` can be safely removed from `script-src` and `style-src` across all core browser workflows (initial load, Google Identity Services authentication, Google Drive Picker, and Custom Theme customization), and maintain byte-for-byte CSP parity across `render.yaml`, `vercel.json`, and `public/_headers`, so that user sessions are safeguarded against XSS while ensuring zero functional degradation for readers and translators.

**Why this priority**: Removing `'unsafe-inline'` is the gold standard for XSS defense in modern web applications. However, third-party SDKs (Google Identity Services, Google Drive Picker) and dynamic UI theme variables frequently require inline styles or scripts. Blindly removing `'unsafe-inline'` causes silent runtime crashes in production; empirical verification is mandatory to establish the tightest viable policy without breaking user workflows.

**Independent Test**: Build and preview the production static site (`npm run build && npm run preview`). Using browser DevTools Console, execute each of the 4 verification workflows: (a) initial page load and JSON-LD inspection, (b) Google OAuth authentication popup / One Tap, (c) Google Drive file picker modal, and (d) custom theme color palette adjustments. Verify whether CSP violation errors are logged. If clean, preserve the hardened policy; if violations occur, identify the exact origin and apply the minimal necessary exception with documented rationale. Verify that the final CSP string across `render.yaml`, `vercel.json`, and `public/_headers` is identical character-for-character.

**Acceptance Scenarios**:

1. **Given** a production preview build of the web application, **When** navigating to the home page, **Then** all static assets load cleanly, JSON-LD structured data is readable, and any CSP violations in DevTools Console are logged and analyzed.
2. **Given** the Google Sign-in and Drive synchronization flow, **When** triggering Google Identity Services authentication and the Google Drive Picker, **Then** any script or style execution requirements from Google SDKs are verified against the CSP configuration.
3. **Given** the Custom Theme modal, **When** the user customizes reading colors, **Then** theme updates apply smoothly without triggering style-src CSP blockages.
4. **Given** the final chosen CSP configuration, **When** comparing the `Content-Security-Policy` header in `render.yaml`, `vercel.json`, and `public/_headers`, **Then** the header strings match identically with zero discrepancies.

---

### Edge Cases

- **What happens when novel text contains unclosed HTML/XML tags (e.g. `<Võ Thần`)?**: `escapeHtml` replaces `<` with `&lt;`, rendering it as visible text rather than an unclosed tag that breaks XML document parsing.
- **What happens when text contains consecutive ampersands (`&&`) or already-escaped entities (`&amp;`)?**: Standard escaping escapes `&` to `&amp;` first, ensuring predictable single-layer representation in XHTML output.
- **What happens if Google Identity Services (GIS) or Google Picker injects runtime inline scripts or inline styles into the DOM?**: If browser verification logs CSP violations during Google Auth or Picker dialogs, the policy must selectively restore the minimal required directive (or trusted Google domain/hash) with explanatory documentation rather than blindly breaking the authentication pipeline.
- **What happens if `proj.description` contains no newlines or is empty/undefined?**: Escaping handles empty or falsy strings gracefully by returning `""` without throwing errors.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a single, unified `escapeHtml(text: string): string` utility in `src/lib/text.ts` that escapes exactly 5 HTML special characters in deterministic order: `&` (`&amp;`), `<` (`&lt;`), `>` (`&gt;`), `"` (`&quot;`), and `'` (`&#39;`).
- **FR-002**: `src/components/auto-translator/DiffModal.tsx` and `src/services/zuminovelPublishService.ts` MUST remove their redundant local `escapeHtml` functions and import `escapeHtml` from `src/lib/text.ts`, preserving identical highlighting and formatting semantics.
- **FR-003**: `src/hooks/useEpubExport.ts` MUST apply `escapeHtml` to all user-provided data interpolated into EPUB XHTML and XML documents, specifically:
  - `proj.title` in `cover.xhtml`, `toc.ncx`, `content.opf`.
  - `proj.author`, `proj.genre`, `proj.tone` in `cover.xhtml` and `content.opf`.
  - `proj.description` on `cover.xhtml` by escaping the raw description first before replacing newlines with `<br/>`, and in `content.opf`.
  - `chap.title` in `cover.xhtml` nav links, chapter `<h1>`, chapter `<title>`, `nav.xhtml`, and `toc.ncx`.
  - Each paragraph `p` within chapter body text: `paragraphs.map(p => `<p>${escapeHtml(p)}</p>`)`.
- **FR-004**: Unit tests MUST be provided verifying that EPUB export generation produces well-formed XML/XHTML when chapter titles, descriptions, and paragraphs contain `<`, `>`, and `&`.
- **FR-005**: All three deployment configuration files (`render.yaml`, `vercel.json`, and `public/_headers`) MUST remove `ws:` and `wss:` from `connect-src`.
- **FR-006**: The repository MUST remove `y-websocket` and `y-protocols` from `package.json` dependencies, update `package-lock.json`, and retain `yjs` and `y-indexeddb` for local CRDT synchronization.
- **FR-007**: The CSP directives in `render.yaml`, `vercel.json`, and `public/_headers` MUST be tested for the removal of `'unsafe-inline'` from `script-src` and `style-src` across four distinct browser workflows (initial load, Google GIS auth, Google Drive Picker, custom theme modification).
- **FR-008**: The Content-Security-Policy header across `render.yaml`, `vercel.json`, and `public/_headers` MUST be maintained with 100% strict byte-for-byte consistency (identical directives and character strings).

### Key Entities

- **HtmlEscapedText**: Sanitized string representation where XML/HTML delimiter characters (`&`, `<`, `>`, `"`, `'`) are converted into character entity references.
- **EpubDocumentPackage**: ZIP container conforming to the EPUB 3.0 specification containing strictly well-formed XML/XHTML documents (`content.opf`, `toc.ncx`, `nav.xhtml`, `cover.xhtml`, and chapter content files).
- **SecurityHeadersPolicy**: Uniform set of HTTP response headers (`Content-Security-Policy`, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Cross-Origin-Opener-Policy`, `Permissions-Policy`, `Strict-Transport-Security`) applied identically across Render, Vercel, and Cloudflare Pages/Netlify deployment targets.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of EPUB export documents containing XML delimiter characters (`<`, `>`, `&`) generate strictly well-formed XHTML without parser exceptions.
- **SC-002**: Exactly 1 centralized definition of `escapeHtml` exists in `src/` (zero duplicate implementations).
- **SC-003**: 0 occurrences of `ws:` and `wss:` remain in the Content-Security-Policy of `render.yaml`, `vercel.json`, and `public/_headers`.
- **SC-004**: 0 references to `y-websocket` and `y-protocols` exist in `package.json`.
- **SC-005**: 100% parity is verified between `render.yaml`, `vercel.json`, and `public/_headers` Content-Security-Policy strings (0 character discrepancies).
- **SC-006**: All 4 specified browser verification workflows are empirically tested in a production preview environment, and all CSP adjustments are validated by console logs.
- **SC-007**: 100% pass rate on all constitutional quality gates (`npm run lint`, `npm test`, `npm run build`).

---

## Assumptions

- E-reader applications strictly enforce XML well-formedness rules per EPUB 3.0 specifications; any unescaped `<` or unescaped `&` produces fatal parsing errors.
- Google Identity Services (GIS) and Google Picker may require specific CSP allowances depending on how their third-party iframes and callback scripts initialize within modern browser sandboxes.
- The project is deployed across multiple static hosting platforms (Render, Vercel, Netlify/Cloudflare), necessitating identical header synchronization across all corresponding configuration files.
