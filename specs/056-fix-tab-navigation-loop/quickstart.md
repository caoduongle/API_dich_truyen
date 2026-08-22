# Quickstart & Verification Guide: Fix Tab Navigation Loop

## 1. Prerequisites
- Node.js >= 18
- Running dev server on `http://localhost:3000` via `npm run dev`

---

## 2. Automated Quality Gates

Run all constitution-mandated checks:
```bash
# 1. Type check
npm run lint

# 2. Unit test suite
npm test

# 3. Production build
npm run build
```

---

## 3. End-to-End Browser Validation Scenarios

### Scenario A: Bidirectional Tab Switching (Mouse Interaction)
1. Open `http://localhost:3000/`.
2. Verify initial tab is `Translation Workspace` (`#tab-translate` active).
3. Click tab 2 (`Batch Auto-Translator` / `#tab-auto-translate`):
   - **Expected**: Panel changes to Batch Auto-Translator.
4. Click tab 3 (`Character Glossary` / `#tab-glossary`):
   - **Expected**: Panel changes to Character Glossary.
5. Click tab 4 (`Chapter History` / `#tab-history`):
   - **Expected**: Panel changes to Chapter History.
6. Click tab 5 (`Novel Projects` / `#tab-projects`):
   - **Expected**: Panel changes to Novel Projects.
7. **Leftward Test 1**: Click tab 4 (`Chapter History`):
   - **Expected**: Successfully switches back leftward to Chapter History.
8. **Leftward Test 2**: Click tab 2 (`Batch Auto-Translator`):
   - **Expected**: Successfully switches back leftward to Batch Auto-Translator.
9. **Leftward Test 3**: Click tab 1 (`Translation Workspace`):
   - **Expected**: Successfully switches back leftward to Translation Workspace.

### Scenario B: Keyboard Shortcut Navigation (Alt+1..5)
1. From Tab 1, press `Alt+4` → Switches to Chapter History.
2. Press `Alt+1` → Switches back to Translation Workspace.
3. Press `Alt+3` → Switches to Character Glossary.
4. Press `Alt+2` → Switches back to Batch Auto-Translator.

### Scenario C: Console Error Audit
1. Open Chrome DevTools > Console.
2. Filter for `error`.
3. Switch rapidly between all 5 tabs and type sample text into the Translation Workspace editor.
4. **Expected**: **0** instances of `Maximum update depth exceeded`. Zero runtime uncaught exceptions.
