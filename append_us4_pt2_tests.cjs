const fs = require('fs');
const content = `
  describe('User Story 4: Fail-Closed Deletion Database Error Propagation (Part 2 - T028)', () => {
    it('recoverPendingDeletions returns failedCount > 0 if manifest retrieval throws (T028)', async () => {
      // Mock getPendingDeletionManifests by mocking initDB or IDB transactions inside it.
      // Easiest is to mock indexedDB.open to fail momentarily, but that affects everything.
      // Instead we can mock the transaction object.
      // Actually we can just spy on getPendingDeletionManifests?
      // It's not exported in a way we can spy if used internally, wait, it IS exported.
      // But it's called in the same module. Let's just mock db.transaction to throw.
      
      const db = await initDB();
      const originalTx = db.transaction;
      db.transaction = function(storeNames, mode) {
        if (storeNames === DELETION_MANIFESTS_STORE) {
          throw new Error('Simulated read error');
        }
        return originalTx.apply(this, arguments);
      };

      try {
        const result = await recoverPendingDeletions();
        expect(result.failedCount).toBeGreaterThan(0);
        expect(result.recoveredCount).toBe(0);
      } finally {
        db.transaction = originalTx;
      }
    });
  });
`;
let lines = fs.readFileSync('src/services/__tests__/projectDeleteQueue.test.ts', 'utf-8').split('\n');
lines.splice(lines.length - 2, 0, content);
fs.writeFileSync('src/services/__tests__/projectDeleteQueue.test.ts', lines.join('\n'), 'utf-8');
