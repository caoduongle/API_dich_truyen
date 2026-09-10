# Contract: QA Critique Target Text Locating Field

## Contract 1: `buildQaCritiquePayload` Contract

**Location**: `shared/prompts.ts`

### Input
```typescript
export interface BuildQaCritiquePromptParams {
  sourceText: string;
  translatedText: string;
}
```

### Output
```typescript
{
  systemInstruction: string;
  prompt: string;
  schema: {
    type: "OBJECT";
    properties: {
      isValid: { type: "BOOLEAN"; description: string };
      issues: {
        type: "ARRAY";
        description: string;
        items: {
          type: "OBJECT";
          properties: {
            type: { type: "STRING"; enum: string[]; description: string };
            severity: { type: "STRING"; enum: string[]; description: string };
            targetText: { type: "STRING"; description: string };
            description: { type: "STRING"; description: string };
          };
          required: ["type", "severity", "targetText", "description"];
        };
      };
    };
    required: ["isValid", "issues"];
  };
}
```

### Invariants
1. `schema.properties.issues.items.required` MUST contain `targetText`.
2. `systemInstruction` MUST explicitly specify verbatim quotation in `targetText` and allow `""` strictly for omission defects.

---

## Contract 2: `qaCritiqueDirect` Result & UI Contract

**Location**: `src/services/directTranslationEngine.ts` & `src/components/translator-workspace/QaCritiquePanel.tsx`

### Interface Contract
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

### Consumer Prop Contract
```typescript
export interface QaCritiquePanelProps {
  isMismatch: boolean;
  sourceParaCount: number;
  translationParaCount: number;
  isCheckingQa: boolean;
  enableAiQaCritique: boolean;
  qaIssues: DirectQaCritiqueIssue[];
}
```
