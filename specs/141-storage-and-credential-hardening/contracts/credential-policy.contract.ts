/**
 * Contract: Credential Policy & Storage Audit Integrity
 * Feature: 141-storage-and-credential-hardening
 */

export interface AppUiPreferences {
  /**
   * User toggle controlling whether API keys are remembered across browser sessions.
   * Defaults to true.
   */
  rememberKeys?: boolean;

  /**
   * Persisted API keys in localStorage.
   * Permitted ONLY when rememberKeys === true (or unset).
   * MUST be empty ([]) when rememberKeys === false.
   */
  savedKeys?: string[];

  [key: string]: any;
}

export interface StorageIntegrityReport {
  isValid: boolean;
  violations: string[];
  auditedKeysCount: number;
  forbiddenKeysFound: string[];
}

export interface ICredentialStorageAudit {
  /**
   * Validates storage integrity:
   * 1. No un-nested root key 'gemini_api_keys' in localStorage.
   * 2. If 'app_ui_prefs' exists:
   *    - If rememberKeys === false: savedKeys MUST NOT contain keys.
   *    - If rememberKeys !== false: savedKeys is valid user preference.
   * 3. No manuscript content in localStorage.
   */
  verifyStorageIntegrity(storage?: Storage): StorageIntegrityReport;

  /**
   * Cleans up forbidden keys and purges savedKeys if rememberKeys === false.
   * Returns count of sanitized items.
   */
  sanitizeLocalStorage(storage?: Storage): number;
}
