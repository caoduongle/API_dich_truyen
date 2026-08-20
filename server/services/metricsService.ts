/**
 * Metrics & Health Service for Monitoring
 * Thu thập và thống kê hiệu năng, lưu lượng truy cập và tình trạng hệ thống.
 */

export interface PathMetric {
  count: number;
  totalLatencyMs: number;
  minLatencyMs: number;
  maxLatencyMs: number;
  errorCount: number;
}

export class MetricsService {
  private startTime: number = Date.now();
  private totalRequests: number = 0;
  private totalErrors: number = 0;
  private totalLatencyMs: number = 0;
  private statusCodes: Record<string, number> = {};
  private paths: Record<string, PathMetric> = {};

  // Core Law 3: Provider attempt != Logical user request disambiguation
  private logicalRequestsTotal: number = 0;
  private successfulLogicalRequests: number = 0;
  private failedLogicalRequests: number = 0;
  private providerAttemptsTotal: number = 0;
  private retriesTotal: number = 0;

  recordLogicalRequest(isSuccess: boolean = true): void {
    this.logicalRequestsTotal++;
    if (isSuccess) {
      this.successfulLogicalRequests++;
    } else {
      this.failedLogicalRequests++;
    }
  }

  recordProviderAttempt(modelId?: string, isSuccess: boolean = true, latencyMs?: number): void {
    this.providerAttemptsTotal++;
  }

  recordRetry(): void {
    this.retriesTotal++;
  }

  recordRequest(method: string, path: string, statusCode: number, latencyMs: number): void {
    this.totalRequests++;
    this.totalLatencyMs += latencyMs;

    const isError = statusCode >= 400;
    if (isError) {
      this.totalErrors++;
    }

    // Status code bucket
    const statusKey = String(statusCode);
    this.statusCodes[statusKey] = (this.statusCodes[statusKey] || 0) + 1;

    // Path metric (loại bỏ query params)
    const cleanPath = `${method.toUpperCase()} ${path.split('?')[0]}`;
    if (!this.paths[cleanPath]) {
      this.paths[cleanPath] = {
        count: 0,
        totalLatencyMs: 0,
        minLatencyMs: latencyMs,
        maxLatencyMs: latencyMs,
        errorCount: 0,
      };
    }

    const p = this.paths[cleanPath];
    p.count++;
    p.totalLatencyMs += latencyMs;
    p.minLatencyMs = Math.min(p.minLatencyMs, latencyMs);
    p.maxLatencyMs = Math.max(p.maxLatencyMs, latencyMs);
    if (isError) {
      p.errorCount++;
    }
  }

  getUptimeSeconds(): number {
    return Math.floor((Date.now() - this.startTime) / 1000);
  }

  getFormattedUptime(): string {
    const totalSecs = this.getUptimeSeconds();
    const days = Math.floor(totalSecs / 86400);
    const hours = Math.floor((totalSecs % 86400) / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;

    const parts: string[] = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (mins > 0) parts.push(`${mins}m`);
    parts.push(`${secs}s`);
    return parts.join(' ');
  }

  getMemoryUsage() {
    const mem = process.memoryUsage();
    return {
      rssMb: Math.round((mem.rss / 1024 / 1024) * 10) / 10,
      heapTotalMb: Math.round((mem.heapTotal / 1024 / 1024) * 10) / 10,
      heapUsedMb: Math.round((mem.heapUsed / 1024 / 1024) * 10) / 10,
      externalMb: Math.round((mem.external / 1024 / 1024) * 10) / 10,
    };
  }

  getMetrics() {
    const avgLatencyMs =
      this.totalRequests > 0
        ? Math.round((this.totalLatencyMs / this.totalRequests) * 10) / 10
        : 0;

    const errorRatePercent =
      this.totalRequests > 0
        ? Math.round((this.totalErrors / this.totalRequests) * 1000) / 10
        : 0;

    const formattedPaths: Record<
      string,
      {
        count: number;
        avgLatencyMs: number;
        minLatencyMs: number;
        maxLatencyMs: number;
        errorCount: number;
      }
    > = {};

    for (const [key, val] of Object.entries(this.paths)) {
      formattedPaths[key] = {
        count: val.count,
        avgLatencyMs: Math.round((val.totalLatencyMs / val.count) * 10) / 10,
        minLatencyMs: val.minLatencyMs,
        maxLatencyMs: val.maxLatencyMs,
        errorCount: val.errorCount,
      };
    }

    return {
      uptimeSeconds: this.getUptimeSeconds(),
      uptimeFormatted: this.getFormattedUptime(),
      totalRequests: this.totalRequests,
      totalErrors: this.totalErrors,
      errorRatePercent,
      avgLatencyMs,
      statusCodes: this.statusCodes,
      endpoints: formattedPaths,
      memory: this.getMemoryUsage(),
      // Disambiguated metrics
      logicalRequestsTotal: this.logicalRequestsTotal,
      successfulLogicalRequests: this.successfulLogicalRequests,
      failedLogicalRequests: this.failedLogicalRequests,
      providerAttemptsTotal: this.providerAttemptsTotal,
      retriesTotal: this.retriesTotal,
    };
  }

  reset(): void {
    this.startTime = Date.now();
    this.totalRequests = 0;
    this.totalErrors = 0;
    this.totalLatencyMs = 0;
    this.statusCodes = {};
    this.paths = {};
    this.logicalRequestsTotal = 0;
    this.successfulLogicalRequests = 0;
    this.failedLogicalRequests = 0;
    this.providerAttemptsTotal = 0;
    this.retriesTotal = 0;
  }
}

export const metricsService = new MetricsService();
