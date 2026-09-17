import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { withProjectLock } from '../db';

describe('withProjectLock Web Locks Serialization & Fallback (User Story 3)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('Fallback mode (Node.js / environment without navigator.locks)', () => {
    beforeEach(() => {
      vi.stubGlobal('navigator', {});
    });

    it('executes fn directly and returns its result when navigator.locks is unavailable', async () => {
      const result = await withProjectLock('proj_test_1', async () => {
        return 'success_fallback';
      });

      expect(result).toBe('success_fallback');
    });

    it('propagates exceptions thrown by fn in fallback mode', async () => {
      await expect(
        withProjectLock('proj_test_fail', async () => {
          throw new Error('Fallback error');
        })
      ).rejects.toThrow('Fallback error');
    });

    it('directly invokes fn when projectId is empty or undefined', async () => {
      const resEmpty = await withProjectLock('', async () => 'empty');
      const resUndef = await withProjectLock(undefined as any, async () => 'undef');

      expect(resEmpty).toBe('empty');
      expect(resUndef).toBe('undef');
    });
  });

  describe('Active Web Locks mode (navigator.locks available)', () => {
    let requestedLocks: Array<{ name: string; options?: any }> = [];
    let activeHolders = new Set<string>();

    beforeEach(() => {
      requestedLocks = [];
      activeHolders.clear();

      const mockLocks = {
        request: vi.fn().mockImplementation(async (name: string, callback: () => Promise<any>) => {
          requestedLocks.push({ name });

          // Simulate mutual exclusion: if lock is already held, wait
          while (activeHolders.has(name)) {
            await new Promise((resolve) => setTimeout(resolve, 5));
          }

          activeHolders.add(name);
          try {
            return await callback();
          } finally {
            activeHolders.delete(name);
          }
        }),
      };

      vi.stubGlobal('navigator', {
        locks: mockLocks,
      });
    });

    it('requests lock with project-lock-${projectId} prefix and returns callback result', async () => {
      const result = await withProjectLock('proj_abc_123', async () => {
        return 42;
      });

      expect(result).toBe(42);
      expect(requestedLocks).toHaveLength(1);
      expect(requestedLocks[0].name).toBe('project-lock-proj_abc_123');
    });

    it('enforces mutual exclusion when multiple operations request lock on the same projectId', async () => {
      const executionLog: string[] = [];

      const op1 = withProjectLock('p_shared', async () => {
        executionLog.push('start_op1');
        await new Promise((resolve) => setTimeout(resolve, 20));
        executionLog.push('end_op1');
        return 'op1_done';
      });

      const op2 = withProjectLock('p_shared', async () => {
        executionLog.push('start_op2');
        await new Promise((resolve) => setTimeout(resolve, 10));
        executionLog.push('end_op2');
        return 'op2_done';
      });

      const [res1, res2] = await Promise.all([op1, op2]);

      expect(res1).toBe('op1_done');
      expect(res2).toBe('op2_done');
      // Op1 must finish before Op2 starts because of mutual exclusion on the same project
      expect(executionLog).toEqual(['start_op1', 'end_op1', 'start_op2', 'end_op2']);
    });

    it('releases lock cleanly when callback throws an error', async () => {
      await expect(
        withProjectLock('p_err_lock', async () => {
          throw new Error('Lock callback error');
        })
      ).rejects.toThrow('Lock callback error');

      // Lock should have been released
      expect(activeHolders.has('project-lock-p_err_lock')).toBe(false);

      // Subsequent call on the same lock should succeed immediately
      const subsequent = await withProjectLock('p_err_lock', async () => 'recovered');
      expect(subsequent).toBe('recovered');
    });

    it('bypasses navigator.locks when projectId is empty string', async () => {
      const res = await withProjectLock('', async () => 'no_lock_needed');

      expect(res).toBe('no_lock_needed');
      expect(requestedLocks).toHaveLength(0);
    });
  });
});
