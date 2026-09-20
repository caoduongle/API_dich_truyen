/**
 * Gemini Network Transport Execution Contract
 */

export interface GeminiFetchOptions {
  url: string;
  apiKey: string;
  payload: Record<string, any>;
  signal?: AbortSignal;
  timeoutMs?: number;
}

export type ExecuteGeminiFetchFn = (
  url: string,
  apiKey: string,
  payload: Record<string, any>,
  signal?: AbortSignal,
  timeoutMs?: number
) => Promise<Response>;
