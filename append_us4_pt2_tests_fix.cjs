const fs = require('fs');
const content = `
  describe('User Story 4: Fail-Closed Deletion Database Error Propagation (Part 2 - T028)', () => {
    it('recoverPendingDeletions returns failedCount > 0 if manifest retrieval throws (T028)', async () => {
      const originalOpen = indexedDB.open;
      (indexedDB.open as any) = vi.fn().mockImplementation(() => {
        const req: any = { result: undefined, onsuccess: null, onerror: null, error: new Error('Simulated DB open failure') };
        setTimeout(() => {
          req.onerror?.({ target: req });
        }, 10);
        return req;
      });

      try {
        resetDBInstanceForTesting();
        const result = await recoverPendingDeletions();
        expect(result.failedCount).toBeGreaterThan(0);
        expect(result.recoveredCount).toBe(0);
      } finally {
        (indexedDB.open as any) = originalOpen;
        resetDBInstanceForTesting();
      }
    });
  });
`;
let lines = fs.readFileSync('src/services/__tests__/projectDeleteQueue.test.ts', 'utf-8').split('\n');
lines.splice(lines.length - 2, 0, content);
fs.writeFileSync('src/services/__tests__/projectDeleteQueue.test.ts', lines.join('\n'), 'utf-8');
