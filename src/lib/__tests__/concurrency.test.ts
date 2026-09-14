import { describe, it, expect } from 'vitest';
import { mapWithConcurrencyLimit } from '../concurrency';

describe('mapWithConcurrencyLimit', () => {
  it('returns empty array when items array is empty', async () => {
    const res = await mapWithConcurrencyLimit([], 2, async (x) => x);
    expect(res).toEqual([]);
  });

  it('preserves order of results even when execution times vary', async () => {
    const items = [100, 10, 50, 20];
    const res = await mapWithConcurrencyLimit(items, 2, async (delay, idx) => {
      await new Promise((r) => setTimeout(r, delay));
      return `item-${idx}-${delay}`;
    });

    expect(res).toEqual([
      'item-0-100',
      'item-1-10',
      'item-2-50',
      'item-3-20',
    ]);
  });

  it('never exceeds the configured concurrency limit', async () => {
    const items = [1, 2, 3, 4, 5, 6];
    let activeWorkers = 0;
    let maxActiveWorkers = 0;

    await mapWithConcurrencyLimit(items, 2, async () => {
      activeWorkers++;
      maxActiveWorkers = Math.max(maxActiveWorkers, activeWorkers);
      await new Promise((r) => setTimeout(r, 20));
      activeWorkers--;
      return true;
    });

    expect(maxActiveWorkers).toBeLessThanOrEqual(2);
  });

  it('propagates worker error immediately', async () => {
    const items = [1, 2, 3, 4];
    await expect(
      mapWithConcurrencyLimit(items, 2, async (item) => {
        if (item === 2) {
          throw new Error('Worker failure at item 2');
        }
        return item;
      })
    ).rejects.toThrow('Worker failure at item 2');
  });

  it('handles limit larger than items count safely', async () => {
    const items = ['a', 'b'];
    const res = await mapWithConcurrencyLimit(items, 10, async (x) => x.toUpperCase());
    expect(res).toEqual(['A', 'B']);
  });
});
