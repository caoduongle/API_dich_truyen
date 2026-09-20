/**
 * Model Discovery Contract
 */

export interface ModelDiscoveryOptions {
  /** Optional external abort signal (e.g. from React useEffect cleanup) */
  signal?: AbortSignal;
  /** Maximum duration before request is forcefully aborted. Defaults to 15,000ms */
  timeoutMs?: number;
}

export interface DiscoveredModel {
  name: string;
  displayName: string;
  description?: string;
  supportedGenerationMethods?: string[];
  inputTokenLimit?: number;
  outputTokenLimit?: number;
}

export type ListModelsDirectFn = (
  apiKey: string,
  options?: ModelDiscoveryOptions
) => Promise<DiscoveredModel[]>;
