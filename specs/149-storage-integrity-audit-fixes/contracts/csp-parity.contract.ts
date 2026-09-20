/**
 * Content Security Policy Parity Contract
 * Defines normalization and comparison interface for CSP across multi-platform configs.
 */

export interface CspDirectives {
  'default-src'?: string[];
  'script-src'?: string[];
  'style-src'?: string[];
  'font-src'?: string[];
  'img-src'?: string[];
  'connect-src'?: string[];
  'frame-src'?: string[];
  'object-src'?: string[];
  'base-uri'?: string[];
  'form-action'?: string[];
  'frame-ancestors'?: string[];
  [directive: string]: string[] | undefined;
}

export interface CspParityChecker {
  /**
   * Parses raw CSP header string into structured directives.
   */
  parseCsp(rawCsp: string): CspDirectives;

  /**
   * Asserts equality between two CSP directive maps, throwing descriptive diff on mismatch.
   */
  assertCspEqual(actual: CspDirectives, expected: CspDirectives, context: string): void;
}
