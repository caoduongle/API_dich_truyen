const fs = require('fs');
const content = `
  describe('User Story 4: Fail-Closed Deletion Database Error Propagation (T024, T025)', () => {
    it('aborts deleteProjectFromDB and retains manifest if provider .destroy() throws (T024)', async () => {
      const p = createDummyProject('p_prov_fail', 'Prov Fail');
      await saveProjectToDB(p);
      const c = createDummyChapter('c_prov_fail_1', 'p_prov_fail');
      await saveChapterToDB(c);

      clearActivePersistencesForTest();
      const faultyDestroy = vi.fn().mockRejectedValue(new Error('Simulated provider destruction failure during project delete'));
      const provider = { destroy: faultyDestroy };
      registerCrdtPersistence('crdt_p_prov_fail_c_prov_fail_1', provider as any, 'p_prov_fail', 'c_prov_fail_1');

      await expect(deleteProjectFromDB('p_prov_fail')).rejects.toThrow('Simulated provider destruction failure during project delete');

      const pendingManifests = await getPendingDeletionManifests();
      expect(pendingManifests.some(m => m.projectId === 'p_prov_fail')).toBe(true);
      expect(deletedDatabases).not.toContain('crdt_p_prov_fail_c_prov_fail_1');
    });
  });
`;
let lines = fs.readFileSync('src/services/__tests__/projectDeleteQueue.test.ts', 'utf-8').split('\n');
lines.splice(lines.length - 2, 0, content);
fs.writeFileSync('src/services/__tests__/projectDeleteQueue.test.ts', lines.join('\n'), 'utf-8');
