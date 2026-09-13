# Contract: CRDT Session Lifecycle & Auto-Save Preservation

**Module**: `src/hooks/useChapterCRDT.ts`  
**Consumers**: `useWorkspaceState.ts`, `TranslatorWorkspace.tsx`, `BilingualEditor.tsx`

## Contract Specification

### Hook: `useChapterCRDT(options: UseChapterCRDTOptions)`

#### 1. Hydration Contract
- When `chapterId` becomes non-null:
  - If `initialChapter` is provided and contains `sourceText` / `rawTranslation`, seed the Y.Doc immediately.
  - If `initialChapter` is null or lacks full fields, asynchronously load the existing chapter via `getChapterFromDB(chapterId)`.
  - Upon receiving the DB record:
    - If `rawText` in `doc` is empty and `dbChap.rawTranslation` exists: insert `dbChap.rawTranslation`.
    - If `polishedText` in `doc` is empty and `dbChap.polishedTranslation` exists: insert `dbChap.polishedTranslation`.
    - Set `metadataMap.set('sourceText', dbChap.sourceText)`.
    - Set `metadataMap.set('title', dbChap.title)`.
    - Set `metadataMap.set('paragraphs', dbChap.paragraphs)`.
    - Set `metadataMap.set('translatedLines', dbChap.translatedLines)`.

#### 2. Auto-Save Contract (`debouncedSaveToDb`)
- When `doc.on('update')` triggers auto-save:
  - The handler MUST fetch `existing = await getChapterFromDB(chapId)`.
  - It builds a merged record:
    - `sourceText = (snapshot.sourceText && snapshot.sourceText.trim()) || existing?.sourceText || ''`
    - `rawTranslation = (snapshot.rawTranslation && snapshot.rawTranslation.trim()) || existing?.rawTranslation || ''`
    - `title = (snapshot.title && snapshot.title.trim()) || existing?.title || ''`
    - `paragraphs = (snapshot.paragraphs?.length) ? snapshot.paragraphs : (existing?.paragraphs || [])`
    - `translatedLines = (snapshot.translatedLines?.length) ? snapshot.translatedLines : (existing?.translatedLines || [])`
    - `createdAt = existing?.createdAt || snapshot.createdAt || new Date().toISOString()`
    - `updatedAt = snapshot.updatedAt || new Date().toISOString()`
  - Calls `saveChapterToDB(mergedChapter)`.
  - Saves CRDT binary state `saveCrdtState(...)`.
