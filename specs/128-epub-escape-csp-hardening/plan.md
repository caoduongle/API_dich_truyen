# Implementation Plan: EPUB Export Content Escaping, Dead Protocol Pruning & CSP Hardening

**Branch**: `128-epub-escape-csp-hardening` | **Date**: 2026-09-13 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/128-epub-escape-csp-hardening/spec.md`

## Summary

This plan addresses three security and quality hardening initiatives:
1. **Nhóm A (Escape nội dung khi xuất EPUB & Hợp nhất utility)**:
   - Provide a single `escapeHtml(text: string): string` in `src/lib/text.ts` escaping `&`, `<`, `>`, `"`, `'` in deterministic order.
   - Refactor `DiffModal.tsx` and `zuminovelPublishService.ts` to use this shared function, removing duplicate definitions.
   - Update `useEpubExport.ts` to escape all dynamic content in EPUB XML/XHTML files (`cover.xhtml`, chapter XHTML, `nav.xhtml`, `toc.ncx`, `content.opf`), escaping `proj.description` before converting newlines to `<br/>`.
   - Add comprehensive tests validating XML well-formedness when special characters are present.
2. **Nhóm B (Vá lỗ hổng CSP đã biết + gỡ phần chết)**:
   - Prune `ws:` and `wss:` from `connect-src` across all 3 deployment configurations (`render.yaml`, `vercel.json`, `public/_headers`).
   - Remove dead dependencies `y-websocket` and `y-protocols` from `package.json`, run `npm install`, and preserve `yjs` and `y-indexeddb`.
3. **Nhóm C (Thử nghiệm có kiểm chứng — Siết 'unsafe-inline' & Đồng bộ 100% CSP)**:
   - Test removal of `'unsafe-inline'` from `script-src` and `style-src` across 4 core browser journeys (initial load, Google GIS auth, Google Picker, CustomThemeModal).
   - Document empirical findings and enforce 100% character-for-character CSP parity across `render.yaml`, `vercel.json`, and `public/_headers`.

---

## Technical Context

**Language/Version**: TypeScript 5.8+ / Node.js 20+  
**Primary Dependencies**: React 19, Vite 6, Tailwind CSS v4, `jszip`, `lucide-react`, `yjs`, `y-indexeddb`  
**Storage**: Client-Side IndexedDB (`src/services/db.ts`), LocalStorage, SessionStorage  
**Testing**: Vitest (`npm test`), TypeScript typecheck (`tsc --noEmit`), Vite production build (`npm run build`)  
**Target Platform**: Pure Client-Side SPA (Web Browser, Render Static Site, Vercel, Netlify/Cloudflare Pages)  
**Project Type**: Web Application (Client-Side SPA)  
**Performance Goals**: Instant text escaping (<1ms); zero lag on EPUB export; instant CSP compliance without runtime blocking.  
**Constraints**: Pure client-side architecture; zero server-side middleware; triple-file CSP exact parity.  
**Scale/Scope**: 5 existing source files touched (`text.ts`, `DiffModal.tsx`, `zuminovelPublishService.ts`, `useEpubExport.ts`, `package.json`), 3 deployment header configs (`render.yaml`, `vercel.json`, `public/_headers`), 2 test suites.

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Principle I: Strict Quality Gates & Verification**: `npm run lint`, `npm test`, and `npm run build` must all pass cleanly without skipping or deleting tests. $\rightarrow$ **PASS**
- **Principle II: Dependency Minimization & Existing Library Reuse**: Removes 2 dead dependencies (`y-websocket`, `y-protocols`), adds 0 new dependencies. $\rightarrow$ **PASS**
- **Principle III: Strict Concern Separation & MVC Domain Boundary**: String escaping in `src/lib/text.ts`; hook orchestration in `src/hooks/`; publishing logic in `src/services/`. Views do not contain escaping math. $\rightarrow$ **PASS**
- **Principle IV: Immutable Core Schemas & Storage Stability**: No changes to `src/types.ts` or IndexedDB schema. $\rightarrow$ **PASS**
- **Principle V: Atomic Commits & Documentation Synchronization**: All specification and planning artifacts maintained in strict 1:1 synchronization. Triple-file CSP parity enforced. $\rightarrow$ **PASS**

---

## Project Structure

### Documentation (this feature)

```text
specs/128-epub-escape-csp-hardening/
├── spec.md              # Feature specification
├── plan.md              # Implementation plan (this file)
├── research.md          # Technical research, decisions, and trade-offs
├── data-model.md        # Entities and escaping rules
├── quickstart.md        # Verification commands and browser testing protocol
├── checklists/
│   └── requirements.md  # Quality checklist validation
└── contracts/
    └── escape-and-csp.contract.md # Interface & configuration contracts
```

### Source Code (repository root)

```text
src/
├── lib/
│   ├── text.ts                             # [MODIFY] Add centralized escapeHtml()
│   └── __tests__/
│       └── text.test.ts                    # [NEW/MODIFY] Test escapeHtml behavior
├── components/
│   └── auto-translator/
│       └── DiffModal.tsx                   # [MODIFY] Import and use escapeHtml from src/lib/text.ts
├── services/
│   ├── zuminovelPublishService.ts          # [MODIFY] Import and use escapeHtml from src/lib/text.ts
│   └── __tests__/
│       └── zuminovelPublishService.test.ts # [VERIFY] Verify publishing behavior unchanged
├── hooks/
│   ├── useEpubExport.ts                    # [MODIFY] Escape all interpolated XML/XHTML content
│   └── __tests__/
│       └── useEpubExport.test.ts           # [NEW] Test well-formed XML generation with special characters
render.yaml                                 # [MODIFY] Prune ws:/wss:, test/harden CSP
vercel.json                                 # [MODIFY] Prune ws:/wss:, sync CSP to exact match
public/_headers                             # [MODIFY] Prune ws:/wss:, sync CSP to exact match
package.json                                # [MODIFY] Remove y-websocket and y-protocols
```

**Structure Decision**: Place core escaping in `src/lib/text.ts` where text sanitizers reside. Synchronize headers across `render.yaml`, `vercel.json`, and `public/_headers`.

---

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| *None* | *N/A* | *Standard string sanitization, dependency removal, and static header synchronization* |
