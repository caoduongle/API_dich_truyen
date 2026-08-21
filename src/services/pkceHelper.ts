import { PKCEChallenge } from '../types/googleAuth';

/**
 * Chuyển đổi Uint8Array thành Base64URL string (RFC 7636).
 * Thay thế '+' bằng '-', '/' bằng '_', và loại bỏ dấu '='.
 */
function bufferToBase64Url(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Sinh mã code_verifier ngẫu nhiên có độ dài 64 ký tự hợp lệ theo chuẩn OAuth PKCE.
 */
export function generateCodeVerifier(length = 64): string {
  const validChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const randomBytes = new Uint8Array(length);
  crypto.getRandomValues(randomBytes);
  let result = '';
  for (let i = 0; i < length; i++) {
    result += validChars[randomBytes[i] % validChars.length];
  }
  return result;
}

/**
 * Sinh chuỗi state ngẫu nhiên để chống tấn công CSRF.
 */
export function generateRandomState(length = 32): string {
  return generateCodeVerifier(length);
}

/**
 * Tính toán SHA-256 digest của code_verifier và mã hóa Base64URL.
 */
export async function generateCodeChallenge(codeVerifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return bufferToBase64Url(digest);
}

/**
 * Tạo bộ challenge PKCE hoàn chỉnh cho một phiên đăng nhập Google.
 */
export async function generatePKCEChallenge(): Promise<PKCEChallenge> {
  const codeVerifier = generateCodeVerifier(64);
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  const state = generateRandomState(32);
  return {
    codeVerifier,
    codeChallenge,
    state,
  };
}
