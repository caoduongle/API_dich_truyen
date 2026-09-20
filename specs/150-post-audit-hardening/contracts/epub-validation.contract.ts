/**
 * Contract: EPUB Package & XML Structure Validation
 * Governs strict adherence to IDPF EPUB 3.0 container and XML well-formedness standards.
 */

export interface XmlValidationResult {
  valid: boolean;
  errors: string[];
}

export interface EpubArchiveValidator {
  /**
   * Asserts that an XML/XHTML string is well-formed with zero parser errors.
   */
  validateXmlWellFormedness(xmlContent: string, documentLabel: string): XmlValidationResult;

  /**
   * Asserts that the mimetype entry satisfies EPUB container requirements:
   * 1. Position is the very first entry in the archive (index 0).
   * 2. Content is exactly 'application/epub+zip' without trailing whitespace.
   * 3. Compression method is STORE (uncompressed).
   */
  validateMimetypeEntry(zipEntries: { name: string; compression?: string }[]): {
    isFirstEntry: boolean;
    isUncompressed: boolean;
    isValid: boolean;
    error?: string;
  };
}
