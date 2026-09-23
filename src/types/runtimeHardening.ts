/**
 * Runtime Hardening Types & Security Contracts
 */

export interface CompactRecentAttempt {
  /** Timestamp in milliseconds of the provider attempt */
  timestamp: number;
}

export interface CompactRecentTokens {
  /** Timestamp in milliseconds of the successful request completion */
  timestamp: number;
  /** Total token consumption (prompt + completion) */
  tokens: number;
}

export type GeminiErrorCode =
  | 'CONTENT_BLOCKED'
  | 'ALL_KEYS_EXHAUSTED'
  | 'RESOURCE_NOT_FOUND'
  | 'BAD_REQUEST'
  | 'ETIMEDOUT'
  | 'AUTH_FAILURE'
  | 'UNRECOGNIZED';

export interface DeploymentSecurityHeader {
  name: string;
  expectedValue: string;
  requiredOn: ('render' | 'vercel' | 'headers' | 'vite' | 'nginx')[];
}

export const CANONICAL_SECURITY_HEADERS: DeploymentSecurityHeader[] = [
  {
    name: 'X-Content-Type-Options',
    expectedValue: 'nosniff',
    requiredOn: ['render', 'vercel', 'headers', 'nginx'],
  },
  {
    name: 'X-Frame-Options',
    expectedValue: 'DENY',
    requiredOn: ['render', 'vercel', 'headers', 'nginx'],
  },
  {
    name: 'Referrer-Policy',
    expectedValue: 'strict-origin-when-cross-origin',
    requiredOn: ['render', 'vercel', 'headers', 'nginx'],
  },
  {
    name: 'Cross-Origin-Opener-Policy',
    expectedValue: 'same-origin-allow-popups',
    requiredOn: ['render', 'vercel', 'headers', 'nginx'],
  },
  {
    name: 'Cross-Origin-Resource-Policy',
    expectedValue: 'same-origin',
    requiredOn: ['render', 'vercel', 'headers', 'nginx'],
  },
  {
    name: 'Permissions-Policy',
    expectedValue: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), screen-wake-lock=()',
    requiredOn: ['render', 'vercel', 'headers', 'nginx'],
  },
  {
    name: 'Strict-Transport-Security',
    expectedValue: 'max-age=31536000; includeSubDomains; preload',
    requiredOn: ['render', 'vercel', 'headers', 'nginx'],
  },
  {
    name: 'Content-Security-Policy',
    expectedValue:
      "upgrade-insecure-requests; default-src 'self'; script-src 'self' https://apis.google.com https://accounts.google.com; style-src 'self' 'unsafe-inline' https://accounts.google.com https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: *.googleusercontent.com; connect-src 'self' https://generativelanguage.googleapis.com https://www.googleapis.com https://accounts.google.com https://content.googleapis.com https://oauth2.googleapis.com https://apis.google.com https://zuminovel.com; frame-src https://drive.google.com https://docs.google.com https://accounts.google.com https://content.googleapis.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none';",
    requiredOn: ['render', 'vercel', 'headers', 'vite', 'nginx'],
  },
];

export interface IQaIssueResolverInput {
  enableAiQaCritique: boolean;
  qaRunSucceeded: boolean;
  detectedQaIssues: Array<{
    type: string;
    severity: string;
    description: string;
    targetText?: string;
  }>;
  existingChapterIssues?: Array<{
    type: string;
    severity: string;
    description: string;
    targetText?: string;
  }>;
}

export function resolveChapterQaIssues(input: IQaIssueResolverInput): Array<{
  type: string;
  severity: string;
  description: string;
  targetText?: string;
}> {
  if (input.enableAiQaCritique && input.qaRunSucceeded) {
    return input.detectedQaIssues;
  }
  return input.existingChapterIssues || [];
}

export type SanitizeAttemptsFn = (
  raw: unknown,
  minuteThreshold: number,
  maxFutureTimestamp: number,
  maxEntries?: number
) => CompactRecentAttempt[];

export type SanitizeTokensFn = (
  raw: unknown,
  minuteThreshold: number,
  maxFutureTimestamp: number,
  maxEntries?: number
) => CompactRecentTokens[];

export type GetErrorMessageFn = (error: unknown) => string;
