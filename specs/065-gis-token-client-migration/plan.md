# Implementation Plan: GIS Token Client Migration

**Branch**: `065-gis-token-client-migration` | **Date**: 2026-08-23 | **Spec**: [spec.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/065-gis-token-client-migration/spec.md)

**Input**: Feature specification from `specs/065-gis-token-client-migration/spec.md`

## Summary

Replace the Google OAuth Authorization Code + PKCE redirect flow with Google Identity Services (GIS) Token Client popup flow, eliminating the `client_secret` requirement entirely. The GIS library is loaded dynamically via `<script>` from `https://accounts.google.com/gsi/client`, and returns `access_token` directly to a JS callback — no code-for-token exchange needed. Dead PKCE code is removed, redirect callback handling in App.tsx is deleted, and CSP is updated to allow GIS scripts and iframes.

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js (Express backend)

**Primary Dependencies**: React 19, Vite, Express, ioredis, Google Identity Services (CDN script — no npm package)

**Storage**: IndexedDB (client-side, untouched), sessionStorage (auth session), localStorage (custom Client ID)

**Testing**: Vitest (unit tests), `tsc --noEmit` (type checking)

**Target Platform**: Web (SPA) — modern browsers (Chrome, Firefox, Edge, Safari)

**Project Type**: Web application (monorepo: React frontend + Express backend in `server/`)

**Performance Goals**: Login popup completes in <30 seconds; no page navigation during auth

**Constraints**: No new npm dependencies; no `client_secret` in codebase; preserve `getAccessToken()` behavior for `useChapterCRDT.ts`

**Scale/Scope**: Single service file rewrite + 4 supporting file changes

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Justification |
|-----------|--------|---------------|
| I. Strict Quality Gates | ✅ PASS | Will run `npm run lint`, `npm test`, `npm run build` after implementation |
| II. Dependency Minimization | ✅ PASS | No new npm dependencies — GIS loads via CDN `<script>` tag, same pattern as `googlePickerService.ts` |
| III. Concern Separation | ✅ PASS | Only auth service (frontend), types cleanup, App.tsx callback removal, and CSP config (server). No Gemini API or translation pipeline changes |
| IV. Immutable Core Schemas | ✅ PASS | `src/types.ts` and IndexedDB schemas untouched. Only removing dead `PKCEChallenge` interface from `src/types/googleAuth.ts` |
| V. Atomic Commits | ✅ PASS | Single focused change: OAuth flow migration. All file changes serve one purpose |

**Gate Result**: ✅ ALL PASS — proceed to Phase 0

## Project Structure

### Documentation (this feature)

```text
specs/065-gis-token-client-migration/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
└── tasks.md             # Phase 2 output (via /speckit-tasks)
```

### Source Code (repository root)

```text
src/
├── services/
│   ├── googleAuthService.ts    # [REWRITE] Replace PKCE redirect → GIS Token Client popup
│   ├── pkceHelper.ts           # [DELETE] Dead code after migration
│   ├── googlePickerService.ts  # [UNCHANGED] Already loads apis.google.com — CSP fix enables it
│   └── __tests__/
│       └── pkceHelper.test.ts  # [DELETE] Tests for deleted module
├── types/
│   └── googleAuth.ts           # [MODIFY] Remove PKCEChallenge interface
├── App.tsx                     # [MODIFY] Remove redirect callback useEffect + conditional import cleanup
├── hooks/
│   └── useChapterCRDT.ts       # [UNCHANGED] Depends on getAccessToken() — behavior preserved
└── components/
    └── google-sync/
        └── GoogleSyncModal.tsx  # [UNCHANGED] handleLogin() compatible with new initiateLogin()

server.ts                       # [MODIFY] CSP: add scriptSrc domains + frameSrc
```

**Structure Decision**: Web application monorepo. Changes span frontend service layer (auth flow), types cleanup, and server CSP configuration. No structural changes.

## Complexity Tracking

> No constitution violations — table not applicable.
