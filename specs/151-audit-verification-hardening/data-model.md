# Data Model & Schema Invariants: Production Verification & Integrity Hardening

**Feature**: `151-audit-verification-hardening`  
**Date**: 2026-09-20  
**Spec Reference**: [spec.md](spec.md)

---

## 1. Entities & Type Definitions

### 1.1 PublicUrlConfig

Represents the validated and normalized origin and base path configuration for build-time transformation and runtime SEO metadata.

```typescript
export interface PublicUrlConfig {
  /**
   * The web protocol and hostname (and optional port), without trailing slashes.
   * Example: "https://example.com" or "https://api-dich-truyen.onrender.com"
   */
  origin: string;

  /**
   * The application sub-path, guaranteed to start and end with a forward slash.
   * Example: "/" or "/dichtruyen/"
   */
  basePath: string;

  /**
   * The full canonical application URL representing the root route.
   * Calculated as `${origin}${basePath}`.
   * Example: "https://example.com/" or "https://example.com/dichtruyen/"
   */
  canonicalAppUrl: string;
}
```

#### Validation & Normalization Invariants:
1. **Protocol Scheme Invariant**: `origin` MUST start with `http://` or `https://` (case-insensitive).
   - If input is empty, null, or undefined: fallback to `https://api-dich-truyen.onrender.com`.
   - If input has an invalid scheme (e.g., `ftp://`, `javascript:`, `custom-scheme://`, `not-a-url`): log warning and fallback to `https://api-dich-truyen.onrender.com`.
2. **Trailing Slash Invariant**: `origin` MUST NOT contain trailing slashes (e.g., `https://example.com///` -> `https://example.com`).
3. **Base Path Slashes Invariant**: `basePath` MUST start with a leading slash `/` and end with a trailing slash `/` (e.g. `dichtruyen` -> `/dichtruyen/`, `""` -> `/`).
4. **Canonical Join Invariant**: `canonicalAppUrl` MUST strictly equal `${origin}${basePath}` without double slashes between origin and base.

---

### 1.2 ChapterSequenceOrder

Defines the author's intended sequence of chapters in a `StoryProject` for digital publishing (EPUB).

```typescript
export interface ChapterSequenceOrder {
  /**
   * Ordered list of chapter IDs extracted from `proj.chapters` manifest.
   */
  orderedIds: string[];

  /**
   * Lookup map of chapter ID to zero-based position index.
   */
  indexMap: Map<string, number>;
}
```

#### Ordering Invariants:
1. **Manifest Supremacy Invariant**: When sorting `StoryChapter[]` for EPUB generation, the position in `proj.chapters` takes precedence over `createdAt` timestamp:
   ```typescript
   orderA = indexMap.get(a.id) ?? Number.MAX_SAFE_INTEGER;
   orderB = indexMap.get(b.id) ?? Number.MAX_SAFE_INTEGER;
   if (orderA !== orderB) return orderA - orderB;
   return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
   ```
2. **Deterministic Fallback Invariant**: If two chapters have identical or unmapped indices, sort order deterministically falls back to `createdAt` ascending.

---

### 1.3 DatabaseWriteQueueState & Storage State Invariant

Defines the sequential FIFO execution and final persistence state guarantees for IndexedDB mutations.

```typescript
export interface DatabaseWriteQueueState {
  /**
   * In-memory Promise chain mapping project ID to serialization promise.
   */
  projectWriteChains: Map<string, Promise<void>>;
}
```

#### Queue Invariants:
1. **Strict FIFO Invariant**: For an interleaved sequence `[Save(A1), Save(A2), Delete(A), Save(A3)]`:
   - Execution order is strictly `Save(A1) -> Save(A2) -> Delete(A) -> Save(A3)`.
   - The final persistent state in IndexedDB is `A3`.
   - `getProjectFromDB(projectId)` returns `A3`.
   - Record `A` is NOT deleted or lost due to race conditions.
   - Deleted state from `Delete(A)` is cleanly cleared and overwritten by subsequent `Save(A3)`.
