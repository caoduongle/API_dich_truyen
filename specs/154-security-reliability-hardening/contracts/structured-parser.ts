/**
 * Structured AI Response Ingestion Contract
 */

export interface StructuredParserOptions<T> {
  /** Optional custom schema validator returning a type predicate */
  validator?: (data: unknown) => data is T;
  /** Optional fallback value returned if parsing or validation fails */
  fallback?: T;
  /** Name of the calling domain for contextual diagnostic error reporting */
  contextName?: string;
}

export type ParseGeminiStructuredResponseFn = <T>(
  text: string,
  options?: StructuredParserOptions<T>
) => T;
