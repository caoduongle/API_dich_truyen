# Feature Specification: Fix CSP Blocking Google OAuth PKCE and Accessibility Defects

**Feature Branch**: `064-fix-csp-oauth-a11y`  
**Created**: 2026-08-23  
**Status**: Draft  
**Input**: User description: "Sửa lỗi CSP đang chặn đăng nhập Google OAuth (PKCE) trong repo API_dich_truyen, kèm 2 lỗi accessibility liên quan phát hiện qua Chrome DevTools."

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Unblock Production Google OAuth PKCE Flow (Priority: P1) 🎯 MVP

**As a** translator using the application in a production environment,  
**I want** the Content Security Policy to permit direct client-side requests to Google's OAuth token and user profile endpoints,  
**So that** I can log in via Google OAuth2 (PKCE) and sync my novel projects to Google Drive without requests being blocked by the browser.

**Why this priority**: Google login is currently completely non-functional in production mode because the browser CSP `connect-src` directive blocks client-side `fetch()` requests to `https://oauth2.googleapis.com` and `https://www.googleapis.com`. This is a P1 blocker for Google Drive synchronization.

**Independent Test**: Can be tested by running the production build with CSP active, initiating Google Sign-In, and confirming that the token exchange and profile retrieval complete successfully with 0 `connect-src` CSP violation errors in the browser console.

**Acceptance Scenarios**:

1. **Given** the application is running in production with CSP enforced, **When** the client initiates Google OAuth2 PKCE callback processing (`handleAuthCallback`), **Then** `fetch('https://oauth2.googleapis.com/token', ...)` succeeds without CSP violation.
2. **Given** the application is running in production with CSP enforced, **When** the client fetches the authenticated user's profile (`fetchUserProfile`), **Then** `fetch('https://www.googleapis.com/oauth2/v3/userinfo', ...)` succeeds without CSP violation.
3. **Given** the server CSP configuration in `server.ts`, **When** inspecting the `connect-src` header in production, **Then** it contains strictly `'self'`, `ws:`, `wss:`, `https://oauth2.googleapis.com`, and `https://www.googleapis.com` (no broad wildcards like `*.googleapis.com`).

---

### User Story 2 - Eliminate CSP Inline Script Violation via Standalone Theme Initializer (Priority: P2)

**As a** user opening the application,  
**I want** the theme (light, dark, or custom color scheme) to initialize before initial paint without inline script execution,  
**So that** I experience no unstyled theme flickering (FOUC) while the application adheres strictly to `script-src 'self'` in production.

**Why this priority**: An inline `<script>` in `<head>` violates production CSP (`script-src 'self'`), causing browser errors (`script-src-elem`). Extracting this script to a static file eliminates the violation cleanly without weakening CSP with `'unsafe-inline'`.

**Independent Test**: Can be tested by loading the production application in a browser and verifying that `/theme-init.js` loads as an external script, applies the stored theme immediately to `document.documentElement`, and produces 0 CSP script execution errors in the console.

**Acceptance Scenarios**:

1. **Given** `index.html` is served in production, **When** the browser parses the `<head>`, **Then** the theme initialization logic loads from `<script src="/theme-init.js"></script>` instead of an inline block.
2. **Given** a user has stored theme preferences or system light/dark mode preference in `localStorage`, **When** the page loads, **Then** `data-theme` and custom CSS variables are set on `document.documentElement` prior to DOM rendering.
3. **Given** strict CSP with `script-src: ["'self'"]`, **When** `theme-init.js` executes, **Then** no CSP policy violation is triggered and no `'unsafe-inline'` keyword is added to `script-src`.

---

### User Story 3 - Accessible Credential Form Controls in Google Sync Modal (Priority: P3)

**As a** user configuring custom Google OAuth credentials in the Google Sync Modal,  
**I want** each form label to be programmatically linked to its corresponding input field,  
**So that** clicking a label activates/focuses the input and screen readers correctly announce the field names.

**Why this priority**: Fixes accessibility defects identified in Chrome DevTools audits without impacting visual design or user interface layout.

**Independent Test**: Can be tested by clicking on the "OAuth Client ID" or "Picker API Key" labels and confirming the respective input field receives keyboard focus, and checking that the DOM contains matching `for`/`htmlFor` and `id` attributes.

**Acceptance Scenarios**:

1. **Given** the Google Sync Modal advanced credentials drawer is open, **When** the user clicks the "OAuth Client ID" label, **Then** focus is placed into the input element with `id="google-oauth-client-id"`.
2. **Given** the Google Sync Modal advanced credentials drawer is open, **When** the user clicks the "Picker API Key" label, **Then** focus is placed into the input element with `id="google-picker-api-key"`.
3. **Given** an automated accessibility audit on `GoogleSyncModal`, **When** evaluating form label associations, **Then** 0 missing label-input association violations are found.

---

### Edge Cases

- **Private / Restricted Storage**: If `localStorage` throws an exception during theme initialization (e.g. strict private browsing settings), `theme-init.js` catches the error silently in a `try...catch` block and defaults safely to dark theme without breaking page rendering.
- **Corrupted Custom Theme JSON**: If `localStorage` contains malformed JSON in `ai_dich_truyen_custom_colors`, `JSON.parse` errors are caught gracefully without uncaught exceptions.
- **Network Failure During OAuth Token Exchange**: If Google API is unreachable, the client catches the fetch error and displays user-friendly error messages through existing error handling in `googleAuthService.ts`.
- **Development vs Production Parity**: In dev mode (`npm run dev`), CSP is disabled to support Vite HMR, and `theme-init.js` in `public/` is served directly at `/theme-init.js`. In production (`vite build`), `theme-init.js` is placed into `dist/` and served with CSP active.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Server CSP in `server.ts` MUST include `https://oauth2.googleapis.com` and `https://www.googleapis.com` in the `connectSrc` directive under `NODE_ENV=production`.
- **FR-002**: Server CSP MUST NOT use wildcards (`*.googleapis.com`) or permit unapproved third-party domains in `connectSrc`.
- **FR-003**: Server CSP MUST NOT add `'unsafe-inline'` to the `scriptSrc` directive.
- **FR-004**: All other existing CSP directives (`defaultSrc`, `scriptSrc`, `styleSrc`, `fontSrc`, `imgSrc`, `objectSrc`, `baseUri`, `formAction`, `frameAncestors`) MUST remain intact and unweakened.
- **FR-005**: The inline theme initialization logic from `index.html` (lines 7–28) MUST be extracted into a standalone JavaScript file at `public/theme-init.js`.
- **FR-006**: `index.html` MUST replace the inline `<script>` with a static script tag: `<script src="/theme-init.js"></script>`.
- **FR-007**: `public/theme-init.js` MUST execute immediately in an IIFE, safely read `ai_dich_truyen_theme` and `ai_dich_truyen_custom_colors` from `localStorage`, apply `data-theme` and custom CSS color properties to `document.documentElement`, and wrap operations in `try...catch`.
- **FR-008**: In `src/components/google-sync/GoogleSyncModal.tsx`, the `<label>` for "OAuth Client ID" MUST have `htmlFor="google-oauth-client-id"` and the corresponding `<input>` MUST have `id="google-oauth-client-id"`.
- **FR-009**: In `src/components/google-sync/GoogleSyncModal.tsx`, the `<label>` for "Picker API Key" MUST have `htmlFor="google-picker-api-key"` and the corresponding `<input>` MUST have `id="google-picker-api-key"`.
- **FR-010**: Form layout, CSS styling, input reveal/hide toggles, reset triggers, and Vietnamese text strings in `GoogleSyncModal.tsx` MUST remain completely unchanged.
- **FR-011**: Zero changes shall be made to client-side PKCE architecture (no token exchange logic shall be moved to backend).
- **FR-012**: Existing security header test suite (`server/__tests__/securityHeaders.test.ts`) MUST be updated to verify the inclusion of the new `connect-src` Google endpoints in production CSP.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of client-side Google OAuth token exchanges (`https://oauth2.googleapis.com`) and user profile fetches (`https://www.googleapis.com`) complete without CSP `connect-src` violations in production mode.
- **SC-002**: 0 inline script CSP errors (`script-src-elem`) reported in browser DevTools on application load.
- **SC-003**: 100% of Google Sync Modal credential input fields have explicit, programmatic label-input associations matching WCAG 2.1 Success Criterion 1.3.1 (Info and Relationships) and 4.1.2 (Name, Role, Value).
- **SC-004**: Quality Gates pass 100%:
  - `npm run lint` (`tsc --noEmit`): 0 errors
  - `npm test` (`vitest run`): 100% passing
  - `npm run build` (`vite build + esbuild server`): 0 build failures

---

## Assumptions

- Google OAuth PKCE token exchange and user profile retrieval endpoints are fixed at `https://oauth2.googleapis.com` and `https://www.googleapis.com`.
- Vite serves files placed in `public/` at the root path (`/theme-init.js`) for both local dev and production builds.
- The DevTools notice "Verify stylesheet URLs" related to Google Fonts does not require CSP modifications at this time, as `styleSrc` and `fontSrc` already allow `fonts.googleapis.com` and `fonts.gstatic.com`. Network status will be audited post-fix.
