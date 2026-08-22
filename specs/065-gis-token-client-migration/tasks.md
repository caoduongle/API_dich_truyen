# Tasks: GIS Token Client Migration

**Feature**: 065-gis-token-client-migration
**Branch**: `065-gis-token-client-migration`
**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

---

## Phase 1: Pre-Flight Verification

**Purpose**: Confirm no server-proxy residue exists and verify PKCE references are isolated before making changes.

- [X] T001 Grep for `GOOGLE_CLIENT_SECRET` across entire repo — must return 0 matches
- [X] T002 Grep for `/api/auth/google` across entire repo — must return 0 matches; if found, revert/delete the server-proxy route and related code before proceeding
- [X] T003 Grep for `pkceHelper|generateCodeVerifier|generateCodeChallenge|PKCEChallenge` in `src/` — confirm references are limited to `src/services/pkceHelper.ts`, `src/services/__tests__/pkceHelper.test.ts`, `src/services/googleAuthService.ts`, and `src/types/googleAuth.ts` only

**Checkpoint**: Codebase is clean — no server-proxy code, PKCE references are isolated to expected files.

---

## Phase 2: Core Auth Service Rewrite (US1 — Đăng nhập thành công qua popup)

**Goal**: Replace the entire PKCE redirect auth flow with GIS Token Client popup flow. This is the single largest change and unblocks all other tasks.

**Independent Test**: `npm run lint` passes; `googleAuthService.ts` compiles with no type errors; no references to PKCE remain in this file.

### Implementation

- [X] T004 [US1] Rewrite `src/services/googleAuthService.ts` — replace entire file content with GIS Token Client implementation per spec (remove PKCE imports/constants/methods, add `ensureGsiLoaded()`, rewrite `initiateLogin()` to use `google.accounts.oauth2.initTokenClient` + popup, update `logout()` to call `google.accounts.oauth2.revoke()`, add `tokenClient` and `gsiLoadingPromise` private fields, reset `tokenClient` on `setClientId()`)
- [X] T005 [US1] Verify preserved public API surface: confirm `getAccessToken()` returns `this.state.accessToken` without expiry check, `getValidAccessToken()` checks expiry, `initiateLogin()` returns `Promise<void>`, `fetchUserProfile()` unchanged, `onAuthStateChanged()` unchanged, `getInitialClientId/setClientId/getClientId/getCustomClientId` unchanged

**Checkpoint**: Auth service compiles, uses GIS popup flow, preserves all public method signatures.

---

## Phase 3: Dead Code Removal (US2 — Xoá code PKCE)

**Goal**: Remove all PKCE-related dead code now that the auth service no longer references it.

**Independent Test**: `npm run lint` and `npm test` pass; grep for `pkceHelper|PKCEChallenge` in `src/` returns 0 matches.

### Implementation

- [X] T006 [P] [US2] Delete file `src/services/pkceHelper.ts`
- [X] T007 [P] [US2] Delete file `src/services/__tests__/pkceHelper.test.ts`
- [X] T008 [US2] Remove `PKCEChallenge` interface from `src/types/googleAuth.ts` — keep `GoogleUserProfile` and `GoogleAuthState` interfaces intact
- [X] T009 [US2] Verify: grep for `pkceHelper|generateCodeVerifier|generateCodeChallenge|PKCEChallenge|PKCE_STATE_KEY|PKCE_VERIFIER_KEY` in `src/` returns 0 matches

**Checkpoint**: All PKCE code is gone. Types file retains only `GoogleUserProfile` and `GoogleAuthState`.

---

## Phase 4: Redirect Callback Cleanup (US3 — Xoá xử lý redirect callback)

**Goal**: Remove the OAuth redirect callback useEffect from App.tsx since popup flow doesn't use URL params.

**Independent Test**: `npm run lint` passes; App.tsx has no references to `handleAuthCallback`, `code`, or `state` URL params.

### Implementation

- [X] T010 [US3] Remove the `useEffect` block in `src/App.tsx` that handles Google OAuth redirect callback (the block checking `urlParams.get('code')` and `urlParams.get('state')` and calling `googleAuthService.handleAuthCallback`)
- [X] T011 [US3] Grep for `googleAuthService` in `src/App.tsx` — if the import at line 32 has no remaining usages after removing the useEffect, delete the import line; if still used elsewhere in file, keep it

**Checkpoint**: App.tsx no longer processes OAuth redirect params. Clean compile.

---

## Phase 5: CSP Configuration (US4 — Cập nhật Content Security Policy)

**Goal**: Update server CSP to allow GIS scripts, Google APIs scripts (for Picker), and GIS iframes.

**Independent Test**: `npm run build` passes; CSP directives in `server.ts` include the new domains.

### Implementation

- [X] T012 [US4] In `server.ts`, update `scriptSrc` from `["'self'"]` to `["'self'", "https://accounts.google.com", "https://apis.google.com"]` in the helmet CSP directives
- [X] T013 [US4] In `server.ts`, add `frameSrc: ["https://accounts.google.com"]` to the CSP directives object (same level as `scriptSrc`, `connectSrc`, etc.)
- [X] T014 [US4] Verify `connectSrc` still contains `"https://oauth2.googleapis.com"` and `"https://www.googleapis.com"` — do NOT remove them

**Checkpoint**: CSP allows GIS script loading, Google APIs script loading, and GIS iframe usage.

---

## Phase 6: Polish & Verification

**Purpose**: Run all mandatory quality gates and perform final dead code sweep.

- [X] T015 Run `npm run lint` (`tsc --noEmit`) — must pass with zero errors
- [X] T016 Run `npm test` (`vitest run`) — must pass all remaining tests (pkceHelper tests no longer exist)
- [X] T017 Run `npm run build` (`vite build` + `esbuild server`) — must succeed
- [X] T018 Final negative grep verification: confirm 0 matches for `GOOGLE_CLIENT_SECRET`, `/api/auth/google`, `pkceHelper`, `PKCEChallenge`, `handleAuthCallback`, `GOOGLE_AUTH_ENDPOINT`, `GOOGLE_TOKEN_ENDPOINT`, `PKCE_STATE_KEY`, `PKCE_VERIFIER_KEY` across entire `src/`
- [X] T019 Document post-deployment manual step for user: Google Cloud Console → Credentials → OAuth Client ID → add "Authorized JavaScript origins" (`http://localhost:5173` for dev, production origin for prod)

**Checkpoint**: All quality gates pass. Codebase is clean. User is informed of manual configuration step.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Pre-Flight)**: No dependencies — start immediately
- **Phase 2 (Auth Service Rewrite)**: Depends on Phase 1 passing clean
- **Phase 3 (Dead Code Removal)**: Depends on Phase 2 (auth service must no longer import pkceHelper)
- **Phase 4 (Redirect Callback Cleanup)**: Depends on Phase 2 (auth service must no longer have `handleAuthCallback`)
- **Phase 5 (CSP Configuration)**: Independent of Phases 2-4 (server.ts change)
- **Phase 6 (Verification)**: Depends on ALL previous phases completing

### Parallel Opportunities

- **Phase 3 + Phase 4 + Phase 5** can all run in parallel after Phase 2 completes
- Within Phase 3: T006 and T007 (file deletions) can run in parallel
- T012 and T013 (CSP changes) are in the same file — must be sequential

### User Story Dependencies

- **US1 (Popup Login)**: Blocks US2 and US3 — auth service must be rewritten first
- **US2 (PKCE Removal)**: Independent of US3 and US4
- **US3 (Redirect Cleanup)**: Independent of US2 and US4
- **US4 (CSP Update)**: Independent of US2 and US3 — can run in parallel after US1

---

## Parallel Example: After Phase 2

```text
# After T004-T005 complete, launch in parallel:

Agent A (Phase 3 - Dead Code):
  T006: Delete src/services/pkceHelper.ts
  T007: Delete src/services/__tests__/pkceHelper.test.ts
  T008: Remove PKCEChallenge from src/types/googleAuth.ts
  T009: Verify grep clean

Agent B (Phase 4 - App.tsx):
  T010: Remove redirect callback useEffect
  T011: Clean up unused import

Agent C (Phase 5 - CSP):
  T012: Update scriptSrc
  T013: Add frameSrc
  T014: Verify connectSrc preserved
```

---

## Implementation Strategy

### MVP First (Phase 1 + Phase 2)

1. Complete Phase 1: Pre-flight verification
2. Complete Phase 2: Auth service rewrite
3. **STOP and VALIDATE**: `npm run lint` should pass; popup login should work
4. This alone fixes the core `client_secret` problem

### Incremental Delivery

1. Phase 1 + 2 → Auth works via popup (MVP!)
2. + Phase 3 → Dead PKCE code removed (cleanliness)
3. + Phase 4 → Redirect callback removed (cleanliness)
4. + Phase 5 → CSP correct for production (security)
5. + Phase 6 → All gates pass, ready to ship

---

## Notes

- [P] tasks = different files, no dependencies
- [US*] label maps task to specific user story for traceability
- T004 is the largest task (full file rewrite) — user provided exact file content in the original request
- Tests are not separately generated because this feature removes test files (pkceHelper.test.ts) rather than adding new ones; the existing GoogleSyncModal tests continue to pass unchanged
- No new npm dependencies are added
- The `declare const google: any;` in the rewritten auth service handles the GIS global type
