# Quickstart: Issue Review Panel Pagination

## Verification Scenarios

### 1. Automated Quality Gates

```bash
# Verify TypeScript types
npm run lint

# Run all automated tests
npm test

# Verify production bundle compilation
npm run build
```

### 2. Manual Verification Walkthrough

1. **45 Issues Distribution Test**:
   - Open app (`npm run dev`) or mount component with 45 sample issues.
   - Assert Page 1 displays 20 cards and footer indicates "Trang 1 / 3" with "Trang trước" disabled.
   - Click "Trang sau": Page 2 displays 20 cards and footer indicates "Trang 2 / 3" with both buttons enabled.
   - Click "Trang sau": Page 3 displays remaining 5 cards and footer indicates "Trang 3 / 3" with "Trang sau" disabled.
   - Click "Trang trước": Returns smoothly to Page 2.

2. **Filter Reset Test**:
   - While on Page 3, switch severity filter to "Cảnh báo" (e.g. matching 6 issues).
   - Assert page resets to 1, all 6 matching issues are visible, and pagination footer is hidden.

3. **Batch Action Scope Test**:
   - On a 45-issue list across 3 pages, while on Page 2, click "Duyệt nhanh tất cả".
   - Verify all 45 issues are confirmed in one batch call.
