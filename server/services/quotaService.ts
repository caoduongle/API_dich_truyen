import crypto from 'crypto';

export type QuotaAttemptStatus = 'success' | 'overloaded' | 'quota_exceeded' | 'safety' | 'error';

export interface ModelUsageStats {
  requestsTotal: number;
  requestsToday: number;
  requestsThisMinute: number;
  errorsTotal: number;
}

interface InternalModelStats {
  requestsTotal: number;
  requestsToday: number;
  errorsTotal: number;
  requestTimestamps: number[];
  lastResetDay: string;
}

interface InternalKeyStats {
  keyHash: string;
  maskedKey: string;
  requestsTotal: number;
  requestsToday: number;
  errorsTotal: number;
  requestTimestamps: number[];
  byModel: Map<string, InternalModelStats>;
  lastResetDay: string;
  lastRequestTimestamp?: number;
}

export interface KeyQuotaSnapshot {
  keyHash: string;
  maskedKey: string;
  requestsTotal: number;
  requestsToday: number;
  requestsThisMinute: number;
  errorsTotal: number;
  byModel: Record<string, ModelUsageStats>;
  lastRequestTimestamp?: number;
}

export function hashApiKey(key: string): string {
  if (!key) return '';
  return crypto.createHash('sha256').update(key.trim()).digest('hex');
}

export function maskApiKey(key: string): string {
  if (!key) return '';
  const trimmed = key.trim();
  if (trimmed.length <= 10) {
    return '***';
  }
  return `${trimmed.slice(0, 6)}...${trimmed.slice(-4)}`;
}

export function getDayInLosAngeles(timestamp: number = Date.now()): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(new Date(timestamp));
}

class QuotaService {
  private keyStatsMap = new Map<string, InternalKeyStats>();

  /**
   * Ghi nhận 1 lượt sử dụng API key và model tương ứng
   */
  public recordUsage(
    key: string,
    modelName: string,
    status: QuotaAttemptStatus,
    timestamp: number = Date.now()
  ): void {
    if (!key || !key.trim()) return;

    const trimmedKey = key.trim();
    const keyHash = hashApiKey(trimmedKey);
    const maskedKey = maskApiKey(trimmedKey);
    const currentDay = getDayInLosAngeles(timestamp);
    const normalizedModel = modelName ? (modelName.startsWith('models/') ? modelName : `models/${modelName}`) : 'unknown';

    let stats = this.keyStatsMap.get(keyHash);
    if (!stats) {
      stats = {
        keyHash,
        maskedKey,
        requestsTotal: 0,
        requestsToday: 0,
        errorsTotal: 0,
        requestTimestamps: [],
        byModel: new Map<string, InternalModelStats>(),
        lastResetDay: currentDay,
      };
      this.keyStatsMap.set(keyHash, stats);
    }

    // Kiểm tra reset ngày mới theo múi giờ America/Los_Angeles
    if (stats.lastResetDay !== currentDay) {
      stats.requestsToday = 0;
      stats.lastResetDay = currentDay;
    }

    stats.requestsTotal++;
    stats.requestsToday++;
    stats.lastRequestTimestamp = timestamp;
    stats.requestTimestamps.push(timestamp);

    if (status !== 'success') {
      stats.errorsTotal++;
    }

    // Dọn dẹp các mốc timestamp cũ hơn 60 giây để tránh tràn bộ nhớ
    const minuteThreshold = timestamp - 60000;
    stats.requestTimestamps = stats.requestTimestamps.filter(t => t > minuteThreshold);

    // Cập nhật thống kê theo từng model
    let modelStats = stats.byModel.get(normalizedModel);
    if (!modelStats) {
      modelStats = {
        requestsTotal: 0,
        requestsToday: 0,
        errorsTotal: 0,
        requestTimestamps: [],
        lastResetDay: currentDay,
      };
      stats.byModel.set(normalizedModel, modelStats);
    }

    if (modelStats.lastResetDay !== currentDay) {
      modelStats.requestsToday = 0;
      modelStats.lastResetDay = currentDay;
    }

    modelStats.requestsTotal++;
    modelStats.requestsToday++;
    modelStats.requestTimestamps.push(timestamp);
    modelStats.requestTimestamps = modelStats.requestTimestamps.filter(t => t > minuteThreshold);

    if (status !== 'success') {
      modelStats.errorsTotal++;
    }
  }

  /**
   * Lấy snapshot thống kê sử dụng cho danh sách keys
   */
  public getQuotaSnapshot(keys: string[], timestamp: number = Date.now()): KeyQuotaSnapshot[] {
    const currentDay = getDayInLosAngeles(timestamp);
    const minuteThreshold = timestamp - 60000;

    return keys.map((key) => {
      const trimmedKey = key.trim();
      const keyHash = hashApiKey(trimmedKey);
      const masked = maskApiKey(trimmedKey);

      const stats = this.keyStatsMap.get(keyHash);
      if (!stats) {
        return {
          keyHash,
          maskedKey: masked,
          requestsTotal: 0,
          requestsToday: 0,
          requestsThisMinute: 0,
          errorsTotal: 0,
          byModel: {},
        };
      }

      // Kiểm tra reset ngày
      const requestsToday = stats.lastResetDay === currentDay ? stats.requestsToday : 0;
      const requestsThisMinute = stats.requestTimestamps.filter(t => t > minuteThreshold).length;

      const byModelSnapshot: Record<string, ModelUsageStats> = {};
      for (const [model, mStats] of stats.byModel.entries()) {
        byModelSnapshot[model] = {
          requestsTotal: mStats.requestsTotal,
          requestsToday: mStats.lastResetDay === currentDay ? mStats.requestsToday : 0,
          requestsThisMinute: mStats.requestTimestamps.filter(t => t > minuteThreshold).length,
          errorsTotal: mStats.errorsTotal,
        };
      }

      return {
        keyHash,
        maskedKey: stats.maskedKey || masked,
        requestsTotal: stats.requestsTotal,
        requestsToday,
        requestsThisMinute,
        errorsTotal: stats.errorsTotal,
        byModel: byModelSnapshot,
        lastRequestTimestamp: stats.lastRequestTimestamp,
      };
    });
  }

  /**
   * Reset toàn bộ dữ liệu in-memory (dùng cho testing)
   */
  public resetAll(): void {
    this.keyStatsMap.clear();
  }
}

export const quotaService = new QuotaService();
