# Data Model: Recursive Divide & Conquer Polish and Empty Response Resilience

## Entities & Type Definitions

### 1. `DirectPolishTranslationResult` (Extension)

Location: `src/services/directTranslationEngine.ts`

```typescript
export interface DirectPolishTranslationResult {
  polishedTranslation: string;
  discoveredEntities?: any[];
  successKeyIndex: number;
  isPartial?: boolean; // Flag indicating one or more sub-segments used raw/previous text fallback
}
```

### 2. `PolishWithContentSplitParams`

Internal helper parameters for recursive polishing:

```typescript
interface PolishWithContentSplitParams extends DirectPolishTranslationParams {
  depth?: number;
  maxDepth?: number;
}
```

### 3. Iterative Polish Execution Flow State Machine

```mermaid
stateDiagram-v2
    [*] --> Phase1RawDraft
    Phase1RawDraft --> Round1Polish: firstDraft ready
    
    state "Iterative Polish (Round j of N)" as PolishLoop {
        Round1Polish --> CheckRoundResult
        CheckRoundResult --> RoundNextPolish: Round j succeeded
        CheckRoundResult --> FallbackRound: Round j failed (empty/safety)
        
        state CheckRoundResult <<choice>>
        state FallbackRound {
            [*] --> CheckRoundIndex
            CheckRoundIndex --> UsePreviousRound: j > 1 (keep currentTextToPolish)
            CheckRoundIndex --> UseFirstDraft: j = 1 (keep firstDraft)
            UsePreviousRound --> BreakLoopEarly: Log warning
            UseFirstDraft --> BreakLoopEarly: Log warning
        }
    }
    
    RoundNextPolish --> ConvergenceOrNext: j < N
    ConvergenceOrNext --> RoundNextPolish: Similarity < 96%
    ConvergenceOrNext --> Phase3QaCritique: Similarity >= 96% (Converged)
    BreakLoopEarly --> Phase3QaCritique
    
    Phase3QaCritique --> SaveChapterCompleted: Persist to IndexedDB
    SaveChapterCompleted --> [*]
```

### 4. Recursive Divide & Conquer State Machine

```mermaid
stateDiagram-v2
    [*] --> CallDirectPolish: Initial Segment
    CallDirectPolish --> SuccessReturn: AI returned valid text
    CallDirectPolish --> EvaluateSplit: Error is empty or safety filter
    
    state EvaluateSplit <<choice>>
    EvaluateSplit --> SplitParts: depth < maxDepth (2) AND tokens >= 200
    EvaluateSplit --> LeafFallback: depth >= maxDepth OR cannot split further
    
    SplitParts --> RecursiveCallPart1: splitTextAdaptively(sourceText, 2)
    SplitParts --> RecursiveCallPart2: splitTextAdaptively(rawTranslation, 2)
    
    RecursiveCallPart1 --> MergeResults
    RecursiveCallPart2 --> MergeResults
    LeafFallback --> ReturnRawSegment: isPartial = true
    ReturnRawSegment --> MergeResults
    
    MergeResults --> EnsureTitleAndValidate: combine with \n\n
    EnsureTitleAndValidate --> SuccessReturn
    SuccessReturn --> [*]
```
