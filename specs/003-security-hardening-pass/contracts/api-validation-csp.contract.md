# Contract: API Request Validation & Content Security Policy

**Feature**: `003-security-hardening-pass`
**Date**: 2026-08-19

## 1. Request Body Validation Contract

### Rejection Status Code & Structure
When any POST endpoint receives an invalid body, invalid data types, oversized fields, or unexpected malicious structures:
- **HTTP Status**: `400 Bad Request`
- **Response Format**:
  ```json
  {
    "error": "Mô tả lỗi tiếng Việt cụ thể về trường không hợp lệ."
  }
  ```

### Specific Validation Contracts

#### `POST /api/auth/login`
- `password`: Must be a non-empty string, length 1..256.
- Any other keys: Ignored or rejected. If empty/non-string -> 400.

#### `POST /api/session-keys`
- `apiKeys`: Must be an Array of strings.
  - Length: 1..50.
  - Each item: Non-empty string.
- If `apiKeys` is not an array or has length 0 or > 50 -> 400.

#### `POST /api/translate-raw`
- `text`: Required non-empty string (length 1..500,000).
- `genre`, `tone`, `description`, `model`: String if provided.
- `glossary`: Array if provided.
- `startKeyIndex`: Non-negative integer if provided.

#### `POST /api/polish-translation`
- `rawTranslation`: Required non-empty string.
- `originalText`: String if provided.
- `genre`, `tone`, `styleGuidelines`, `model`: String if provided.
- `glossary`: Array if provided.

#### `POST /api/qa-critique`
- `rawTranslation`: Required non-empty string.
- `polishedTranslation`: Required non-empty string.
- `originalText`, `genre`, `tone`, `model`: String if provided.

#### `POST /api/analyze-glossary` & `POST /api/extract-glossary`
- `text`: Required non-empty string.

#### `POST /api/analyze-guidelines`
- `content`: Required non-empty string.

#### `POST /api/align-chapter`
- `originalText`: Required non-empty string.
- `translatedText`: Required non-empty string.

---

## 2. Production Content Security Policy (CSP) Contract

### Environment: `NODE_ENV=production`
- **Header**: `Content-Security-Policy`
- **Directives**:
  ```text
  default-src 'self';
  script-src 'self';
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  font-src 'self' https://fonts.gstatic.com data:;
  img-src 'self' data: blob:;
  connect-src 'self';
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';
  ```
- **Console Errors in Browser**: Exactly 0 CSP violations when loading SPA, translating chapters, extracting glossary, managing sessions, and exporting files.
