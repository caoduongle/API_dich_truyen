# Research: GIS Token Client Migration

**Feature**: 065-gis-token-client-migration
**Date**: 2026-08-23

---

## R1: Google Identity Services Token Client vs Authorization Code + PKCE

**Decision**: Use `google.accounts.oauth2.initTokenClient` (GIS Token Client, implicit grant variant) instead of Authorization Code + PKCE redirect flow.

**Rationale**:
- Google OAuth Client IDs of type "Web application" **always** require `client_secret` when exchanging an authorization code for tokens at `oauth2.googleapis.com/token`, even with PKCE. This is by design — Google treats Web application clients as confidential clients.
- The only way to avoid `client_secret` on the client-side is to use the GIS Token Client, which returns `access_token` directly to a JavaScript callback via popup — no code exchange step exists.
- GIS is Google's officially recommended library for browser-based OAuth, replacing the deprecated `gapi.auth2` approach.

**Alternatives Considered**:
1. **Server-proxy holding `client_secret`**: Viable but adds backend complexity, requires secure secret storage, and couples frontend auth to server availability. Explicitly rejected by user.
2. **Chrome extension-style OAuth (PKCE with "Chrome app" client type)**: Not applicable — this is a web application, not a browser extension.
3. **Google Sign-In for Web (legacy `gapi.auth2`)**: Deprecated by Google; GIS is the replacement.

---

## R2: GIS Script Loading Pattern

**Decision**: Load GIS script dynamically via `document.createElement('script')` with `src="https://accounts.google.com/gsi/client"`, exactly like `googlePickerService.ts` already does for `https://apis.google.com/js/api.js`.

**Rationale**:
- Consistent with existing codebase pattern (no npm package for Google APIs)
- Script is loaded once and cached for session via a `gsiLoadingPromise` singleton
- Avoids adding `<script>` to `index.html` — only loaded when auth is actually needed

**Alternatives Considered**:
1. **npm package `google-one-tap` or `@react-oauth/google`**: Adds npm dependency, violates Constitution Principle II. The official GIS CDN script is sufficient.
2. **Static `<script>` in `index.html`**: Loads script for all users even if they never use Google auth. Dynamic loading is more efficient.

---

## R3: Token Client Callback Behavior

**Decision**: Wrap `initTokenClient` + `requestAccessToken` in a `Promise<void>` to match the existing `initiateLogin()` signature.

**Rationale**:
- `GoogleSyncModal.tsx`'s `handleLogin()` calls `await googleAuthService.initiateLogin()` — the Promise must resolve on success and reject on error.
- GIS Token Client uses a callback pattern (`callback: (tokenResponse) => {}`), so we wrap it in a Promise that resolves/rejects inside the callback.
- `requestAccessToken({ prompt: 'select_account' })` triggers the popup.

**Alternatives Considered**:
1. **Change `initiateLogin()` to event-based (fire and forget + listener)**: Would require changing `GoogleSyncModal.tsx`, violating scope boundary. Keeping Promise-based API.

---

## R4: CSP Requirements for GIS

**Decision**: Add `https://accounts.google.com` and `https://apis.google.com` to `scriptSrc`; add `frameSrc: ["https://accounts.google.com"]`.

**Rationale**:
- GIS loads from `accounts.google.com` — must be in `scriptSrc`
- `apis.google.com` is needed for Google Picker (`googlePickerService.ts` already loads from there) — currently blocked silently by CSP
- GIS may use hidden iframes for session checks — `frameSrc` is needed
- Keep `connectSrc` unchanged — `oauth2.googleapis.com` may be called internally by GIS library

**Alternatives Considered**:
1. **Only add `accounts.google.com`**: Would leave Picker broken (it was already broken silently). Fix both in one pass.
2. **Remove `oauth2.googleapis.com` from `connectSrc`**: Risky — GIS may call it internally. Safe to leave.

---

## R5: Token Revocation on Logout

**Decision**: Call `google.accounts.oauth2.revoke(accessToken, callback)` on logout (best effort, non-blocking).

**Rationale**:
- GIS provides a `revoke()` function that invalidates the token server-side
- Wrapped in try/catch — failure doesn't block local logout
- Better security hygiene than just clearing local state

**Alternatives Considered**:
1. **Direct fetch to `https://oauth2.googleapis.com/revoke`**: Works but GIS provides a convenience method. Use the library's API.
2. **Don't revoke, just clear local state**: Less secure. Token would remain valid on Google's side until natural expiry.

---

## R6: Dead Code Verification (PKCE References)

**Decision**: Safe to delete `pkceHelper.ts`, `pkceHelper.test.ts`, and `PKCEChallenge` interface.

**Rationale** (grep results):
- `pkceHelper` is imported ONLY by `googleAuthService.ts` (being rewritten) and its own test file
- `PKCEChallenge` is imported ONLY by `pkceHelper.ts`
- `generateCodeVerifier`, `generateCodeChallenge`, `generatePKCEChallenge` have zero external consumers
- No other module in `src/` references any PKCE functionality

---

## R7: App.tsx Redirect Callback Cleanup

**Decision**: Remove the `useEffect` block (lines 96-111) that handles `code`/`state` URL params. Conditionally remove the `googleAuthService` import if unused elsewhere in App.tsx.

**Rationale**:
- Grep confirms `googleAuthService` in `App.tsx` appears ONLY at:
  - Line 32: import statement
  - Line 103: `googleAuthService.handleAuthCallback(...)` inside the useEffect being removed
- After removing the useEffect, the import has zero remaining usages → remove it too
- `setShowGoogleSyncModal` (line 105) is still used elsewhere in App.tsx via other triggers — only the `googleAuthService` reference becomes orphaned

---

## All NEEDS CLARIFICATION: Resolved

No unresolved clarifications. All technical decisions are backed by codebase evidence and Google documentation.
