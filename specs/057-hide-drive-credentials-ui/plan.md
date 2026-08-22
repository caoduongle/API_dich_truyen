# Implementation Plan: Hide Default Google Drive Credentials in UI

**Branch**: `057-hide-drive-credentials-ui` | **Date**: 2026-08-22 | **Spec**: [`specs/057-hide-drive-credentials-ui/spec.md`](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/057-hide-drive-credentials-ui/spec.md)

**Input**: Feature specification from `/specs/057-hide-drive-credentials-ui/spec.md`

## Summary

Refactor the Google OAuth Client ID and Google Picker API Key section in `GoogleSyncModal.tsx` to hide raw credential strings from the default view for standard users. Replace them with clean status indicators ("Đã cấu hình sẵn" / "Tùy chỉnh riêng") and a subtle collapsible "Cấu hình nâng cao" panel. Inputs in the advanced panel will use `type="password"` by default with `Eye`/`EyeOff` reveal toggles, adhering to the established pattern in `ApiSettings.tsx` and the "Mực & Chu Sa" design system.

---

## Technical Context

**Language/Version**: TypeScript 5.8.2 / React 19.0.1  
**Primary Dependencies**: React 19, Lucide React, Tailwind CSS v4, `clsx`, `tailwind-merge`  
**Storage**: Client-side `localStorage` (`ai_dich_truyen_google_client_id`, `ai_dich_truyen_google_picker_key`)  
**Testing**: Vitest 4.1.9 (`npm test`), TypeScript `tsc --noEmit` (`npm run lint`), Vite 6.2.3 build (`npm run build`)  
**Target Platform**: Web (Desktop & Mobile responsive)  
**Project Type**: React Single Page Application  
**Performance Goals**: Instant modal render (< 16ms), smooth collapsible animation  
**Constraints**: 
- DO NOT modify backend routes in `server/` or API clients.
- DO NOT alter OAuth 2.0 PKCE flow in `src/services/googleAuthService.ts` or Picker logic in `src/services/googlePickerService.ts`.
- Strictly adhere to `.agents/rules/design-system.md` (no hard-coded hex colors, use `rounded-[2px]`, `Badge`, `Button`).  
**Scale/Scope**: 1 UI file modified (`src/components/google-sync/GoogleSyncModal.tsx`) + 1 test file (`src/components/google-sync/__tests__/GoogleSyncModal.test.tsx`).

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **I. Strict Quality Gates & Verification**: `tsc --noEmit`, `vitest run`, and `vite build` will pass cleanly.
- [x] **II. Dependency Minimization & Existing Library Reuse**: Reuses existing UI components (`Button`, `Badge`), icons (`Eye`, `EyeOff`, `CheckCircle2`, `ChevronDown`, `ChevronUp`, `RotateCcw`), and utilities (`cn`).
- [x] **III. Strict Concern Separation & Domain Boundary Preservation**: Purely frontend UI change inside `GoogleSyncModal.tsx`. No backend or Gemini pipeline changes.
- [x] **IV. Immutable Core Schemas & Storage Stability**: Core types and IndexedDB schemas unchanged.
- [x] **V. Atomic Commits & Documentation Synchronization**: Single, isolated feature diff.

---

## Project Structure

### Documentation (this feature)

```text
specs/057-hide-drive-credentials-ui/
├── plan.md              # Implementation plan (this document)
├── research.md          # Phase 0: UX problem and architecture decisions
├── data-model.md        # Phase 1: Credential resolution model
├── quickstart.md        # Phase 1: Verification scenarios
├── contracts/           # Phase 1: Interface contracts
│   └── google-sync-modal.contract.md
├── checklists/
│   └── requirements.md  # Quality checklist
└── spec.md              # Feature specification
```

### Source Code Layout

```text
src/
└── components/
    └── google-sync/
        ├── GoogleSyncModal.tsx                  # [MODIFY] Hide raw keys, add status badges, collapsible masked inputs
        └── __tests__/
            └── GoogleSyncModal.test.tsx         # [NEW/MODIFY] Unit tests for credential privacy & masking
```

**Structure Decision**: Targeted modification to `src/components/google-sync/GoogleSyncModal.tsx`.

---

## Proposed Changes

### Component: `src/components/google-sync/GoogleSyncModal.tsx`

1. **State additions**:
   - `showAdvanced: boolean` (default `false` if `googleAuthService.getClientId()` is present; `true` if empty).
   - `showClientId: boolean` (default `false` - masked).
   - `showPickerKey: boolean` (default `false` - masked).
   - Helpers to detect whether current credentials originate from `localStorage` custom override vs default environment variables.

2. **Default Status Bar**:
   - Render a unified, compact **"Cấu hình Google Cloud"** section:
     - Shows `Badge` with `tone="neutral"` and text `"Đã cấu hình sẵn"` (with `CheckCircle2` icon) when default environment variables are used.
     - Shows `Badge` with `tone="polish"` and text `"Tùy chỉnh riêng"` when custom localStorage keys are present.
     - Shows `Badge` with `tone="warning"` and text `"Chưa cấu hình"` if no keys exist.
   - An intuitive expand/collapse toggle: `"Tùy chỉnh nâng cao..."` with `ChevronDown` / `ChevronUp` icon.

3. **Collapsible Advanced Drawer**:
   - **OAuth Client ID Input**:
     - Label: "Google OAuth Client ID"
     - Input field with `type={showClientId ? 'text' : 'password'}` in `bg-ink` with `font-mono`.
     - `Eye` / `EyeOff` button.
     - Action buttons: "Lưu Client ID" (`Button variant="primary"`) + "Khôi phục mặc định" (`Button variant="ghost"` or `variant="secondary"` if custom key exists).
   - **Google Picker API Key Input**:
     - Label: "Google Picker API Key (Dùng mở dự án được chia sẻ)"
     - Input field with `type={showPickerKey ? 'text' : 'password'}` in `bg-ink` with `font-mono`.
     - `Eye` / `EyeOff` button.
     - Action buttons: "Lưu Picker Key" (`Button variant="primary"`) + "Khôi phục mặc định" if custom key exists.

---

## Verification Plan

### Automated Tests
```bash
npm run lint    # tsc --noEmit: Must pass with 0 errors
npm test        # vitest run: All tests must pass
npm run build   # vite build + esbuild: Must build successfully
```

### Manual Browser Verification
- Launch app (`npm run dev`), open Google Sync modal via "Đồng bộ Drive":
  1. Verify raw Client ID and Picker Key strings are NOT visible in default view.
  2. Verify "Đã cấu hình sẵn" badge is visible.
  3. Expand advanced settings: verify inputs are masked (`type="password"`).
  4. Toggle `Eye`/`EyeOff` icons: verify masking switches smoothly.
  5. Test saving a custom key and clicking "Khôi phục mặc định".
  6. Verify Google OAuth login and Google Picker flow triggers without error.
