const fs = require('fs');

const content = `
  describe('User Story 5: Discovery Consistency Across Concurrency Windows (T031)', () => {
    it('manifest includes ALL discovered chapter IDs even if discovered during cursor traversal (US5, T031)', async () => {
      // Create a dummy project and chapter
      const p1 = createDummyProject('proj_us5_disc', 'Project US5');
      await saveProjectToDB(p1);
      
      const c1 = createDummyChapter('c_known', 'proj_us5_disc');
      await saveChapterToDB(c1);

      // Access the mock DB instance from the globally stubbed indexedDB.open()
      const req = (indexedDB.open('whatever') as any);
      const db = req.result;
      const originalTx = db.transaction;
      
      let injected = false;

      db.transaction = function(storeNames: string | string[], mode: string) {
        // Intercept the readwrite transaction for deletion (it locks projects, chapters, deletion_manifests, etc)
        if (mode === 'readwrite' && Array.isArray(storeNames) && storeNames.includes('deletion_manifests')) {
          if (!injected) {
            injected = true;
            // Inject a chapter into the mocked chapters map JUST BEFORE the transaction cursors run.
            // This simulates concurrent addition of a chapter after the initial discoverProjectChapterIds() call.
            const hiddenChap = createDummyChapter('c_hidden_disc', 'proj_us5_disc');
            mockChapters.set('c_hidden_disc', hiddenChap);
          }
        }
        return originalTx.apply(this, arguments);
      };

      try {
        await deleteProjectFromDB('proj_us5_disc');
        
        // Assert that the manifest contains BOTH known and hidden chapters
        let pendingManifests = Array.from(mockManifests.values());
        expect(pendingManifests.length).toBeGreaterThan(0);
        
        const manifest = pendingManifests.find(m => m.projectId === 'proj_us5_disc');
        expect(manifest).toBeDefined();
        if (manifest) {
          expect(manifest.chapterIds).toContain('c_known');
          expect(manifest.chapterIds).toContain('c_hidden_disc'); // Proves US5 discovery works
          expect(manifest.physicalDbNames).toContain('crdt_proj_us5_disc_c_known');
          expect(manifest.physicalDbNames).toContain('crdt_proj_us5_disc_c_hidden_disc');
        }
      } finally {
        db.transaction = originalTx;
      }
    });
  });
`;

let lines = fs.readFileSync('src/services/__tests__/projectDeleteQueue.test.ts', 'utf-8').split('\n');
// Find the last });
let lastIdx = -1;
for (let i = lines.length - 1; i >= 0; i--) {
  if (lines[i].trim() === '});') {
    lastIdx = i;
    break;
  }
}

if (lastIdx !== -1) {
  lines.splice(lastIdx, 0, content);
  fs.writeFileSync('src/services/__tests__/projectDeleteQueue.test.ts', lines.join('\n'), 'utf-8');
} else {
  console.error("Could not find the end of the describe block");
}
