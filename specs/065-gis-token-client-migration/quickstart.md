# Quickstart: GIS Token Client Migration Validation

**Feature**: 065-gis-token-client-migration
**Date**: 2026-08-23

---

## Prerequisites

1. Node.js ≥ 18 installed
2. `npm install` completed at repo root
3. A Google Cloud OAuth Client ID (type "Web application") with:
   - **Authorized JavaScript origins** including `http://localhost:5173`
   - (Optional) `VITE_GOOGLE_CLIENT_ID` set in `.env` file

## Automated Verification

Run these three commands — all must pass with zero errors:

```bash
# 1. Type-check (no emit)
npm run lint

# 2. Unit tests
npm test

# 3. Production build
npm run build
```

### Expected Outcomes

| Command | Expectation |
|---------|-------------|
| `npm run lint` | Zero type errors. No references to `pkceHelper`, `PKCEChallenge`, `handleAuthCallback`, `GOOGLE_AUTH_ENDPOINT`, `GOOGLE_TOKEN_ENDPOINT` |
| `npm test` | All tests pass. `pkceHelper.test.ts` no longer exists — test count decreases by its previous count |
| `npm run build` | Clean build. No missing imports, no dead code references |

### Negative Verification (must NOT exist)

```bash
# Must return 0 results
grep -r "pkceHelper\|generateCodeVerifier\|generateCodeChallenge\|PKCEChallenge" src/
grep -r "GOOGLE_CLIENT_SECRET" .
grep -r "/api/auth/google" .
grep -r "PKCE_STATE_KEY\|PKCE_VERIFIER_KEY" src/
```

## Manual End-to-End Verification

### Setup

```bash
npm run dev
# Open http://localhost:5173 in browser
```

### Scenario 1: Login via Popup

1. Open the Google Drive Sync modal
2. Click "Đăng nhập với Google"
3. **Verify**: A popup window opens (NOT a full page redirect)
4. Select a Google account and grant permissions
5. **Verify**: Popup closes automatically
6. **Verify**: Modal shows user profile (name, email, avatar)
7. **Verify**: Browser console shows no CSP errors
8. **Verify**: Network tab shows NO request to `oauth2.googleapis.com/token`

### Scenario 2: Custom Client ID

1. In the modal advanced section, enter a different valid Client ID
2. Click "Đăng nhập với Google"
3. **Verify**: Popup shows the consent screen for the custom Client ID
4. Complete login
5. **Verify**: Profile displays correctly
6. Refresh page → **Verify**: Custom Client ID is preserved in advanced section

### Scenario 3: Logout + Revoke

1. While logged in, click "Đăng xuất"
2. **Verify**: UI returns to unauthenticated state
3. **Verify**: Network tab shows a revoke request (best effort)

### Scenario 4: Missing Client ID

1. Clear `VITE_GOOGLE_CLIENT_ID` from `.env` and clear custom Client ID from localStorage
2. Click "Đăng nhập với Google"
3. **Verify**: Error message about missing Client ID (no popup opens)

### Scenario 5: Google Picker Still Works

1. Log in successfully
2. Use the Google Picker feature (if available in UI)
3. **Verify**: Picker dialog opens correctly (CSP now allows `apis.google.com`)

## CSP Verification

Open browser DevTools Console after the app loads in production mode (`npm run build && npm run preview` or deploy):

```bash
# Should see NO errors like:
# "Refused to load the script 'https://accounts.google.com/gsi/client'"
# "Refused to load the script 'https://apis.google.com/js/api.js'"
# "Refused to frame 'https://accounts.google.com/...'"
```

## Files Changed Summary

| File | Change |
|------|--------|
| `src/services/googleAuthService.ts` | Full rewrite: PKCE redirect → GIS Token Client popup |
| `src/services/pkceHelper.ts` | Deleted |
| `src/services/__tests__/pkceHelper.test.ts` | Deleted |
| `src/types/googleAuth.ts` | Removed `PKCEChallenge` interface |
| `src/App.tsx` | Removed redirect callback `useEffect` + unused import |
| `server.ts` | CSP: added `scriptSrc` domains + `frameSrc` |

See [data-model.md](./data-model.md) for entity and storage details.
See [research.md](./research.md) for technical decisions and rationale.
