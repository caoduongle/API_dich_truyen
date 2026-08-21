# Quickstart & Verification Guide: Direct Client Translation

## Overview

This guide provides end-to-end verification procedures to validate that translation requests with personal API keys execute directly from the client without touching the server's concurrency queue or caches, while server fallback remains intact.

---

## Scenario 1: Direct Client Translation with Personal Key

### Objective
Verify that configured personal API keys initiate direct client-to-Gemini requests without calling `/api/translate-raw` or `/api/polish-translation`.

### Steps:
1. Open the application in a browser.
2. In the AI Configuration modal (`Cấu hình AI`), add a valid Gemini API key (`AQ...` or `AIza...`).
3. Open a project and click **Dịch chương** on a Chinese chapter.
4. Open the Browser Network DevTools panel:
   * Observe outbound `POST` requests to `https://generativelanguage.googleapis.com/v1beta/models/...:generateContent`.
   * Confirm **zero** requests to `/api/translate-raw` or `/api/polish-translation`.
5. Verify translated output appears in the UI and is stored locally in IndexedDB.

---

## Scenario 2: Server Fallback Translation (No Personal Key)

### Objective
Verify that users with no configured keys seamlessly route translation requests through the existing server fallback endpoints.

### Steps:
1. Clear all API keys in the AI Configuration modal.
2. Ensure `.env` on server has `ALLOW_SERVER_KEY_FALLBACK=true` and valid `GEMINI_API_KEY`.
3. Click **Dịch chương** on a Chinese chapter.
4. Open the Browser Network DevTools panel:
   * Observe outbound `POST /api/translate-raw` and `POST /api/polish-translation` requests to the local server.
5. Verify translated output completes and displays properly.

---

## Scenario 3: Automated Test Suite Execution

Run all unit, integration, and contract tests to ensure zero regressions across shared modules, direct client service, and server controllers:

```bash
# Typecheck
npm run lint

# Run all test suites
npm test

# Production build verification
npm run build
```
