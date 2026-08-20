export interface BoundedConcurrencyQueueConfig {
  maxConcurrent?: number;
  maxDepth?: number;
  queueTimeoutMs?: number;
}

export interface QueueMetrics {
  activeCount: number;
  queuedCount: number;
  maxConcurrent: number;
  maxDepth: number;
  totalExecuted: number;
  totalRejected: number;
  totalTimeouts: number;
  totalCancelled: number;
}

interface QueuedTask<T> {
  id: string;
  fn: () => Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: any) => void;
  enqueueTime: number;
  timer?: NodeJS.Timeout;
  signal?: AbortSignal;
  abortListener?: () => void;
}

export const DEFAULT_MAX_CONCURRENT = 50;
export const DEFAULT_MAX_DEPTH = 100;
export const DEFAULT_QUEUE_TIMEOUT_MS = 30000;

export class BoundedConcurrencyQueue {
  private maxConcurrent: number;
  private maxDepth: number;
  private queueTimeoutMs: number;

  private activeCount = 0;
  private queue: QueuedTask<any>[] = [];

  private totalExecuted = 0;
  private totalRejected = 0;
  private totalTimeouts = 0;
  private totalCancelled = 0;

  constructor(config: BoundedConcurrencyQueueConfig = {}) {
    this.maxConcurrent = config.maxConcurrent ?? DEFAULT_MAX_CONCURRENT;
    this.maxDepth = config.maxDepth ?? DEFAULT_MAX_DEPTH;
    this.queueTimeoutMs = config.queueTimeoutMs ?? DEFAULT_QUEUE_TIMEOUT_MS;
  }

  public async execute<T>(
    fn: () => Promise<T>,
    options?: { signal?: AbortSignal; timeoutMs?: number }
  ): Promise<T> {
    const signal = options?.signal;
    if (signal?.aborted) {
      this.totalCancelled++;
      const abortErr = new Error('Yêu cầu đã bị hủy bỏ.');
      abortErr.name = 'AbortError';
      throw abortErr;
    }

    // 1. Nếu slot chạy đang trống -> Cấp phát slot ngay lập tức
    if (this.activeCount < this.maxConcurrent) {
      this.activeCount++;
      return this.runTask(fn);
    }

    // 2. Nếu hàng đợi đã đầy -> Backpressure reject ngay lập tức (No unbounded queues)
    if (this.queue.length >= this.maxDepth) {
      this.totalRejected++;
      const err: any = new Error(
        'Hệ thống dịch thuật hiện đang đầy hàng đợi xử lý (Backpressure: QUEUE_FULL). Vui lòng thử lại sau giây lát.'
      );
      err.code = 'QUEUE_FULL';
      throw err;
    }

    // 3. Xếp hàng chờ (Bounded Queue)
    const timeoutDuration = options?.timeoutMs ?? this.queueTimeoutMs;
    const taskId = `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    return new Promise<T>((resolve, reject) => {
      const queuedItem: QueuedTask<T> = {
        id: taskId,
        fn,
        resolve,
        reject,
        enqueueTime: Date.now(),
        signal,
      };

      // Cài đặt Queue Timeout
      if (timeoutDuration > 0) {
        queuedItem.timer = setTimeout(() => {
          this.removeQueuedTask(taskId);
          this.totalTimeouts++;
          const timeoutErr: any = new Error(
            `Yêu cầu dịch thuật đã quá thời gian chờ trong hàng đợi (${Math.round(timeoutDuration / 1000)}s).`
          );
          timeoutErr.code = 'QUEUE_TIMEOUT';
          reject(timeoutErr);
        }, timeoutDuration);
      }

      // Lắng nghe AbortSignal
      if (signal) {
        const abortListener = () => {
          this.removeQueuedTask(taskId);
          this.totalCancelled++;
          const abortErr = new Error('Yêu cầu đã bị hủy trong khi đang chờ trong hàng đợi.');
          abortErr.name = 'AbortError';
          reject(abortErr);
        };
        queuedItem.abortListener = abortListener;
        signal.addEventListener('abort', abortListener, { once: true });
      }

      this.queue.push(queuedItem);
    });
  }

  private async runTask<T>(fn: () => Promise<T>): Promise<T> {
    try {
      this.totalExecuted++;
      return await fn();
    } finally {
      this.activeCount--;
      this.drainNext();
    }
  }

  private drainNext(): void {
    while (this.activeCount < this.maxConcurrent && this.queue.length > 0) {
      const nextTask = this.queue.shift();
      if (!nextTask) break;

      // Dọn dẹp timer và abort listener
      if (nextTask.timer) {
        clearTimeout(nextTask.timer);
      }
      if (nextTask.signal && nextTask.abortListener) {
        nextTask.signal.removeEventListener('abort', nextTask.abortListener);
      }

      // Tăng activeCount và chạy task
      this.activeCount++;
      this.runTask(nextTask.fn)
        .then(nextTask.resolve)
        .catch(nextTask.reject);
    }
  }

  private removeQueuedTask(taskId: string): void {
    const index = this.queue.findIndex((t) => t.id === taskId);
    if (index !== -1) {
      const [task] = this.queue.splice(index, 1);
      if (task.timer) {
        clearTimeout(task.timer);
      }
      if (task.signal && task.abortListener) {
        task.signal.removeEventListener('abort', task.abortListener);
      }
    }
  }

  public getMetrics(): QueueMetrics {
    return {
      activeCount: this.activeCount,
      queuedCount: this.queue.length,
      maxConcurrent: this.maxConcurrent,
      maxDepth: this.maxDepth,
      totalExecuted: this.totalExecuted,
      totalRejected: this.totalRejected,
      totalTimeouts: this.totalTimeouts,
      totalCancelled: this.totalCancelled,
    };
  }

  public resetForTesting(): void {
    for (const task of this.queue) {
      if (task.timer) clearTimeout(task.timer);
      if (task.signal && task.abortListener) {
        task.signal.removeEventListener('abort', task.abortListener);
      }
    }
    this.queue = [];
    this.activeCount = 0;
    this.totalExecuted = 0;
    this.totalRejected = 0;
    this.totalTimeouts = 0;
    this.totalCancelled = 0;
  }
}

export const geminiConcurrencyGate = new BoundedConcurrencyQueue();
