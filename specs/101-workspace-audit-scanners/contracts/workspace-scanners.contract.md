# Contract: Workspace Audit Scanners & Actions

## Location: `src/components/translator-workspace/useWorkspaceState.ts`

### Extended Return Contract of `useWorkspaceState`

```typescript
export interface UseWorkspaceStateReturn {
  // Existing state and actions...
  qaIssues: DirectQaCritiqueIssue[];
  isCheckingQa: boolean;

  // New state and actions:
  hakoIssues: QualityIssue[];
  handleRunAiQaCritique: () => Promise<void>;
  handleRunHakoScan: () => void;
}
```

### Invariants
1. `handlePolishTranslation()` MUST NOT invoke `qaCritiqueDirect()`.
2. `handleRunAiQaCritique()` MUST manage `isCheckingQa` (true during call, false upon completion).
3. `handleRunHakoScan()` MUST be synchronous and side-effect free beyond setting `hakoIssues`.
4. Debounce MUST be 500ms and cancellable on chapter switch or unmount.
