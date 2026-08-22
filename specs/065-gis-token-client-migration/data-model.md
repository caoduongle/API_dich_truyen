# Data Model: GIS Token Client Migration

**Feature**: 065-gis-token-client-migration
**Date**: 2026-08-23

---

## Entities

This feature does not introduce new data entities. It modifies the authentication *flow* while preserving existing data structures.

### Preserved Entities (No Changes)

#### GoogleUserProfile
**Source**: `src/types/googleAuth.ts`

| Field | Type | Description |
|-------|------|-------------|
| id | string | Google user sub/id |
| email | string | User email address |
| name | string | Display name |
| picture | string | Profile picture URL |

**Validation**: Populated from `googleapis.com/oauth2/v3/userinfo` response. Falls back to empty strings if fields missing.

#### GoogleAuthState
**Source**: `src/types/googleAuth.ts`

| Field | Type | Description |
|-------|------|-------------|
| isAuthenticated | boolean | Whether user is currently logged in |
| accessToken | string \| null | Current OAuth access token |
| expiresAt | number \| null | Token expiry timestamp (ms since epoch) |
| user | GoogleUserProfile \| null | Logged-in user profile |
| clientId | string | Active OAuth Client ID |
| error | string \| null | Last error message |

**State transitions**:
```
[Unauthenticated] --initiateLogin()--> [Popup Open] --callback success--> [Authenticated]
[Unauthenticated] --initiateLogin()--> [Popup Open] --callback error----> [Unauthenticated + error]
[Authenticated]   --logout()---------> [Unauthenticated]
[Authenticated]   --token expired----> [Unauthenticated] (via getValidAccessToken())
```

### Removed Entity

#### PKCEChallenge (DELETED)
**Source**: `src/types/googleAuth.ts` (to be removed)

| Field | Type | Description |
|-------|------|-------------|
| codeVerifier | string | PKCE code verifier |
| codeChallenge | string | SHA-256 hashed challenge |
| state | string | CSRF protection state |

**Reason for removal**: No longer needed — GIS Token Client handles CSRF internally via popup origin validation.

### Storage Locations (Unchanged)

| Storage | Key | Content | Lifetime |
|---------|-----|---------|----------|
| sessionStorage | `ai_dich_truyen_google_auth` | `{ accessToken, expiresAt, user }` | Browser tab session |
| localStorage | `ai_dich_truyen_google_client_id` | Custom Client ID string | Persistent |

**Removed storage keys** (PKCE, no longer written):

| Storage | Key | Previously Stored |
|---------|-----|------------------|
| sessionStorage | `ai_dich_truyen_pkce_state` | CSRF state for redirect flow |
| sessionStorage | `ai_dich_truyen_pkce_verifier` | PKCE code verifier |

### New Internal State (Service-level, not persisted)

| Property | Type | Description |
|----------|------|-------------|
| `tokenClient` | `any` | GIS TokenClient instance, reset when Client ID changes |
| `gsiLoadingPromise` | `Promise<void> \| null` | Singleton promise for script loading deduplication |
