# Contract: Text Cleaner & Storage Usage Component

## 1. Function Contract: `cleanChineseText` in `src/utils/textCleaner.ts`

### TypeScript Signature
```typescript
export function cleanChineseText(text: string): string;
```

### Behavioral Invariants
1. **Empty/Falsy Handling**: If `!text`, returns `""` immediately.
2. **Invisible Character Removal**: Any occurrences of `\u200B`, `\uFEFF`, `\u200D`, and `\u200C` in the input MUST be completely removed:
   ```typescript
   cleaned = cleaned.replace(/[\u200B\uFEFF\u200D\u200C]/g, "");
   ```
3. **Punctuation & Words Preservation**: Visible Chinese characters, standard punctuation (`，。！？“”‘’`), and alphanumeric characters must remain intact.
4. **NFC Normalization**: The final output MUST be normalized with `.normalize('NFC')`.
5. **No Regressions**: `separateChapterTitleAndBody` must continue to identify and split chapter headings on strings pre-cleaned with `cleanChineseText`.

---

## 2. Component Contract: `StorageUsageSection`

### Location
`src/components/api-settings/StorageUsageSection.tsx`

### Component Props
```typescript
export interface StorageUsageSectionProps {
  className?: string;
}
```

### Behavioral Invariants
1. On component mount, automatically triggers an asynchronous call to `estimateStorageUsage()`.
2. While fetching or on initial render, handles asynchronous state cleanly without UI jitter.
3. If `estimateStorageUsage()` resolves to `null` (e.g., unsupported browser, incognito restrictions), the component renders `null` (invisible).
4. If a valid `StorageUsageEstimate` is returned:
   - Renders a container with label: `Dung lượng bộ nhớ cục bộ (IndexedDB)`.
   - Displays a progress bar representing `percentUsed` (0% to 100%).
   - Displays textual details: `${formattedUsage} / ${formattedQuota} (${percentUsed}%)`.
   - If `isNearLimit === true`, displays a warning badge / indicator.
   - Provides a refresh button (`<RefreshCw />`) with title `"Làm mới dung lượng"` that re-executes `estimateStorageUsage()`.
