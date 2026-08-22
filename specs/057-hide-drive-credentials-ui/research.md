# Research & UI Architecture: Hide Google Drive Credentials

## 1. Context & UX Problem

### Current State
`GoogleSyncModal.tsx` directly renders:
- The full Google OAuth Client ID string (e.g. `123456789-abcdef.apps.googleusercontent.com`)
- The full Google Picker API Key string (e.g. `AIzaSy...`)
- A prominent "Thay đổi" (Change) link next to each header.

### User Perception & Security Distinction
- While Google OAuth Client IDs and browser-restricted Picker API Keys are client-side public identifiers by design, rendering them as raw plain text creates anxiety that credentials are being "exposed" or require user maintenance.
- In `ApiSettings.tsx`, all AI API keys are masked by default (`type="password"`) with an `Eye`/`EyeOff` toggle button and visual status indicators.

---

## 2. Architectural & UI Decisions

### Decision 1: Consolidated Status Indicator & Collapsible Advanced Settings
- **Decision**: Replace the two verbose raw text boxes with a clean, high-level status indicator in the main sync modal, coupled with a collapsible "Cấu hình nâng cao (Tùy chỉnh Client ID / API Key)" section.
- **Status Representation**:
  - Default build-time environment variable present (`VITE_GOOGLE_CLIENT_ID` / `VITE_GOOGLE_PICKER_API_KEY`): Displays a clean `Badge` with `tone="neutral"` containing a `CheckCircle2` icon and text `"Đã cấu hình sẵn"` (Pre-configured).
  - User custom override present in `localStorage`: Displays a `Badge` with `tone="polish"` and text `"Tùy chỉnh cá nhân"` (Custom Key).
  - Missing all credentials: Displays a `Badge` with `tone="warning"` and text `"Chưa cấu hình"` (Not Configured).
- **Rationale**: 99% of users only need to know that Google Cloud integration is active and ready to use. Only developers or self-hosters configuring custom OAuth credentials need to expand the advanced settings.

### Decision 2: Masked Password Inputs with Eye/EyeOff Toggle (Matching `ApiSettings.tsx`)
- **Decision**: In the expanded advanced configuration panel, render input fields using `type={isRevealed ? 'text' : 'password'}` with an `Eye` / `EyeOff` visibility toggle button.
- **Rationale**: Standardizes credential input across the entire application and adheres to the pattern established in `src/components/ApiSettings.tsx` (lines 688–700).

### Decision 3: Revert to Default Action
- **Decision**: Provide a "Khôi phục mặc định" (Restore Default) button when custom credentials exist in `localStorage`, allowing users to easily delete custom overrides and fall back to the environment variables.
- **Rationale**: Prevents users from getting stuck with invalid custom credentials without having to manually open browser DevTools/localStorage.

### Decision 4: Design System Adherence ("Mực & Chu Sa")
- **Tokens**: `bg-ink`, `bg-parchment`, `border-parchment-2`, `text-text-main`, `text-text-muted`, `text-gold`, `text-polish`.
- **Primitives**: `Button` (variant: primary/secondary/ghost), `Badge` (tone: neutral/polish/warning), `cn` for className merging, `rounded-[2px]`.
- **Icons**: `Key`, `Settings`, `Eye`, `EyeOff`, `CheckCircle2`, `AlertTriangle`, `ChevronDown`, `ChevronUp`, `RotateCcw`.

---

## 3. Compatibility & Non-Regression Analysis

| Flow / Subsystem | Potential Impact | Mitigation |
|---|---|---|
| **Google Login (`initiateLogin`)** | Must continue resolving effective Client ID | `googleAuthService.getClientId()` continues returning custom key or default env variable |
| **Google Picker (`openFolderPicker`)** | Must continue resolving effective Picker Key | `googlePickerService.getPickerApiKey()` continues returning custom key or default env variable |
| **Drive Push / Pull / Bi-directional** | Uses OAuth token, unaffected by UI change | Token retrieval via `googleAuthService.getValidAccessToken()` remains untouched |
| **Existing Unit Tests** | All 87 test files must remain green | Run `vitest run` to verify |
