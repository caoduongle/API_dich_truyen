# Contract: Chapter Filename Formatting & Resolution

**Module**: `src/services/google-drive/driveGranularSync.ts`
**Feature**: `071-drive-chapter-filename-format`

---

## 1. Exported Utility Signatures

```typescript
/**
 * Converts chapter title into a clean URL/filename-safe ASCII slug.
 * Removes Vietnamese accents, special characters, and limits to 30 characters.
 */
export function sanitizeChapterTitleSlug(title: string): string;

/**
 * Returns a deterministic, readable Google Drive filename for a chapter.
 * Format: chapter_{001-999}_{slug}.json or chapter_{001-999}.json
 */
export function formatChapterFileName(index: number, title?: string, chapId?: string): string;
```

---

## 2. Invariants & Output Requirements

1. **Deterministic Output**: Given the same `index` and `title`, `formatChapterFileName` always returns the identical string.
2. **Safe Filenames**: Contains only lowercase ASCII characters `[a-z0-9]`, hyphens `-`, underscores `_`, and `.json` extension.
3. **No `chap_` prefix duplication**: Strips internal ID prefixes if used as fallback.
4. **Index Zero-Padding**: Indices are 1-based and padded to at least 3 digits (`001`, `002`, `010`, `100`).
