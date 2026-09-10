# Research: Workspace Audit Scanners & QA Critique Decoupling

## Decision 1: Decoupling Mechanism in `handlePolishTranslation`

### Decision
Remove the automated block:
```typescript
if (enableAiQaCritique) {
  setIsCheckingQa(true);
  ...
  await qaCritiqueDirect(...);
  ...
}
```
from `handlePolishTranslation()`. Retain `enableAiQaCritique` in `UseWorkspaceStateProps` so external callers (`TranslatorWorkspace.tsx`) do not break, but decouple the execution entirely from the polish lifecycle.

### Rationale
- Calling AI QA critique on every single polish consumes excessive quota and adds unexpected latency. Translators frequently polish multiple times (adjusting instructions, temperature, or glossary) before wanting an audit.
- Keeping `enableAiQaCritique` in `UseWorkspaceStateProps` maintains backward compatibility with parent components while preparing for the manual inspector UI in Prompt B3.

---

## Decision 2: Manual `handleRunAiQaCritique` Design

### Decision
Implement `handleRunAiQaCritique()` as an independent async function:
- Early check: if `!polishedTranslation.trim()`, show a gentle warning toast (`"Vui lòng hoàn thành bản dịch trước khi kiểm duyệt AI."`) and return.
- Manage state: set `isCheckingQa(true)`, clear previous `setQaIssues([])`.
- Call `qaCritiqueDirect` with:
  * `sourceText`
  * `translatedText: polishedTranslation`
  * `apiKeys`
  * `model: selectedModel`
  * `startKeyIndex: 0`
- On success: `setQaIssues(qaData.issues || [])` and show feedback toast.
- In `catch`: log error and show error toast.
- In `finally`: `setIsCheckingQa(false)`.

### Rationale
- Reuses existing `qaIssues` (`DirectQaCritiqueIssue[]`) and `isCheckingQa` (`boolean`) states.
- Ensures robust error containment and guarantees the loading indicator resets even on network or model failures.

---

## Decision 3: Debounced Heuristic Quality Scan

### Decision
Implement `handleRunHakoScan()` calling `runHeuristicQualityScan`:
```typescript
const handleRunHakoScan = useCallback(() => {
  if (!polishedTranslation.trim()) {
    setHakoIssues([]);
    return;
  }
  const currentChapter = activeProject.chapters.find(c => c.id === currentChapterId);
  const issues = runHeuristicQualityScan({
    chapterId: currentChapterId || undefined,
    title: chapterTitle || currentChapter?.title || 'Chương hiện tại',
    chapterNumber: currentChapter?.chapterNumber || 1,
    vietnameseContent: polishedTranslation,
  });
  setHakoIssues(issues);
}, [polishedTranslation, currentChapterId, chapterTitle, activeProject.chapters]);
```

Trigger `handleRunHakoScan()` in a `useEffect` with a 500ms debounce whenever `polishedTranslation` changes:
```typescript
useEffect(() => {
  const timer = setTimeout(() => {
    handleRunHakoScan();
  }, 500);
  return () => clearTimeout(timer);
}, [polishedTranslation, handleRunHakoScan]);
```

### Rationale
- `runHeuristicQualityScan` is a fast, synchronous in-memory regex scanner.
- A 500ms debounce prevents unnecessary execution on every keystroke while giving the user instantaneous feedback as soon as typing pauses.
