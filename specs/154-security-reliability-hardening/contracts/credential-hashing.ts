/**
 * Credential Hashing Contract (Stateless Memory Protection)
 */

export interface CredentialHashingContract {
  /** Synchronous SHA-256 computation directly on string input */
  sha256Sync(str: string): string;

  /**
   * Hashes an API key into a 64-character SHA-256 hex string.
   * MUST NOT retain the input plaintext string in long-lived memory maps.
   */
  hashApiKey(key: string): string;

  /**
   * Asynchronous hashing using Web Crypto Subtle API when available,
   * falling back to sha256Sync.
   * MUST NOT retain the input plaintext string in long-lived memory maps.
   */
  hashApiKeyAsync(key: string): Promise<string>;
}
