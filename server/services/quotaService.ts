import crypto from 'crypto';

export type QuotaAttemptStatus = 'success' | 'overloaded' | 'quota_exceeded' | 'safety' | 'error';

export interface TokenStats {
  promptTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface CallLogEntry {
  timestamp: number;
  tokens: number;
}

export interface ModelUsageStats {
  requestsTotal: number;
  requestsToday: number;
  requestsThisMinute: number;
  errorsTotal: number;
  tokensTotal: number;
  tokensToday: number;
  tokensThisMinute: number;
}

interface InternalModelStats {
  requestsTotal: number;
  requestsToday: number;
  errorsTotal: number;
  tokensTotal: number;
  tokensToday: number;
  recentCalls: CallLogEntry[];
  lastResetDay: string;
}

interface InternalKeyStats {
  keyHash: string;
  maskedKey: string;
  requestsTotal: number;
  requestsToday: number;
  errorsTotal: number;
  tokensTotal: number;
  tokensToday: number;
  recentCalls: CallLogEntry[];
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
  tokensTotal: number;
  tokensToday: number;
  tokensThisMinute: number;
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
   * Ghi nhận 1 lượt sử dụng API key và model tương ứng với số token tiêu thụ
   */
  public recordUsage(
    key: string,
    modelName: string,
    status: QuotaAttemptStatus,
    timestamp: number = Date.now(),
    tokenStats?: TokenStats
  ): void {
    if (!key || !key.trim()) return;

    const trimmedKey = key.trim();
    const keyHash = hashApiKey(trimmedKey);
    const maskedKey = maskApiKey(trimmedKey);
    const currentDay = getDayInLosAngeles(timestamp);
    const normalizedModel = modelName ? (modelName.startsWith('models/') ? modelName : `models/${modelName}`) : 'unknown';
    const tokens = tokenStats?.totalTokens || 0;

    let stats = this.keyStatsMap.get(keyHash);
    if (!stats) {
      stats = {
        keyHash,
        maskedKey,
        requestsTotal: 0,
        requestsToday: 0,
        errorsTotal: 0,
        tokensTotal: 0,
        tokensToday: 0,
        recentCalls: [],
        byModel: new Map<string, InternalModelStats>(),
        lastResetDay: currentDay,
      };
      this.keyStatsMap.set(keyHash, stats);
    }

    // Kiểm tra reset ngày mới theo múi giờ America/Los_Angeles
    if (stats.lastResetDay !== currentDay) {
      stats.requestsToday = 0;
      stats.tokensToday = 0;
      stats.lastResetDay = currentDay;
    }

    stats.requestsTotal++;
    stats.requestsToday++;
    stats.tokensTotal += tokens;
    stats.tokensToday += tokens;
    stats.lastRequestTimestamp = timestamp;
    stats.recentCalls.push({ timestamp, tokens });

    if (status !== 'success') {
      stats.errorsTotal++;
    }

    // Dọn dẹp các mốc timestamp cũ hơn 60 giây (Sliding Window Log 60s)
    const minuteThreshold = timestamp - 60000;
    stats.recentCalls = stats.recentCalls.filter(c => c.timestamp > minuteThreshold);

    // Cập nhật thống kê theo từng model
    let modelStats = stats.byModel.get(normalizedModel);
    if (!modelStats) {
      modelStats = {
        requestsTotal: 0,
        requestsToday: 0,
        errorsTotal: 0,
        tokensTotal: 0,
        tokensToday: 0,
        recentCalls: [],
        lastResetDay: currentDay,
      };
      stats.byModel.set(normalizedModel, modelStats);
    }

    if (modelStats.lastResetDay !== currentDay) {
      modelStats.requestsToday = 0;
      modelStats.tokensToday = 0;
      modelStats.lastResetDay = currentDay;
    }

    modelStats.requestsTotal++;
    modelStats.requestsToday++;
    modelStats.tokensTotal += tokens;
    modelStats.tokensToday += tokens;
    modelStats.recentCalls.push({ timestamp, tokens });
    modelStats.recentCalls = modelStats.recentCalls.filter(c => c.timestamp > minuteThreshold);

    if (status !== 'success') {
      modelStats.errorsTotal++;
    }
  }

  /**
   * Lấy snapshot thống kê sử dụng và token metrics cho danh sách keys
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
          tokensTotal: 0,
          tokensToday: 0,
          tokensThisMinute: 0,
          byModel: {},
        };
      }

      // Lọc các cuộc gọi trong 60 giây gần nhất
      const recentCallsInWindow = stats.recentCalls.filter(c => c.timestamp > minuteThreshold);
      const requestsThisMinute = recentCallsInWindow.length;
      const tokensThisMinute = recentCallsInWindow.reduce((sum, c) => sum + c.tokens, 0);

      // Kiểm tra reset ngày
      const requestsToday = stats.lastResetDay === currentDay ? stats.requestsToday : 0;
      const tokensToday = stats.lastResetDay === currentDay ? stats.tokensToday : 0;

      const byModelSnapshot: Record<string, ModelUsageStats> = {};
      for (const [model, mStats] of stats.byModel.entries()) {
        const mRecentCalls = mStats.recentCalls.filter(c => c.timestamp > minuteThreshold);
        byModelSnapshot[model] = {
          requestsTotal: mStats.requestsTotal,
          requestsToday: mStats.lastResetDay === currentDay ? mStats.requestsToday : 0,
          requestsThisMinute: mRecentCalls.length,
          errorsTotal: mStats.errorsTotal,
          tokensTotal: mStats.tokensTotal,
          tokensToday: mStats.lastResetDay === currentDay ? mStats.tokensToday : 0,
          tokensThisMinute: mRecentCalls.reduce((sum, c) => sum + c.tokens, 0),
        };
      }

      return {
        keyHash,
        maskedKey: stats.maskedKey || masked,
        requestsTotal: stats.requestsTotal,
        requestsToday,
        requestsThisMinute,
        errorsTotal: stats.errorsTotal,
        tokensTotal: stats.tokensTotal,
        tokensToday,
        tokensThisMinute,
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
