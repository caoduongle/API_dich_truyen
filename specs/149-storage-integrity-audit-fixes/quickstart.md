# Quickstart & Validation Guide: Storage Integrity, Security Parity & Hygiene Remediation

**Feature**: `149-storage-integrity-audit-fixes`  
**Date**: 2026-09-20  
**Status**: Completed  

---

## Prerequisites

- Node.js 20 LTS installed.
- Repository cloned and dependencies installed via `npm ci`.

---

## Automated Verification Suite

Run all verification commands sequentially:

```bash
# 1. Type check with strict compiler guards (including noUnusedLocals, noUnusedParameters)
npm run lint

# 2. Complete unit and integration test suite
npm test

# 3. Production Vite build validation
npm run build
```

---

## Targeted Test Scenarios

### Scenario 1: Storage Queue FIFO Serialization & No Resurrection
```bash
npx vitest run src/services/__tests__/projectStorageQueue.test.ts src/services/__tests__/projectDeleteQueue.test.ts
```
**Expected Outcome**:
- `enqueueProjectSave` and `enqueueProjectDelete` execute in strict FIFO order per `projectId`.
- A delete operation queued after a save completes strictly after the save; no zombie project resurrects.

### Scenario 2: In-Transaction DB Validation & TOCTOU Elimination
```bash
npx vitest run src/services/__tests__/db.test.ts
```
**Expected Outcome**:
- Saving a project referencing chapters belonging to another project throws a `Relational integrity violation` and aborts the transaction cleanly.
- Validation reads and mutative writes occur inside a single locked `readwrite` transaction.

### Scenario 3: Real EPUB Archive Structure & XML Well-Formedness
```bash
npx vitest run src/hooks/__tests__/useEpubExport.test.ts
```
**Expected Outcome**:
- `handleExportEpub` generates a valid `.epub` zip archive.
- Archive contains uncompressed `mimetype` (`STORE`), `container.xml`, `content.opf`, `nav.xhtml`, `toc.ncx`, `style.css`, and valid chapter XHTML.
- Bounded batch chapter retrieval finishes smoothly without sequential stalls.

### Scenario 4: Multi-Platform CSP Parity
```bash
npx vitest run src/tests/cspParity.test.ts
```
**Expected Outcome**:
- `render.yaml`, `vercel.json`, `public/_headers`, and `vite.config.ts` have 100% identical CSP security directives.

### Scenario 5: Credential Storage & Audit Integrity
```bash
npx vitest run src/utils/__tests__/storageAudit.test.ts src/utils/__tests__/credentialStorage.test.ts
```
**Expected Outcome**:
- `rememberKeys === true` retains keys in `localStorage['app_ui_prefs'].savedKeys` without audit violations.
- Toggling `rememberKeys === false` immediately empties `savedKeys`.
- Legacy root key `localStorage['gemini_api_keys']` is strictly purged.

---

## Manual Verification Scenarios

1. **Shared-Device UI Warning**:
   - Open browser, navigate to API Settings (`/translate` → Settings icon).
   - Verify the checkbox "Ghi nhớ API key trên trình duyệt này" is checked by default.
   - Verify the caution label is visible: *"Lưu ý: Không nên bật tùy chọn ghi nhớ khi sử dụng trên máy tính công cộng hoặc thiết bị dùng chung."*
2. **Canonical & SEO Origin**:
   - Inspect page source (`index.html` in dist build): verify OpenGraph and JSON-LD schema reflect `VITE_PUBLIC_URL` instead of hardcoded Render domain.
3. **Documentation Parity**:
   - Inspect `public/llms.txt`: verify DOCX is absent and routes match actual application tabs.
