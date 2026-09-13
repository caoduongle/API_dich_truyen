# Contract: Storage Guard & Chapter Persistence

**Module**: `src/services/db.ts`  
**Consumers**: All services, hooks, and sync components modifying chapters (`useChapterCRDT`, `chapterTranslationService`, `useWorkspaceState`, `useGlossaryApply`, etc.)

## Invariant Specification

### Function: `saveChapterToDB(chapter: Chapter): Promise<void>`

**Preconditions**:
- `chapter.id` is a non-empty string.

**Postconditions**:
1. If no record existed for `chapter.id`, `chapter` is saved directly to `CHAPTERS_STORE`.
2. If an existing record exists with `existing.sourceText.trim().length > 0`:
   - If incoming `chapter.sourceText` is empty, missing, or whitespace-only:
     - The stored `sourceText` MUST retain `existing.sourceText`.
     - The system logs a defensive safeguard warning to console.
3. If an existing record exists with `existing.rawTranslation.trim().length > 0`:
   - If incoming `chapter.rawTranslation` is undefined:
     - The stored `rawTranslation` MUST retain `existing.rawTranslation`.
4. Any non-empty updates to `polishedTranslation`, `rawTranslation`, `title`, `paragraphs`, `translatedLines`, `qaIssues`, or `status` are committed successfully.

### Function: `saveChaptersToDB(chapters: Chapter[]): Promise<void>`

**Postconditions**:
- Applies the exact same preservation guarantees as `saveChapterToDB` for every item in the batch transaction.
