/**
 * Contract: Polish Strategy & Convergence Detection
 * Location: specs/111-fix-iterative-polish-cache/contracts/polish-strategy.contract.ts
 */

export interface PolishRoundStrategy {
  round: number;
  stageName: string;
  inputLabel: string;
  directive: string;
  temperature: number;
}

export interface ConvergenceResult {
  similarity: number;
  diffPercentage: number;
  changedWordsCount: number;
  isConverged: boolean;
  reason?: string;
}

/**
 * Lấy chiến lược biên tập cho một vòng chuốt cụ thể (1-indexed, hỗ trợ 1..5+)
 */
export type GetPolishStrategyFn = (round: number, totalRounds?: number) => PolishRoundStrategy;

/**
 * Tính toán độ tương đồng giữa hai chuỗi văn bản và xác định xem chu trình đã hội tụ chưa
 */
export type CalculateTextSimilarityFn = (
  prevText: string,
  newText: string,
  threshold?: number
) => ConvergenceResult;
