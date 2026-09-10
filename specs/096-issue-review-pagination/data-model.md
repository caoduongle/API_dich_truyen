# Data Model: Issue Review Panel Pagination

## Data Structures & State Architecture

This feature requires zero changes to core TypeScript models (`types.ts` or `hakoChecker.ts`). All pagination state is encapsulated locally within `HakoIssueReviewPanel.tsx`.

### 1. Local State Definition

```ts
// Fixed constant
const PAGE_SIZE = 20;

// Component state
const [currentPage, setCurrentPage] = useState<number>(1);
```

### 2. Derived Properties

```ts
// Total pages calculation (at least 1 page)
const totalPages = Math.max(1, Math.ceil(filteredIssues.length / PAGE_SIZE));

// Safe effective page index (1-based)
const effectivePage = Math.min(Math.max(1, currentPage), totalPages);

// Sliced sub-array for the visible page
const displayedIssues = useMemo(() => {
  if (filteredIssues.length <= PAGE_SIZE) {
    return filteredIssues;
  }
  const startIndex = (effectivePage - 1) * PAGE_SIZE;
  return filteredIssues.slice(startIndex, startIndex + PAGE_SIZE);
}, [filteredIssues, effectivePage]);
```

### 3. State Flow Diagram

```
[User Filter or Issues Prop Change]
                │
                ▼
      [Calculate filteredIssues]
                │
                ├──► totalPages = ceil(filteredIssues.length / 20)
                │
                ├──► If filter changed: setCurrentPage(1)
                │    If currentPage > totalPages: clamp currentPage
                │
                ▼
      [Compute displayedIssues (slice 20 items)]
                │
                ├──► Render <HakoIssueCard> for displayedIssues only (max 20)
                │
                └──► If filteredIssues.length > 20:
                     Render Pagination Bar (Trang trước, Trang X/Y, Trang sau)
```
