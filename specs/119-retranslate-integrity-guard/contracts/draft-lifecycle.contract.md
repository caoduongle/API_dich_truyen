# Contract: Draft Lifecycle & Integrity Guard

## 1. Module: `src/services/chapterTranslationService.ts`

### `isDraftTruncated`

```typescript
export function isDraftTruncated(draft: string, sourceText: string): boolean;
```

#### Pre-conditions
- `draft` and `sourceText` are strings.

#### Post-conditions
- Returns `false` if `sourceText.trim().length <= 150` (short fragments).
- Returns `true` if `draft.trim().length < sourceText.trim().length * 0.35` (character length deficit).
- Returns `true` if source text has $\ge 3$ paragraphs, draft has only $1$ paragraph, and draft length is $< 50\%$ of source length.
- Returns `false` otherwise.

---

### `executeSingleChapterTranslation`

```typescript
export async function executeSingleChapterTranslation(
  params: ExecuteSingleChapterTranslationParams
): Promise<SingleChapterResult>;
```

#### Updated Behavior Contract
1. **Mode `'from_scratch'`**: Unconditionally calls `translateRawDirect` from `chapter.sourceText`. NEVER skips Phase 1.
2. **Mode `'repolish'`**:
   - Inspects `chapter.rawTranslation`.
   - If `chapter.rawTranslation` is non-empty AND `!isDraftTruncated(chapter.rawTranslation, chapter.sourceText)`:
     - Sets `firstDraft = chapter.rawTranslation`.
     - Logs: `[Chuốt lại] Sử dụng bản dịch thô khả dụng (Bỏ qua Giai đoạn 1)...`.
     - Skips calling `translateRawDirect`.
   - Otherwise:
     - Logs warning if draft was truncated.
     - Calls `translateRawDirect` to produce a fresh, complete raw draft.
3. **Draft Preservation on Save**:
   - If Phase 1 was skipped: `updatedFullChapter.rawTranslation` MUST equal the existing `chapter.rawTranslation` (never overwritten with modified or truncated text).
   - Only `polishedTranslation`, `translatedLines`, `updatedAt`, and `status` are updated.

---

## 2. Module: `src/components/ChapterHistoryPanel.tsx`

### Handlers Contract

#### `handleDeletePolishedTranslation(chapId: string): Promise<void>`
- Confirms with user via `showConfirm`.
- Clears `polishedTranslation = ''`.
- If `rawTranslation` exists: sets status to `'in_progress'`.
- Saves to DB via `saveChapterToDB`.
- Updates `selectedChapterDetails` and triggers `onUpdateProject`.
- Sets `historyViewTab = 'raw'`.
- Emits toast notification.

#### `handleDeleteRawTranslation(chapId: string): Promise<void>`
- Confirms with user via `showConfirm`.
- Clears `rawTranslation = ''`.
- If `polishedTranslation` is also empty: sets status to `'not_started'`.
- Saves to DB via `saveChapterToDB`.
- Updates `selectedChapterDetails` and triggers `onUpdateProject`.
- Sets `historyViewTab = 'source'`.
- Emits toast notification.

#### `handlePromotePolishedToRaw(chapId: string): Promise<void>`
- Confirms with user via `showConfirm`.
- Reads `polishedTranslation`.
- Sets `rawTranslation = polishedTranslation`, clears `polishedTranslation = ''`.
- Sets status to `'in_progress'`.
- Saves to DB via `saveChapterToDB`.
- Updates `selectedChapterDetails` and triggers `onUpdateProject`.
- Sets `historyViewTab = 'raw'`.
- Emits toast notification.
