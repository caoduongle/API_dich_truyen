# Data Model: Clean Code & MVC Refactor

**Feature**: 110-clean-code-mvc-refactor
**Date**: 2026-09-12

This refactor does not introduce new data entities. It reorganizes existing code into clear MVC layers. The "data model" here is the **directory architecture** — the structural contract that defines where each type of code lives.

## MVC Layer Architecture

### Layer 1: Model / Data Layer

Responsible for: Domain types, data access (IndexedDB), external API clients, business engines.

```
src/
├── types.ts                          # Core domain interfaces (StoryProject, Chapter, GlossaryItem)
├── types/                            # Extended domain types by feature
│   ├── audit.ts
│   ├── crdt.ts
│   ├── googleAuth.ts
│   ├── googleDriveSync.ts
│   ├── hakoChecker.ts
│   ├── theme.ts
│   └── zuminovel.ts
│
├── config/                           # [NEW] Application configuration
│   ├── constants.ts                  # ← from shared/constants.ts (minus SERVER_CONFIG)
│   └── models.ts                     # ← from shared/models.ts (GeminiModelEntry registry)
│
├── services/                         # Business logic engines (unchanged location)
│   ├── ai/                           # [NEW] AI-specific service subgroup
│   │   ├── prompts.ts                # ← from shared/prompts.ts
│   │   └── glossaryPrompts.ts        # ← from shared/glossaryPrompts.ts
│   ├── directGeminiClient.ts
│   ├── directTranslationEngine.ts
│   ├── directGlossaryEngine.ts
│   ├── chapterTranslationService.ts
│   ├── auditBridgeService.ts
│   ├── localQuotaTracker.ts
│   ├── hakoQualityEngine.ts
│   ├── hakoSessionStore.ts
│   ├── db.ts
│   ├── dbMigration.ts
│   ├── crdtDocManager.ts
│   ├── googleAuthService.ts
│   ├── googleDrivePermissionsService.ts
│   ├── googleDriveSyncService.ts
│   ├── googlePickerService.ts
│   ├── zuminovelPublishService.ts
│   ├── google-drive/
│   │   ├── driveBundleSync.ts
│   │   ├── driveGranularSync.ts
│   │   ├── driveProjectSync.ts
│   │   └── driveRestClient.ts
│   └── zuminovel/
│       ├── zuminovelCredentials.ts
│       └── zuminovelRestClient.ts
```

**Dependency rule**: Model layer has ZERO imports from View or Controller layers.

---

### Layer 2: Controller Layer

Responsible for: Orchestrating business logic, bridging models ↔ views, managing React state.

```
src/
├── hooks/                            # Custom React hooks (controllers)
│   ├── useAIConfig.ts
│   ├── useAutoTranslationQueue.ts
│   ├── useChapterCRDT.ts
│   ├── useDropdownPosition.ts
│   ├── useEpubExport.ts
│   ├── useExportFiles.ts
│   ├── useGlossaryApply.ts
│   ├── useGlossaryContextSearch.ts
│   ├── useGlossaryDuplicates.ts
│   ├── useGlossaryScan.ts
│   ├── useGlossaryState.ts           # ← from components/glossary-manager/
│   ├── useHakoReviewSession.ts
│   ├── useHotkeys.ts
│   ├── useModelDiscovery.ts
│   ├── useModelObservability.ts
│   ├── useProjects.ts
│   ├── useRangeState.ts
│   ├── useScrollOverflow.ts
│   ├── useSeoMetadata.ts
│   ├── useTranslationProcess.ts
│   ├── useVirtualList.ts
│   ├── useWorkspaceState.ts           # ← from components/translator-workspace/
│   └── useZuminovelPublish.ts
│
├── context/                          # React context providers (unchanged)
│   ├── AIConfigContext.tsx
│   ├── ProjectContext.tsx
│   └── ThemeContext.tsx
```

**Dependency rule**: Controller layer may import from Model layer and Shared Utilities. NEVER imports from View layer.

---

### Layer 3: View Layer

Responsible for: Rendering UI, handling user interactions, delegating to controllers.

```
src/
├── components/                       # React components (views)
│   ├── layout/                       # [NEW] App shell decomposition
│   │   ├── AppHeader.tsx             # ← extracted from App.tsx
│   │   ├── AppTabBar.tsx             # ← extracted from App.tsx
│   │   ├── TabContent.tsx            # ← extracted from App.tsx
│   │   ├── AppFooter.tsx             # ← extracted from App.tsx
│   │   ├── ApiSettingsModal.tsx      # ← extracted from App.tsx
│   │   └── GoogleSyncSection.tsx     # ← extracted from App.tsx
│   │
│   ├── ui/                           # Design system primitives (unchanged)
│   │   ├── Badge.tsx
│   │   ├── Button.tsx
│   │   ├── EmptyState.tsx
│   │   ├── GenreMark.tsx
│   │   ├── Kbd.tsx
│   │   ├── Modal.tsx
│   │   └── Seal.tsx
│   │
│   ├── common/                       # Shared non-primitive components (unchanged)
│   ├── translator-workspace/         # Feature components (minus useWorkspaceState.ts)
│   ├── glossary-manager/             # Feature components (minus useGlossaryState.ts)
│   ├── hako-checker/
│   ├── auto-translator/
│   ├── google-sync/
│   ├── project-list/
│   ├── quota-panel/
│   ├── api-settings/
│   │
│   ├── ApiSettings.tsx               # Top-level feature views
│   ├── AutoTranslator.tsx
│   ├── ChapterHistoryPanel.tsx
│   ├── ErrorBoundary.tsx
│   ├── GlossaryManager.tsx
│   ├── NotificationSystem.tsx
│   ├── ProjectList.tsx
│   ├── QuotaPanel.tsx
│   ├── SealStamp.tsx
│   └── TranslatorWorkspace.tsx
```

**Dependency rule**: View layer may import from Controller layer (hooks/contexts) and Shared Utilities. May import types from Model layer but NEVER calls services directly.

---

### Shared Utilities (Cross-cutting)

Available to all layers without introducing coupling.

```
src/
├── lib/                              # Pure utility functions
│   ├── cn.ts                         # clsx + tailwind-merge
│   ├── text.ts                       # ← from shared/text.ts
│   ├── sinoNormalize.ts              # ← from shared/sinoNormalize.ts
│   └── parser.ts                     # ← from shared/parser.ts
│
├── utils/                            # Application utilities (unchanged, minus dead code)
│   ├── contrastAuditor.ts
│   ├── customLimitsStorage.ts
│   ├── download.ts
│   ├── exportFormatter.ts
│   ├── fileParser.ts
│   ├── fileValidator.ts
│   ├── fontLoader.ts
│   ├── modelRegistry.ts
│   ├── seoConfig.ts
│   ├── storageAudit.ts
│   ├── textCleaner.ts
│   └── textareaHighlight.ts
│
├── i18n/                             # Internationalization (unchanged)
│   ├── I18nContext.tsx
│   ├── types.ts
│   └── locales/
│
├── data/                             # Static data (unchanged)
│   └── examples.ts
│
└── workers/                          # Web workers (unchanged)
    └── translationWorker.ts
```

**Dependency rule**: Shared utilities have ZERO imports from View, Controller, or Model layers. They are leaf nodes in the dependency graph.

---

## File Movement Summary

### New directories to create
| Directory | Purpose |
|-----------|---------|
| `src/config/` | Application-wide configuration (constants, model registry) |
| `src/services/ai/` | AI-specific prompt engineering services |
| `src/components/layout/` | App shell layout components |

### Files to move (12 total)
| Source | Destination |
|--------|-------------|
| `shared/constants.ts` | `src/config/constants.ts` |
| `shared/models.ts` | `src/config/models.ts` |
| `shared/prompts.ts` | `src/services/ai/prompts.ts` |
| `shared/glossaryPrompts.ts` | `src/services/ai/glossaryPrompts.ts` |
| `shared/text.ts` | `src/lib/text.ts` |
| `shared/sinoNormalize.ts` | `src/lib/sinoNormalize.ts` |
| `shared/parser.ts` | `src/lib/parser.ts` |
| `shared/__tests__/constants.test.ts` | `src/config/__tests__/constants.test.ts` |
| `shared/__tests__/sinoNormalize.test.ts` | `src/lib/__tests__/sinoNormalize.test.ts` |
| `shared/__tests__/text.test.ts` | `src/lib/__tests__/text.test.ts` |
| `src/components/translator-workspace/useWorkspaceState.ts` | `src/hooks/useWorkspaceState.ts` |
| `src/components/glossary-manager/useGlossaryState.ts` | `src/hooks/useGlossaryState.ts` |

### Files to extract from `App.tsx` (6 new files)
| New file | Source lines (approx) |
|----------|----------------------|
| `src/components/layout/AppHeader.tsx` | App.tsx:182–350 |
| `src/components/layout/AppTabBar.tsx` | App.tsx:352–480 |
| `src/components/layout/TabContent.tsx` | App.tsx:482–620 |
| `src/components/layout/AppFooter.tsx` | App.tsx:622–900 |
| `src/components/layout/ApiSettingsModal.tsx` | App.tsx:902–1000 |
| `src/components/layout/GoogleSyncSection.tsx` | App.tsx:1002–1100 |

### Files to delete
| File | Reason |
|------|--------|
| `shared/` (entire directory) | Relocated to `src/` |
| `src/utils/apiClient.ts` | Dead legacy wrapper (verify type usage first) |
| `src/constants/models.ts` | Barrel re-export replaced by `src/config/models.ts` |
| `database/migrations/001_rls_policies.sql` | Dead Supabase schema |
| `docs/api.md` | Dead Express endpoint docs |

### Import updates required (~23 files)
See [research.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/110-clean-code-mvc-refactor/research.md) §R1 for the complete list.
