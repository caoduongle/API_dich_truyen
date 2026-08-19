# Quickstart & Verification Guide: Model Lifecycle Management

## 1. Automated Test Execution

```bash
# 1. Type check
npm run lint

# 2. Test suite run (including model lifecycle & migration tests)
npm test

# 3. Production build
npm run build
```

---

## 2. Manual Verification Scenarios

### Scenario 1: Presets Dropdown Contains Only Active Models
1. Open browser on `http://localhost:5173`.
2. Click **Cấu hình AI** -> Model Dropdown.
3. Verify options under "Mô hình khuyên dùng":
   - `gemini-3.1-flash-lite` (Present)
   - `gemini-2.5-flash` (Present)
   - `gemini-2.5-pro` (Present)
   - `gemma-4-31b-it` (Present)
   - `gemini-2.0-flash` (NOT PRESENT)
   - `gemini-1.5-flash` (NOT PRESENT)

### Scenario 2: Startup Migration from Persisted Shutdown Model
1. Open browser DevTools Console.
2. Seed shutdown model into persistent storage:
   ```javascript
   localStorage.setItem('gemini_selected_model', 'gemini-2.0-flash');
   ```
3. Reload the page (`location.reload()`).
4. Verify:
   - Selected model is automatically updated to `gemini-2.5-flash`.
   - `localStorage.getItem('gemini_selected_model')` is `'gemini-2.5-flash'`.
   - No runtime error or page crash occurs.

### Scenario 3: Startup Fallback from Corrupted / Invalid Model ID
1. Seed invalid string into storage:
   ```javascript
   localStorage.setItem('gemini_selected_model', 'invalid_model_id_###@@@');
   ```
2. Reload the page.
3. Verify:
   - Selected model defaults to `gemini-3.1-flash-lite` (`DEFAULT_MODEL_ID`).
   - `localStorage.getItem('gemini_selected_model')` is updated to `'gemini-3.1-flash-lite'`.
