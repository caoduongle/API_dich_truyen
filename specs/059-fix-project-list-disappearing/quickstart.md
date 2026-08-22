# Quickstart & Verification Guide: Fix Disappearing Project Card Grid

**Feature Directory**: `specs/059-fix-project-list-disappearing`  
**Feature Branch**: `059-fix-project-list-disappearing`  

---

## 1. Automated Verification Commands

```bash
# 1. Verify TypeScript type correctness
npm run lint

# 2. Run vitest test suite
npm test

# 3. Verify production bundling
npm run build
```

---

## 2. End-to-End Browser Verification Scenarios

### Scenario 1: Tab Switch & Return Visibility
1. Open application in browser at `http://localhost:3000`.
2. Click **Novel Projects** (`Alt+5`).
   - **Expectation**: Project cards render with full opacity (`opacity: 1`).
3. Click **Translation Workspace** (`Alt+1`) and focus the text editor or make an edit.
4. Click **Novel Projects** (`Alt+5`) to return.
   - **Expectation**: 100% of project cards remain visible, fully readable with `opacity: 1`, without disappearing or rendering as an empty grid.

### Scenario 2: Project Actions & Navigation
1. In **Novel Projects** (`Alt+5`), click on a project card.
   - **Expectation**: Active project updates, switches to **Translation Workspace** (`Alt+1`).
2. Press `Alt+5` to return to **Novel Projects**.
   - **Expectation**: The selected card is highlighted with the "Đang dịch" badge and remains visible.
