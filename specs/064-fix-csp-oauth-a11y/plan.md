# Implementation Plan: Fix CSP Blocking Google OAuth PKCE and Accessibility Defects

**Branch**: `064-fix-csp-oauth-a11y` | **Date**: 2026-08-23 | **Spec**: [`specs/064-fix-csp-oauth-a11y/spec.md`](./spec.md)

---

## 1. Summary

Fix production Content Security Policy (CSP) blocking client-side Google OAuth2 PKCE login by adding `https://oauth2.googleapis.com` and `https://www.googleapis.com` to `connectSrc`, resolve CSP inline script violation by extracting theme initialization logic from `index.html` to `public/theme-init.js`, and remediate 2 accessibility label-input association defects in `GoogleSyncModal.tsx`.

---

## 2. Technical Context

- **Language/Version**: TypeScript 5.8+, Node.js 20+, React 19
- **Primary Dependencies**: Express 4.x, Helmet 8.x, Tailwind CSS v4, Lucide React
- **Storage**: Client-side IndexedDB & localStorage (`ai_dich_truyen_theme`, `ai_dich_truyen_custom_colors`)
- **Testing**: Vitest (`server/__tests__/securityHeaders.test.ts`)
- **Target Platform**: Node.js Express backend + Static SPA client (Vite)
- **Project Type**: Full-stack Web Application
- **Performance Goals**: Zero FOUC (flash of unstyled content) on theme initialization; instant client-side OAuth redirect handling
- **Constraints**: 
  - Zero server storage of Google credentials (Zero-Knowledge PKCE architecture)
  - No `'unsafe-inline'` in production `scriptSrc`
  - No new NPM packages
  - No modifications to translation pipeline, database schemas, or user-facing Vietnamese strings

---

## 3. Constitution Check

| Principle / Rule | Evaluation | Status |
|---|---|---|
| **I. Strict Quality Gates** | `npm run lint`, `npm test`, `npm run build` must all pass with 0 errors. | ✅ PASS |
| **II. Dependency Minimization** | Zero new dependencies added. | ✅ PASS |
| **III. Concern Separation** | Changes isolated strictly to CSP header config, static entry script, and modal accessibility DOM attributes. No translation logic altered. | ✅ PASS |
| **IV. Immutable Schemas** | No changes to `src/types.ts` or IndexedDB. No user-facing text modifications. | ✅ PASS |
| **V. Atomic Scope** | Strictly limited to the 3 requested tasks. | ✅ PASS |

---

## 4. Project Structure

### Documentation (this feature)

```text
specs/064-fix-csp-oauth-a11y/
├── plan.md              # Implementation Plan
├── research.md          # Phase 0 Research & Decisions
├── data-model.md        # Phase 1 Data Model & Configuration Schemas
├── quickstart.md        # Phase 1 Verification Guide
├── contracts/           # Phase 1 HTTP Response Header Contract
│   └── csp-header.md
└── checklists/          # Feature Checklists
    └── requirements.md
```

### Source Code Modifications

```text
server.ts                                           # Update connectSrc in helmet CSP
server/__tests__/securityHeaders.test.ts            # Update test assertions for connectSrc
public/theme-init.js                                # [NEW] Extracted standalone theme initialization script
index.html                                          # Replace inline script with <script src="/theme-init.js">
src/components/google-sync/GoogleSyncModal.tsx      # Add htmlFor and id to Client ID and Picker Key fields
```

---

## 5. Implementation Steps

### Phase 1: Server CSP Allowlist Update (Task 1)
- In `server.ts` line 34:
  - Add `"https://oauth2.googleapis.com"` and `"https://www.googleapis.com"` to `connectSrc` array.
- In `server/__tests__/securityHeaders.test.ts`:
  - Update `createTestApp` and test assertions to include the two Google domains in `connect-src`.

### Phase 2: Theme Initialization Script Extraction (Task 2)
- Create `public/theme-init.js` containing the IIFE that reads `ai_dich_truyen_theme` and `ai_dich_truyen_custom_colors` from `localStorage` and applies them to `document.documentElement`.
- In `index.html` lines 7–28:
  - Remove the inline `<script>...</script>` block.
  - Insert `<script src="/theme-init.js"></script>`.

### Phase 3: Accessibility Binding in GoogleSyncModal (Task 3)
- In `src/components/google-sync/GoogleSyncModal.tsx`:
  - Line 325: Add `htmlFor="google-oauth-client-id"` to the "OAuth Client ID" `<label>`.
  - Line 346: Add `id="google-oauth-client-id"` to the Client ID `<input>`.
  - Line 371: Add `htmlFor="google-picker-api-key"` to the "Picker API Key" `<label>`.
  - Line 392: Add `id="google-picker-api-key"` to the Picker API Key `<input>`.

### Phase 4: Quality Gate Verification
- Run `npm run lint` (`tsc --noEmit`).
- Run `npm test` (`vitest run`).
- Run `npm run build` (`vite build && esbuild server.ts`).
- Perform DevTools verification check for stylesheet notice.
