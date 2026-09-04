/**
 * Bộ kiểm định cấu hình biến môi trường khi khởi động máy chủ (Startup Environment Validator)
 * Tuân thủ Hiến pháp Gate II: Tận dụng TypeScript và Node.js native, không cài thêm thư viện nặng.
 */

export interface ValidatedEnvironment {
  NODE_ENV: 'development' | 'production' | 'test';
  PORT: number;
  ACCESS_PASSWORD?: string;
  REDIS_URL?: string;
  TRUST_PROXY_HOPS: number;
  ALLOWED_ORIGINS: string[];
  WS_TICKET_SECRET: string;
  APP_BASE_URL?: string;
}

export function validateEnvironment(env: NodeJS.ProcessEnv = process.env): ValidatedEnvironment {
  const nodeEnv = (env.NODE_ENV || 'development').trim().toLowerCase();
  const validNodeEnvs: Array<'development' | 'production' | 'test'> = ['development', 'production', 'test'];
  const effectiveNodeEnv: 'development' | 'production' | 'test' = validNodeEnvs.includes(nodeEnv as any)
    ? (nodeEnv as any)
    : 'development';

  let port = 3000;
  if (env.PORT) {
    const parsedPort = parseInt(env.PORT, 10);
    if (!isNaN(parsedPort) && parsedPort > 0 && parsedPort <= 65535) {
      port = parsedPort;
    } else {
      console.warn(`[EnvValidator] PORT "${env.PORT}" không hợp lệ, chuyển về mặc định 3000.`);
    }
  }

  const accessPassword = typeof env.ACCESS_PASSWORD === 'string' && env.ACCESS_PASSWORD.trim().length > 0
    ? env.ACCESS_PASSWORD.trim()
    : undefined;

  let redisUrl: string | undefined;
  if (typeof env.REDIS_URL === 'string' && env.REDIS_URL.trim().length > 0) {
    const trimmed = env.REDIS_URL.trim();
    if (trimmed.startsWith('redis://') || trimmed.startsWith('rediss://')) {
      redisUrl = trimmed;
    } else {
      console.warn(`[EnvValidator] REDIS_URL "${trimmed}" không có tiền tố redis:// hoặc rediss://.`);
    }
  }

  let trustProxyHops = 1;
  if (env.TRUST_PROXY_HOPS) {
    const parsedHops = parseInt(env.TRUST_PROXY_HOPS, 10);
    if (!isNaN(parsedHops) && parsedHops >= 0) {
      trustProxyHops = parsedHops;
    }
  }

  const allowedOrigins: string[] = [];
  if (env.ALLOWED_ORIGINS) {
    const parts = env.ALLOWED_ORIGINS.split(',').map(s => s.trim()).filter(Boolean);
    allowedOrigins.push(...parts);
  }

  // Khóa bí mật cho Ticket WebSocket
  const wsTicketSecret = env.WS_TICKET_SECRET && env.WS_TICKET_SECRET.trim().length >= 16
    ? env.WS_TICKET_SECRET.trim()
    : 'ai-dich-truyen-internal-ws-ticket-secret-2026';

  let appBaseUrl: string | undefined;
  if (typeof env.APP_BASE_URL === 'string' && env.APP_BASE_URL.trim().length > 0) {
    appBaseUrl = env.APP_BASE_URL.trim().replace(/\/+$/, '');
  }

  // Kiểm định rò rỉ biến môi trường nhạy cảm sang tiền tố VITE_
  assertNoLeakedSecretsInViteEnv(env);

  return {
    NODE_ENV: effectiveNodeEnv,
    PORT: port,
    ACCESS_PASSWORD: accessPassword,
    REDIS_URL: redisUrl,
    TRUST_PROXY_HOPS: trustProxyHops,
    ALLOWED_ORIGINS: allowedOrigins,
    WS_TICKET_SECRET: wsTicketSecret,
    APP_BASE_URL: appBaseUrl,
  };
}

/**
 * Kiểm định ngăn chặn việc đặt tiền tố VITE_ cho các biến môi trường nhạy cảm phía máy chủ.
 * Đảm bảo Vite bundle không đóng gói nhầm bí mật vào client code.
 */
export function assertNoLeakedSecretsInViteEnv(env: NodeJS.ProcessEnv = process.env): void {
  const forbiddenViteKeys = [
    'VITE_GEMINI_API_KEY',
    'VITE_ACCESS_PASSWORD',
    'VITE_REDIS_URL',
    'VITE_WS_TICKET_SECRET',
    'VITE_SUPABASE_SERVICE_ROLE_KEY',
    'VITE_SERVICE_ROLE_KEY',
    'VITE_SECRET',
  ];

  for (const key of forbiddenViteKeys) {
    if (env[key] !== undefined && env[key] !== '') {
      throw new Error(`[CRITICAL SECURITY ALERT] Biến môi trường bảo mật không được bắt đầu bằng 'VITE_': ${key}`);
    }
  }
}

export const ENV = validateEnvironment();

