import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BoundedConcurrencyQueue } from '../concurrencyGate';

describe('Bounded Concurrency Queue & Backpressure (TASK 09)', () => {
  let queue: BoundedConcurrencyQueue;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // 1. 50 concurrent
  it('50 concurrent: allows 50 simultaneous tasks to execute immediately without queue wait', async () => {
    queue = new BoundedConcurrencyQueue({
      maxConcurrent: 50,
      maxDepth: 100,
      queueTimeoutMs: 10000,
    });

    let runningCount = 0;
    let peakRunning = 0;
    const taskResolvers: (() => void)[] = [];

    // Tạo 50 tasks
    const promises = Array.from({ length: 50 }, () =>
      queue.execute(async () => {
        runningCount++;
        peakRunning = Math.max(peakRunning, runningCount);
        await new Promise<void>((resolve) => {
          taskResolvers.push(resolve);
        });
        runningCount--;
        return 'done';
      })
    );

    // Cả 50 tasks đều active ngay lập tức
    expect(queue.getMetrics().activeCount).toBe(50);
    expect(queue.getMetrics().queuedCount).toBe(0);
    expect(peakRunning).toBe(50);

    // Cho 50 tasks hoàn tất
    taskResolvers.forEach((r) => r());
    const results = await Promise.all(promises);

    expect(results.length).toBe(50);
    expect(queue.getMetrics().activeCount).toBe(0);
    expect(queue.getMetrics().totalExecuted).toBe(50);
  });

  // 2. 51st behavior
  it('51st behavior: enqueues 51st task and drains it immediately when a slot is released', async () => {
    queue = new BoundedConcurrencyQueue({
      maxConcurrent: 50,
      maxDepth: 100,
      queueTimeoutMs: 10000,
    });

    const taskResolvers: (() => void)[] = [];

    // 50 tasks chiếm toàn bộ slots
    const activePromises = Array.from({ length: 50 }, () =>
      queue.execute(async () => {
        await new Promise<void>((resolve) => {
          taskResolvers.push(resolve);
        });
        return 'active';
      })
    );

    expect(queue.getMetrics().activeCount).toBe(50);
    expect(queue.getMetrics().queuedCount).toBe(0);

    // Request thứ 51 được gửi đến -> Không bị reject mà vào queue chờ
    let task51Completed = false;
    const task51Promise = queue.execute(async () => {
      task51Completed = true;
      return 'task-51-success';
    });

    // Khẳng định task 51 đang nằm trong queue chờ
    expect(queue.getMetrics().activeCount).toBe(50);
    expect(queue.getMetrics().queuedCount).toBe(1);
    expect(task51Completed).toBe(false);

    // Giải phóng 1 slot trong 50 slots ban đầu
    const firstResolver = taskResolvers.shift();
    firstResolver!();

    // Task 51 lập tức được kích hoạt và hoàn tất
    const result51 = await task51Promise;
    expect(result51).toBe('task-51-success');
    expect(task51Completed).toBe(true);
    expect(queue.getMetrics().queuedCount).toBe(0);

    // Giải phóng nốt 49 slots còn lại
    taskResolvers.forEach((r) => r());
    await Promise.all(activePromises);
  });

  // 3. queue full (Backpressure)
  it('queue full: rejects 151st request immediately with QUEUE_FULL backpressure error', async () => {
    // maxConcurrent = 2, maxDepth = 3 -> Total capacity = 5
    const smallQueue = new BoundedConcurrencyQueue({
      maxConcurrent: 2,
      maxDepth: 3,
      queueTimeoutMs: 10000,
    });

    const resolvers: ((val?: any) => void)[] = [];

    // 2 active tasks
    smallQueue.execute(() => new Promise((r) => { resolvers.push(r); }));
    smallQueue.execute(() => new Promise((r) => { resolvers.push(r); }));

    // 3 queued tasks (đầy maxDepth)
    smallQueue.execute(() => Promise.resolve('q1'));
    smallQueue.execute(() => Promise.resolve('q2'));
    smallQueue.execute(() => Promise.resolve('q3'));

    expect(smallQueue.getMetrics().activeCount).toBe(2);
    expect(smallQueue.getMetrics().queuedCount).toBe(3);

    // Task thứ 6 (2 + 3 + 1) -> Vượt quá capacity -> Bị reject ngay lập tức (Backpressure)
    let rejectedError: any = null;
    try {
      await smallQueue.execute(() => Promise.resolve('overflow'));
    } catch (err) {
      rejectedError = err;
    }

    expect(rejectedError).not.toBeNull();
    expect(rejectedError.code).toBe('QUEUE_FULL');
    expect(rejectedError.message).toContain('Backpressure');
    expect(smallQueue.getMetrics().totalRejected).toBe(1);

    // Giải phóng để dọn dẹp
    resolvers.forEach((r) => r());
  });

  // 4. timeout
  it('timeout: rejects task waiting longer than queueTimeoutMs and cleans queue state', async () => {
    const timeoutQueue = new BoundedConcurrencyQueue({
      maxConcurrent: 1,
      maxDepth: 5,
      queueTimeoutMs: 50, // 50ms timeout cho test
    });

    let resolver: () => void = () => {};
    // Chiếm slot duy nhất
    timeoutQueue.execute(() => new Promise((r) => { resolver = r as any; }));

    // Task 2 vào queue chờ và sẽ bị timeout sau 50ms
    let timeoutError: any = null;
    try {
      await timeoutQueue.execute(async () => 'never-runs', { timeoutMs: 50 });
    } catch (err) {
      timeoutError = err;
    }

    expect(timeoutError).not.toBeNull();
    expect(timeoutError.code).toBe('QUEUE_TIMEOUT');
    expect(timeoutError.message).toContain('quá thời gian chờ');
    expect(timeoutQueue.getMetrics().queuedCount).toBe(0);
    expect(timeoutQueue.getMetrics().totalTimeouts).toBe(1);

    resolver();
  });

  // 5. cancel (AbortSignal)
  it('cancel: immediately aborts queued task upon AbortSignal and removes it from queue', async () => {
    const abortQueue = new BoundedConcurrencyQueue({
      maxConcurrent: 1,
      maxDepth: 5,
      queueTimeoutMs: 10000,
    });

    let resolver: () => void = () => {};
    abortQueue.execute(() => new Promise((r) => { resolver = r as any; }));

    const controller = new AbortController();

    // Task 2 vào queue với signal
    const task2Promise = abortQueue.execute(
      async () => 'never-runs',
      { signal: controller.signal }
    );

    expect(abortQueue.getMetrics().queuedCount).toBe(1);

    // Phát tín hiệu hủy
    controller.abort();

    let abortError: any = null;
    try {
      await task2Promise;
    } catch (err) {
      abortError = err;
    }

    expect(abortError).not.toBeNull();
    expect(abortError.name).toBe('AbortError');
    expect(abortQueue.getMetrics().queuedCount).toBe(0);
    expect(abortQueue.getMetrics().totalCancelled).toBe(1);

    resolver();
  });

  // 6. failure
  it('failure: releases slot safely in finally block on task exception so next queued task runs', async () => {
    const failQueue = new BoundedConcurrencyQueue({
      maxConcurrent: 1,
      maxDepth: 5,
      queueTimeoutMs: 10000,
    });

    let failResolver: (err: any) => void = () => {};

    // Task 1 chạy và bị ném lỗi
    const task1Promise = failQueue.execute(() =>
      new Promise((_, reject) => {
        failResolver = reject;
      })
    );

    // Task 2 đang chờ trong queue
    const task2Promise = failQueue.execute(async () => 'task2-recovered');

    expect(failQueue.getMetrics().activeCount).toBe(1);
    expect(failQueue.getMetrics().queuedCount).toBe(1);

    // Gây lỗi task 1
    failResolver(new Error('Simulated Upstream Crash'));

    await expect(task1Promise).rejects.toThrow('Simulated Upstream Crash');

    // Slot phải được trả lại an toàn trong finally và task 2 chạy thành công
    const task2Result = await task2Promise;
    expect(task2Result).toBe('task2-recovered');
    expect(failQueue.getMetrics().activeCount).toBe(0);
    expect(failQueue.getMetrics().queuedCount).toBe(0);
  });
});
