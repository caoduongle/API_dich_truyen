# Research: QA Critique Target Text Locating Field

## Decision 1: Target Text Schema Property & Verbatim Prompting

### Decision
Add `targetText: { type: "STRING", description: "..." }` into `issues.items.properties` in `buildQaCritiquePayload()` (`shared/prompts.ts`) and include `"targetText"` in `issues.items.required`. In `systemInstruction`, explicitly instruct the AI:
1. Every detected issue (addition, repetition, terminology, phrasing, etc.) MUST quote VERBATIM (`NGUYÊN VĂN`) the exact Vietnamese sentence or excerpt from the polished translation.
2. In the specific case of an **omission** (`type: "omission"`) where the omitted content from the Chinese raw text does not appear in the Vietnamese translation, the AI is explicitly permitted to output an empty string `""`.

### Rationale
- This mirrors the proven pattern established in `src/services/hakoQualityEngine.ts` (`vietnameseSnippet`), which successfully allows downstream components to pinpoint and highlight problematic text.
- Exact verbatim copying without paraphrase or additional quote marks ensures that downstream string matching (`indexOf`, `includes`, regex matching, or diff algorithms) can locate the exact line/span in the text editor.
- Allowing an empty string for omissions prevents hallucinated snippets when text is genuinely missing, and gives downstream UI a distinct signal not to attempt in-editor snippet highlighting for missing sentences.

### Alternatives Considered
- *Optional field (`required: ["type", "severity", "description"]` without `targetText`)*: Rejected because Gemini may omit the field unpredictably, leading to `undefined` runtime values in downstream components.
- *Returning character offsets / line numbers*: Rejected because LLMs are notoriously bad at computing exact character indices or line numbers, whereas verbatim substring matching in the client is reliable and resilient.

---

## Decision 2: Interface Modeling and Concrete Typing

### Decision
Define a dedicated, strongly-typed interface `DirectQaCritiqueIssue` in `src/services/directTranslationEngine.ts`:

```typescript
export interface DirectQaCritiqueIssue {
  type: 'omission' | 'addition' | 'repetition' | 'terminology' | 'other';
  severity: 'critical' | 'warning' | 'info';
  targetText: string;
  description: string;
}

export interface DirectQaCritiqueResult {
  isValid: boolean;
  issues: DirectQaCritiqueIssue[];
  successKeyIndex: number;
}
```

Export `DirectQaCritiqueIssue` from `src/services/directTranslationEngine.ts` so consuming components (`QaCritiquePanel.tsx`, `BilingualEditor.tsx`, `useWorkspaceState.ts`, `chapterTranslationService.ts`) can import and use it.

### Rationale
- Replaces loose `any[]` across the codebase, ensuring full TypeScript compile-time verification as mandated by Constitution Principle I.
- Downstream Track B features (click-to-highlight, AI targeted rewrite) will immediately benefit from typed `issue.targetText`.

### Alternatives Considered
- *Declaring the type in `src/types.ts`*: Rejected because Constitution Principle IV explicitly forbids altering core schemas in `src/types.ts` unless necessary. Keeping domain-specific types in their respective engine file (`directTranslationEngine.ts`) aligns with codebase conventions (similar to `hakoChecker.ts`).

---

## Decision 3: Consumer Type Propagation Scope

### Decision
Update the following consumers to replace `any[]` with `DirectQaCritiqueIssue[]`:
1. `src/components/translator-workspace/QaCritiquePanel.tsx`: `qaIssues: DirectQaCritiqueIssue[];` in `QaCritiquePanelProps`. No JSX or UI behavior changes.
2. `src/components/translator-workspace/BilingualEditor.tsx`: `qaIssues: DirectQaCritiqueIssue[];` in `BilingualEditorProps`.
3. `src/components/translator-workspace/useWorkspaceState.ts`: `const [qaIssues, setQaIssues] = useState<DirectQaCritiqueIssue[]>([]);`.
4. `src/services/chapterTranslationService.ts`: Type annotation in log loop `(issue: DirectQaCritiqueIssue)`.

### Rationale
- Completely eliminates `any[]` without modifying any UI markup, CSS classes, or interaction handlers.
- Fulfills the user constraint to only modify type definitions without altering UI presentation or logic.

---

## Decision 4: Test Suite Synchronization

### Decision
Update existing unit tests:
1. `shared/__tests__/sharedTranslationLogic.test.ts`: Update test `builds QA critique payload accurately` to verify:
   - `schema.properties.issues.items.properties` has `targetText`.
   - `schema.properties.issues.items.required` contains `'targetText'`.
   - `systemInstruction` contains instructions about `targetText` and `NGUYÊN VĂN`.
2. `src/services/__tests__/directTranslationEngine.test.ts`: Update mocked Gemini response in `executes qaCritiqueDirect and returns validation report` to include `targetText: ''` or sample snippet, ensuring mock matches `DirectQaCritiqueIssue`.

### Rationale
- Satisfies Constitution Principle I (strict test verification, no skipped tests).
