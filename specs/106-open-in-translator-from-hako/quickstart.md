# Quickstart: Testing Direct Jump from Hako Checker to Translator

## Objective
Verify that translation moderators can seamlessly navigate from audited chapters in `HakoCheckerWorkspace` to `TranslatorWorkspace` (`BilingualEditor`) with the relevant chapter loaded, and that missing chapters trigger clear toast error messages.

## Scenario 1: Successful Navigation to Translator
1. **Setup**:
   - Ensure at least 1 project exists with translated chapters.
   - Run `npm run dev` and open `http://localhost:5173/hako-checker` (or switch to the "Kiểm định" tab).
2. **Execute**:
   - Select a project and run quality check (or load a session with detected issues).
   - In the audit results section, find a chapter with detected issues.
   - Click `"Mở trong Bàn Dịch để sửa"`.
3. **Verify**:
   - The app transitions to the `translate` tab (`/` URL pathname).
   - The BilingualEditor opens with the clicked chapter loaded.
   - Both original text and translation are populated ready for editing.

## Scenario 2: Missing Chapter in IndexedDB
1. **Setup**:
   - Simulate a call to `onOpenInTranslator("invalid-chapter-id-99999")` in a test or mocked session.
2. **Execute**:
   - Click the button corresponding to the missing chapter.
3. **Verify**:
   - An error toast appears: `"Không tìm thấy dữ liệu chương!"`.
   - The active tab does NOT switch to 'translate'.
   - The application does not crash.

## Scenario 3: Automated Unit & Contract Tests
Run all test suites:
```bash
npm test -- src/components/hako-checker/
npm run lint
npm run build
```
Expected outcome: All tests pass with zero TypeScript lint or build errors.
