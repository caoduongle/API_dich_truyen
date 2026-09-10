# Data Model: Workspace Audit Scanners & QA Critique Decoupling

## Hook State Additions in `useWorkspaceState`

### 1. `hakoIssues` State
- **Type**: `QualityIssue[]` (from `src/types/hakoChecker.ts`)
- **Default**: `[]`
- **Description**: Stores issues detected by heuristic rule scans on the active chapter's `polishedTranslation`.

### 2. `qaIssues` State (Existing, Typed)
- **Type**: `DirectQaCritiqueIssue[]` (from `src/services/directTranslationEngine.ts`)
- **Default**: `[]`
- **Description**: Stores semantic/cross-lingual issues returned by Gemini QA Critique.

### 3. `isCheckingQa` State (Existing)
- **Type**: `boolean`
- **Default**: `false`
- **Description**: Loading indicator for active AI QA Critique requests.

---

## Action Functions in `useWorkspaceState`

| Function Name | Signature | Mode | Triggers | State Mutated |
|---------------|-----------|------|----------|---------------|
| `handleRunAiQaCritique` | `() => Promise<void>` | Manual on-demand | User clicks QA critique button | `isCheckingQa`, `qaIssues` |
| `handleRunHakoScan` | `() => void` | Automatic (debounced) & Manual | Text change (500ms debounce) or button click | `hakoIssues` |
| `handlePolishTranslation` | `() => Promise<void>` | Manual on-demand | User clicks Polish button | `polishedTranslation`, `autoDiscoveredTerms`, `isPolishing` (NO LONGER mutates QA state) |
