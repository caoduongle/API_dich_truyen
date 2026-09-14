/**
 * Bounded Concurrency Utility
 * Điều phối thực thi tác vụ song song có kiểm soát giới hạn, giữ nguyên thứ tự kết quả
 */

export async function mapWithConcurrencyLimit<T, R>(
  items: T[],
  limit: number = 2,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  if (!items || items.length === 0) {
    return [];
  }

  const effectiveLimit = Math.max(1, Math.floor(limit || 2));
  if (effectiveLimit >= items.length) {
    return Promise.all(items.map((item, index) => worker(item, index)));
  }

  const results: R[] = new Array(items.length);
  let nextIndex = 0;
  let activeError: unknown = null;

  async function runner(): Promise<void> {
    while (nextIndex < items.length) {
      if (activeError) break;
      const currentIndex = nextIndex++;
      try {
        const res = await worker(items[currentIndex], currentIndex);
        results[currentIndex] = res;
      } catch (err) {
        activeError = err;
        throw err;
      }
    }
  }

  const poolSize = Math.min(effectiveLimit, items.length);
  const workers: Promise<void>[] = [];
  for (let i = 0; i < poolSize; i++) {
    workers.push(runner());
  }

  await Promise.all(workers);
  return results;
}
