/**
 * Contract: Quota Lifecycle & State Semantics
 * Định nghĩa giao diện vòng đời yêu cầu logic, lượt thử nhà cung cấp và ghi nhận thử lại
 */

export interface LogicalSummaryStats {
  logicalRequestsTotal: number;
  logicalRequestsToday: number;
  successfulRequestsTotal: number;
  successfulRequestsToday: number;
  failedRequestsTotal: number;
  failedRequestsToday: number;
  retriesTotal: number;
  retriesToday: number;
  providerAttemptsTotal: number;
  providerAttemptsToday: number;
  successfulAttemptsTotal: number;
  successfulAttemptsToday: number;
  failedAttemptsTotal: number;
  failedAttemptsToday: number;
  lastResetDay: string;
}

export interface IQuotaLifecycleTracker {
  /**
   * Bắt đầu một yêu cầu logic mới từ client
   */
  recordLogicalRequest(now?: number): void;

  /**
   * Ghi nhận một yêu cầu logic kết thúc trong thất bại hoàn toàn
   */
  recordLogicalFailure(now?: number): void;

  /**
   * Ghi nhận một lượt thử thực tế gửi tới nhà cung cấp API
   */
  recordProviderAttempt(key: string, model: string, now?: number): void;

  /**
   * Ghi nhận một lượt gọi HTTP thành công
   */
  recordSuccess(
    key: string,
    model: string,
    usage: { promptTokens: number; outputTokens: number; totalTokens: number },
    latencyMs: number,
    now?: number
  ): void;

  /**
   * Ghi nhận một lượt gọi HTTP thất bại
   * LƯU Ý: KHÔNG tự động tăng retriesTotal/retriesToday
   */
  recordFailure(
    key: string,
    model: string,
    error: {
      status?: number;
      message?: string;
      details?: unknown[];
      rawResponse?: any;
      isRateLimit?: boolean;
      isAuthError?: boolean;
      isOverload?: boolean;
    },
    now?: number
  ): void;

  /**
   * Ghi nhận một hành vi thử lại (retry) hoặc xoay vòng sang khóa mới (key rotation)
   */
  recordRetry(key?: string, now?: number): void;
}
