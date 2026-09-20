/**
 * API Key Hashing Utilities (Standard SHA-256 & Legacy Fallback Migration)
 */

export const keyHashCache = new Map<string, string>();

/**
 * Thuật toán băm 32-bit cũ (legacy fallback trên trình duyệt trước bản 138)
 * Dùng để nhận diện và di trú các bản ghi cấu hình cũ sang SHA-256 mới
 */
export function legacyHashApiKey(key: string): string {
  if (!key) return '';
  const trimmed = key.trim();
  if (!trimmed) return '';
  let hash = 0;
  for (let i = 0; i < trimmed.length; i++) {
    hash = ((hash << 5) - hash) + trimmed.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(8, '0').repeat(8);
}

/**
 * Kiểm tra xem một chuỗi hash có phải là mã băm cũ (chuỗi hex 8 ký tự lặp hoặc khác 64 ký tự hex)
 */
export function isLegacyHash(hash: string): boolean {
  if (!hash) return false;
  if (hash.length !== 64) return true;
  // Chuỗi hex 8 ký tự lặp lại 8 lần (được tạo bởi legacyHashApiKey)
  return hash.slice(0, 8).repeat(8) === hash;
}

/**
 * Thuật toán băm SHA-256 đồng bộ thuần TypeScript (Zero-dependency)
 */
export function sha256Sync(str: string): string {
  const k = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];

  const hash = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ];

  const utf8: number[] = [];
  for (let c = 0; c < str.length; c++) {
    let charcode = str.charCodeAt(c);
    if (charcode < 0x80) utf8.push(charcode);
    else if (charcode < 0x800) {
      utf8.push(0xc0 | (charcode >> 6), 0x80 | (charcode & 0x3f));
    } else if (charcode < 0xd800 || charcode >= 0xe000) {
      utf8.push(0xe0 | (charcode >> 12), 0x80 | ((charcode >> 6) & 0x3f), 0x80 | (charcode & 0x3f));
    } else {
      c++;
      charcode = 0x10000 + (((charcode & 0x3ff) << 10) | (str.charCodeAt(c) & 0x3ff));
      utf8.push(
        0xf0 | (charcode >> 18),
        0x80 | ((charcode >> 12) & 0x3f),
        0x80 | ((charcode >> 6) & 0x3f),
        0x80 | (charcode & 0x3f)
      );
    }
  }

  const length = utf8.length;
  utf8.push(0x80);
  while ((utf8.length + 8) % 64 !== 0) {
    utf8.push(0);
  }

  const words: number[] = [];
  let i = 0;
  let j = 0;
  let result = '';

  const totalBits = length * 8;
  const highBits = Math.floor(totalBits / 0x100000000);
  const lowBits = totalBits >>> 0;

  for (let b = 0; b < 4; b++) {
    utf8.push((highBits >>> (24 - b * 8)) & 0xff);
  }
  for (let b = 0; b < 4; b++) {
    utf8.push((lowBits >>> (24 - b * 8)) & 0xff);
  }

  for (i = 0; i < utf8.length; i += 4) {
    words.push(
      ((utf8[i] << 24) | (utf8[i + 1] << 16) | (utf8[i + 2] << 8) | utf8[i + 3]) >>> 0
    );
  }

  for (j = 0; j < words.length; j += 16) {
    const w = words.slice(j, j + 16);

    for (i = 16; i < 64; i++) {
      const s0 =
        (((w[i - 15] >>> 7) | (w[i - 15] << 25)) ^
          ((w[i - 15] >>> 18) | (w[i - 15] << 14)) ^
          (w[i - 15] >>> 3)) >>>
        0;
      const s1 =
        (((w[i - 2] >>> 17) | (w[i - 2] << 15)) ^
          ((w[i - 2] >>> 19) | (w[i - 2] << 13)) ^
          (w[i - 2] >>> 10)) >>>
        0;
      w[i] = (((w[i - 16] + s0) | 0) + ((w[i - 7] + s1) | 0)) >>> 0;
    }

    let a = hash[0];
    let b = hash[1];
    let c = hash[2];
    let d = hash[3];
    let e = hash[4];
    let f = hash[5];
    let g = hash[6];
    let h = hash[7];

    for (i = 0; i < 64; i++) {
      const S1 = (((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7))) >>> 0;
      const ch = ((e & f) ^ (~e & g)) >>> 0;
      const temp1 = (h + S1 + ch + k[i] + w[i]) >>> 0;
      const S0 = (((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10))) >>> 0;
      const maj = ((a & b) ^ (a & c) ^ (b & c)) >>> 0;
      const temp2 = (S0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    hash[0] = (hash[0] + a) >>> 0;
    hash[1] = (hash[1] + b) >>> 0;
    hash[2] = (hash[2] + c) >>> 0;
    hash[3] = (hash[3] + d) >>> 0;
    hash[4] = (hash[4] + e) >>> 0;
    hash[5] = (hash[5] + f) >>> 0;
    hash[6] = (hash[6] + g) >>> 0;
    hash[7] = (hash[7] + h) >>> 0;
  }

  for (i = 0; i < 8; i++) {
    result += hash[i].toString(16).padStart(8, '0');
  }
  return result;
}

/**
 * Băm API Key sang SHA-256 (64 hex characters) không lưu trữ raw secret trong bộ nhớ heap
 */
export function hashApiKey(key: string): string {
  if (!key) return '';
  const trimmed = key.trim();
  if (!trimmed) return '';
  if (/^[0-9a-f]{64}$/.test(trimmed)) {
    return trimmed;
  }
  if (typeof globalThis !== 'undefined' && (globalThis as any).process?.versions?.node) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const nodeCrypto = require('crypto');
      return nodeCrypto.createHash('sha256').update(trimmed).digest('hex');
    } catch {}
  }
  return sha256Sync(trimmed);
}

/**
 * Băm API Key bất đồng bộ dùng Web Crypto API chuẩn trên trình duyệt (không cache raw secret)
 */
export async function hashApiKeyAsync(key: string): Promise<string> {
  if (!key) return '';
  const trimmed = key.trim();
  if (!trimmed) return '';
  if (/^[0-9a-f]{64}$/.test(trimmed)) {
    return trimmed;
  }
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.subtle) {
    try {
      const msgUint8 = new TextEncoder().encode(trimmed);
      const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', msgUint8);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    } catch {}
  }
  return hashApiKey(trimmed);
}
