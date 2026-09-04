import crypto from "crypto";

export interface ScryptOptions {
  N?: number;
  r?: number;
  p?: number;
  keylen?: number;
}

const DEFAULT_SCRYPT_OPTIONS: Required<ScryptOptions> = {
  N: 16384, // CPU/memory cost
  r: 8,     // Block size
  p: 1,     // Parallelization
  keylen: 64,
};

/**
 * Băm mật khẩu người dùng hoặc khóa bí mật bằng thuật toán scrypt chuẩn công nghiệp.
 * Tự động tạo salt ngẫu nhiên 16 bytes cho từng mật khẩu.
 * Định dạng chuỗi trả về: scrypt$N$r$p$saltHex$hashHex
 */
export function hashPassword(password: string, options?: ScryptOptions): string {
  if (!password || typeof password !== "string") {
    throw new Error("Mật khẩu cung cấp để băm không hợp lệ.");
  }

  const { N, r, p, keylen } = { ...DEFAULT_SCRYPT_OPTIONS, ...options };
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = crypto.scryptSync(password, salt, keylen, { N, r, p });

  return `scrypt$${N}$${r}$${p}$${salt}$${derivedKey.toString("hex")}`;
}

/**
 * Kiểm tra xem chuỗi có phải là chuỗi băm scrypt hợp lệ hay không.
 */
export function isPasswordHashed(str: string): boolean {
  if (!str || typeof str !== "string") return false;
  return /^scrypt\$\d+\$\d+\$\d+\$[0-9a-f]{32}\$[0-9a-f]{128}$/i.test(str.trim());
}

/**
 * So sánh an toàn mật khẩu nhập vào với chuỗi băm hoặc mật khẩu gốc (chống Timing Attack).
 * Hỗ trợ cả chuỗi băm scrypt và so sánh SHA-256 an toàn với ACCESS_PASSWORD cấu hình trong môi trường.
 */
export function verifyPassword(password: string, storedTarget: string): boolean {
  if (!password || !storedTarget || typeof password !== "string" || typeof storedTarget !== "string") {
    return false;
  }

  const trimmedPassword = password.trim();
  const trimmedTarget = storedTarget.trim();

  if (trimmedPassword.length === 0 || trimmedTarget.length === 0) {
    return false;
  }

  // Trường hợp 1: Mục tiêu lưu trữ là chuỗi băm scrypt
  if (isPasswordHashed(trimmedTarget)) {
    try {
      const parts = trimmedTarget.split("$");
      const N = Number(parts[1]);
      const r = Number(parts[2]);
      const p = Number(parts[3]);
      const salt = parts[4];
      const targetHash = parts[5];

      const derivedKey = crypto.scryptSync(trimmedPassword, salt, targetHash.length / 2, { N, r, p });
      const targetBuffer = Buffer.from(targetHash, "hex");

      if (derivedKey.length !== targetBuffer.length) {
        return false;
      }

      return crypto.timingSafeEqual(derivedKey, targetBuffer);
    } catch {
      return false;
    }
  }

  // Trường hợp 2: Mục tiêu lưu trữ là mật khẩu thô từ ACCESS_PASSWORD (.env)
  // Băm SHA-256 cả hai chuỗi trước khi so sánh timingSafeEqual để cố định độ dài 32 bytes
  const hashInput = crypto.createHash("sha256").update(trimmedPassword).digest();
  const hashTarget = crypto.createHash("sha256").update(trimmedTarget).digest();

  return crypto.timingSafeEqual(hashInput, hashTarget);
}
