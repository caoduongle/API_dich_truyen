/**
 * Contract: EPUB Standards Verification & XML Parsing Engine
 * Module: src/hooks/__tests__/useEpubExport.test.ts
 */

export interface EpubXmlParserContract {
  /**
   * Parses an XML document string through a standards-compliant XML parser engine (DOMParser).
   * Asserts that zero parsererror elements or syntax exceptions occur.
   * Throws an assertion error if the document is malformed.
   */
  assertXmlWellFormed(xmlString: string, filename: string): void;

  /**
   * Verifies that the archive's mimetype entry satisfies IDPF EPUB rules:
   * 1. Position is index 0 in the archive.
   * 2. Content is byte-exact "application/epub+zip" without trailing whitespace.
   * 3. Compression method is strictly STORE (uncompressed).
   */
  assertMimetypeCompliance(zipEntries: Record<string, any>): void;

  /**
   * Verifies that the generated package spine and TOC order matches
   * the project's chapter list order (proj.chapters).
   */
  assertChapterSequenceOrder(manifestXml: string, expectedChapterIds: string[]): void;
}
