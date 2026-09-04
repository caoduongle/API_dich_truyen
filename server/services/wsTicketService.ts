import crypto from "crypto";

export interface WsTicketPayload {
  projectId: string;
  chapterId: string;
  userEmail: string;
  role?: string;
  issuedAt: number;
  expiresAt: number;
}

const DEFAULT_TTL_SECONDS = 60; // Ticket chỉ có hiệu lực 60 giây để kết nối WebSocket

function getTicketSecret(): string {
  return process.env.WS_TICKET_SECRET && process.env.WS_TICKET_SECRET.trim().length >= 16
    ? process.env.WS_TICKET_SECRET.trim()
    : "ai-dich-truyen-default-internal-ws-ticket-secret-2026";
}

/**
 * Cấp phát Server-Signed Ticket cho kết nối WebSocket CRDT Yjs.
 * Ngăn chặn hoàn toàn việc client tự khai báo quyền hoặc gửi parameter collaborators giả mạo.
 */
export function generateWsTicket(
  params: { projectId: string; chapterId: string; userEmail: string; role?: string },
  ttlSeconds: number = DEFAULT_TTL_SECONDS
): string {
  const now = Date.now();
  const payload: WsTicketPayload = {
    projectId: params.projectId.trim(),
    chapterId: params.chapterId.trim(),
    userEmail: params.userEmail.trim().toLowerCase(),
    role: params.role || "editor",
    issuedAt: now,
    expiresAt: now + ttlSeconds * 1000,
  };

  const dataStr = Buffer.from(JSON.stringify(payload), "utf-8").toString("base64url");
  const secret = getTicketSecret();
  const signature = crypto.createHmac("sha256", secret).update(dataStr).digest("base64url");

  return `${dataStr}.${signature}`;
}

/**
 * Thẩm định chữ ký và thời hạn của WebSocket Ticket.
 * Sử dụng crypto.timingSafeEqual để triệt tiêu tấn công Timing Attack.
 */
export function verifyWsTicket(ticket: string): { valid: boolean; payload?: WsTicketPayload; error?: string } {
  if (!ticket || typeof ticket !== "string") {
    return { valid: false, error: "Thiếu WebSocket ticket" };
  }

  const parts = ticket.split(".");
  if (parts.length !== 2) {
    return { valid: false, error: "Định dạng ticket không hợp lệ" };
  }

  const [dataStr, signature] = parts;
  const secret = getTicketSecret();
  const expectedSignature = crypto.createHmac("sha256", secret).update(dataStr).digest("base64url");

  // So sánh thời gian cố định (timingSafeEqual)
  const sigBuffer = Buffer.from(signature, "utf-8");
  const expectedBuffer = Buffer.from(expectedSignature, "utf-8");

  if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
    return { valid: false, error: "Chữ ký ticket không hợp lệ" };
  }

  try {
    const rawJson = Buffer.from(dataStr, "base64url").toString("utf-8");
    const payload = JSON.parse(rawJson) as WsTicketPayload;

    if (!payload.projectId || !payload.chapterId || !payload.userEmail || !payload.expiresAt) {
      return { valid: false, error: "Cấu trúc dữ liệu ticket bị thiếu trường bắt buộc" };
    }

    if (Date.now() > payload.expiresAt) {
      return { valid: false, error: "Ticket đã hết hạn kết nối" };
    }

    return { valid: true, payload };
  } catch (err: any) {
    return { valid: false, error: "Lỗi giải mã payload ticket" };
  }
}
