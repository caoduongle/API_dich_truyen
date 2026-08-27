# UI & Service Contract: Hako Quality Checker Selection UX, Card Numbering & Error Visibility

**Feature**: Hako Quality Checker Selection UX, Card Numbering & Error Visibility  
**Feature Directory**: `specs/081-hako-checker-range-card-fixes`  
**Date**: 2026-08-27

---

## 1. Component Interfaces

### 1.1 `HakoChapterSelectorProps`

```typescript
export interface HakoChapterSelectorProps {
  projects: StoryProject[];
  selectedProjectId: string | null;
  onSelectProject: (projectId: string) => void;
  selectedChapterIds: (string | number)[];
  chapters: Record<string, ProjectReviewChapter>;
  onToggleChapter: (chapterId: string | number) => void;
  onSelectRange: (chapterIds: (string | number)[]) => void;
  onClearSelection: () => void;
  onUpdateRawText: (chapterId: string | number, rawText: string) => void;
  onStartAnalysis: () => void;
  isAnalyzing: boolean;
}
```

### 1.2 `HakoIssueCardProps`

```typescript
export interface HakoIssueCardProps {
  issue: QualityIssue;
  onDecisionChange: (
    issueId: string,
    decision: QualityIssueDecision,
    moderatorNote?: string
  ) => void;
}
```

---

## 2. Quality Engine Service Contracts (`src/services/hakoQualityEngine.ts`)

### 2.1 Heuristic Scan Input Contract

```typescript
export interface HeuristicScanInput {
  chapterId?: string;
  url?: string;
  title: string;
  chapterNumber: number; // Mandatory chapter index
  vietnameseContent: string;
}

export function runHeuristicQualityScan(input: HeuristicScanInput): QualityIssue[];
```

### 2.2 AI Quality Scan Input Contract

```typescript
export interface AiQualityScanChapterInput {
  chapterId: string;
  title: string;
  chapterNumber: number; // Mandatory chapter index
  vietnameseContent: string;
  rawChineseContent?: string;
}

export interface AiQualityScanInput {
  apiKeys: string[];
  model?: string;
  projectTitle?: string;
  chapters: AiQualityScanChapterInput[];
  onProgress?: (current: number, total: number, message: string) => void;
  signal?: AbortSignal;
}

export function runAiQualityScan(input: AiQualityScanInput): Promise<QualityIssue[]>;
```

### 2.3 Quality Report Generation Contract

```typescript
export function generateQualityReport(session: QualityReviewSession): QualityReport;
```

**Markdown Output Contract Requirements**:
- Chapters in `session.issues` grouped and sorted by `issue.chapterNumber` ascending.
- Section headers formatted as `### Chương #{chapterNumber} — {chapterTitle}`.

---

## 3. Session Hook Return Contract (`src/hooks/useHakoReviewSession.ts`)

```typescript
export interface UseHakoReviewSessionReturn {
  session: QualityReviewSession | null;
  isLoadingSession: boolean;
  isAnalyzing: boolean;
  analysisProgress: { current: number; total: number; message: string };
  error: { code: string; message: string } | null;
  setError: (err: { code: string; message: string } | null) => void;
  setIsAnalyzing: (analyzing: boolean) => void;
  setAnalysisProgress: (progress: { current: number; total: number; message: string }) => void;
  selectProject: (project: StoryProject) => Promise<void>;
  toggleChapterSelection: (chapterId: string | number) => void;
  selectChapterRange: (chapterIds: (string | number)[]) => void;
  clearChapterSelection: () => void;
  updateChapterRawText: (chapterId: string | number, rawText: string) => void;
  updateSessionChaptersAndIssues: (
    chapters: Record<string, ProjectReviewChapter>,
    issues: QualityIssue[]
  ) => Promise<void>;
  updateIssueDecision: (
    issueId: string,
    decision: QualityIssueDecision,
    moderatorNote?: string
  ) => Promise<void>;
  resetCurrentSession: () => Promise<void>;
}
```
