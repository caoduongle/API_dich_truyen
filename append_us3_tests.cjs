const fs = require('fs');
const content = `
  describe('User Story 3: Protect Project Write Paths from Bypassing FK Guard (T018, T019)', () => {
    it('saveProjectToDB refuses to re-parent an existing chapter to another projectId (T018)', async () => {
      const p1 = createDummyProject('proj_save_proj_orig', 'Original');
      await saveProjectToDB(p1);
      const c = createDummyChapter('c_save_proj_locked', 'proj_save_proj_orig');
      await saveChapterToDB(c);

      const p2 = createDummyProject('proj_save_proj_attacker', 'Attacker');
      p2.chapters = [ { ...c, projectId: 'proj_save_proj_attacker' } ];
      
      await expect(saveProjectToDB(p2)).rejects.toThrow(
        'Relational integrity violation: Cannot re-parent chapter "c_save_proj_locked" from project "proj_save_proj_orig" to "proj_save_proj_attacker".'
      );
    });

    it('atomicSaveProjectBundle refuses to re-parent an existing chapter to another projectId (T019)', async () => {
      const p1 = createDummyProject('proj_atomic_orig', 'Original');
      await saveProjectToDB(p1);
      const c = createDummyChapter('c_atomic_locked', 'proj_atomic_orig');
      await saveChapterToDB(c);

      const p2 = createDummyProject('proj_atomic_attacker', 'Attacker');
      
      await expect(atomicSaveProjectBundle({ ...p2, id: 'proj_atomic_attacker' }, [ { ...c, projectId: 'proj_atomic_attacker' } ])).rejects.toThrow(
        'Relational integrity violation: Cannot re-parent chapter "c_atomic_locked" from project "proj_atomic_orig" to "proj_atomic_attacker".'
      );
    });
  });
`;
let lines = fs.readFileSync('src/services/__tests__/projectDeleteQueue.test.ts', 'utf-8').split('\n');
lines.splice(lines.length - 2, 0, content);
fs.writeFileSync('src/services/__tests__/projectDeleteQueue.test.ts', lines.join('\n'), 'utf-8');
