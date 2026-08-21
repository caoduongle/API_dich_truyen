# Contract: Shared Translation Pipeline & Prompts

## Modules

### 1. `shared/text.ts`

Defines utility functions for text manipulation, chunking, token estimation, and output validation:

```typescript
// Sanitization & Safety
export function sanitizePromptInput(text: string): string;
export function validateTranslationOutput(text: string, minLength?: number, maxRatio?: number): void;
export function separateChapterTitleAndBody(text: string): string;
export function ensureChapterTitlePreserved(rawText: string, polishedText: string): string;

// Token & Chunking
export function estimateTokenCount(text: string): number;
export function findSplitPoint(text: string): number;
export function splitTextAdaptively(text: string, partsCount: number): string[];

// Framing & Formatting
export const ANTI_INJECTION_DEFENSE_DIRECTIVE: string;
export const LITERARY_TRANSLATION_FRAMING: string;
export function getGenreStyleGuide(genre: string): string;
export function safeParseJson<T = any>(text: string): T | null;
export function escapeRegex(str: string): string;
```

---

### 2. `shared/prompts.ts`

Defines standardized prompt generation and schemas:

```typescript
export interface BuildRawPromptParams {
  text: string;
  genre: string;
  tone: string;
  description?: string;
  glossary?: Array<{ chinese: string; vietnamese: string; pinyin?: string; type?: string; note?: string; variants?: string[] }>;
}

export function buildRawTranslationPayload(params: BuildRawPromptParams): {
  systemInstruction: string;
  prompt: string;
  schema: Record<string, any>;
};

export interface BuildPolishPromptParams {
  sourceText: string;
  rawTranslation: string;
  genre: string;
  tone: string;
  description?: string;
  glossary?: Array<{ chinese: string; vietnamese: string; variants?: string[] }>;
  additionalInstructions?: string;
}

export function buildPolishTranslationPayload(params: BuildPolishPromptParams): {
  systemInstruction: string;
  prompt: string;
  schema: Record<string, any>;
};

export interface BuildQaPromptParams {
  sourceText: string;
  translatedText: string;
}

export function buildQaCritiquePayload(params: BuildQaPromptParams): {
  systemInstruction: string;
  prompt: string;
  schema: Record<string, any>;
};
```
