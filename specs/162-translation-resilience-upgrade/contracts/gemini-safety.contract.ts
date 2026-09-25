/**
 * Contract: Gemini Permissive Safety Configuration
 * File: specs/162-translation-resilience-upgrade/contracts/gemini-safety.contract.ts
 */

export enum HarmCategory {
  HARM_CATEGORY_HARASSMENT = 'HARM_CATEGORY_HARASSMENT',
  HARM_CATEGORY_HATE_SPEECH = 'HARM_CATEGORY_HATE_SPEECH',
  HARM_CATEGORY_SEXUALLY_EXPLICIT = 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
  HARM_CATEGORY_DANGEROUS_CONTENT = 'HARM_CATEGORY_DANGEROUS_CONTENT',
}

export enum HarmBlockThreshold {
  BLOCK_NONE = 'BLOCK_NONE',
  BLOCK_LOW_AND_ABOVE = 'BLOCK_LOW_AND_ABOVE',
  BLOCK_MEDIUM_AND_ABOVE = 'BLOCK_MEDIUM_AND_ABOVE',
  BLOCK_ONLY_HIGH = 'BLOCK_ONLY_HIGH',
}

export interface GeminiSafetySetting {
  category: HarmCategory | string;
  threshold: HarmBlockThreshold | string;
}

/**
 * Cấu hình an toàn tối đa cho tiểu thuyết mạng:
 * Hạ mức kiểm duyệt xuống BLOCK_NONE cho 4 danh mục vi phạm chuẩn
 * để tránh chặn nhầm văn cảnh kiếm hiệp / huyền huyễn.
 */
export declare function getPermissiveSafetySettings(): GeminiSafetySetting[];
