import { Server as HttpServer, IncomingMessage } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { Duplex } from 'stream';

// Quản lý số kết nối trên từng IP để chống cạn kiệt socket file descriptors
const ipConnectionCounts = new Map<string, number>();
const MAX_CONNECTIONS_PER_IP = 20;

// Cache xác thực token Google trong RAM (TTL 5 phút) để giảm thiểu gọi API Google
const tokenCache = new Map<string, { email: string; name: string; picture?: string; expiresAt: number }>();
const TOKEN_CACHE_TTL_MS = 5 * 60 * 1000;

// Bộ định tuyến phòng trong RAM (Zero Server Storage)
const rooms = new Map<string, Set<WebSocket>>();

// Callback hook cho Redis Pub/Sub đa instance (Phase C)
let redisPublisherHook: ((roomId: string, message: Buffer) => void) | null = null;

export function setRedisPublisherHook(hook: (roomId: string, message: Buffer) => void) {
  redisPublisherHook = hook;
}

export function formatRoomId(projectId: string, chapterId: string): string {
  return `project_${projectId}_chapter_${chapterId}`;
}

export function checkIpRateLimit(ip: string, maxLimit = MAX_CONNECTIONS_PER_IP): boolean {
  const count = ipConnectionCounts.get(ip) || 0;
  return count < maxLimit;
}

export function incrementIpConnection(ip: string): void {
  const count = ipConnectionCounts.get(ip) || 0;
  ipConnectionCounts.set(ip, count + 1);
}

export function decrementIpConnection(ip: string): void {
  const count = ipConnectionCounts.get(ip) || 0;
  if (count <= 1) {
    ipConnectionCounts.delete(ip);
  } else {
    ipConnectionCounts.set(ip, count - 1);
  }
}

export function verifyCollaboratorAccess(
  userEmail: string,
  collaborators?: Array<{ email: string }>
): boolean {
  if (!userEmail) return false;
  if (!collaborators || collaborators.length === 0) return true; // Nếu chưa có danh sách giới hạn, cho phép
  const normalizedEmail = userEmail.toLowerCase().trim();
  return collaborators.some((c) => c.email.toLowerCase().trim() === normalizedEmail);
}

export async function verifyGoogleAccessToken(
  token: string
): Promise<{ email: string; name: string; picture?: string } | null> {
  if (!token) return null;

  const now = Date.now();
  const cached = tokenCache.get(token);
  if (cached && cached.expiresAt > now) {
    return { email: cached.email, name: cached.name, picture: cached.picture };
  }

  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      return null;
    }

    const data = (await res.json()) as { email: string; name: string; picture?: string };
    if (!data.email) return null;

    tokenCache.set(token, {
      email: data.email,
      name: data.name || data.email,
      picture: data.picture,
      expiresAt: now + TOKEN_CACHE_TTL_MS,
    });

    return { email: data.email, name: data.name || data.email, picture: data.picture };
  } catch (err) {
    console.error('[WebSocketRelay] Lỗi xác thực Google token:', err);
    return null;
  }
}

export function broadcastToRoom(roomId: string, message: Buffer | Uint8Array, originSocket?: WebSocket): void {
  const clientSet = rooms.get(roomId);
  if (!clientSet) return;

  for (const client of clientSet) {
    if (client !== originSocket && client.readyState === WebSocket.OPEN) {
      try {
        client.send(message);
      } catch (err) {
        console.error(`[WebSocketRelay] Lỗi gửi packet tới client trong phòng ${roomId}:`, err);
      }
    }
  }
}

export function setupWebSocketRelay(server: HttpServer): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', async (request: IncomingMessage, socket: Duplex, head: Buffer) => {
    try {
      const host = request.headers.host || 'localhost';
      const url = new URL(request.url || '', `http://${host}`);

      if (url.pathname !== '/ws/sync') {
        return; // Để Vite HMR hoặc các upgrade handler khác xử lý
      }

      const clientIp =
        (request.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
        request.socket.remoteAddress ||
        '127.0.0.1';

      // 1. Kiểm tra giới hạn số kết nối theo IP
      if (!checkIpRateLimit(clientIp)) {
        socket.write('HTTP/1.1 429 Too Many Requests\r\n\r\n');
        socket.destroy();
        return;
      }

      const projectId = url.searchParams.get('projectId');
      const chapterId = url.searchParams.get('chapterId');
      const token = url.searchParams.get('token');

      if (!projectId || !chapterId) {
        socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
        socket.destroy();
        return;
      }

      // 2. Bắt buộc xác thực Google OAuth Token hợp lệ (ngăn chặn kết nối vô danh vào phòng CRDT)
      if (!token || !token.trim()) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      const userInfo = await verifyGoogleAccessToken(token.trim());
      if (!userInfo || !userInfo.email) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      const userEmail = userInfo.email;

      // 3. Phòng chống IDOR: Kiểm tra phân quyền truy cập dự án (Tiêu chuẩn 7)
      const collabsParam = url.searchParams.get('collaborators');
      if (collabsParam) {
        try {
          const parsed = JSON.parse(collabsParam);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const hasAccess = verifyCollaboratorAccess(userEmail, parsed);
            if (!hasAccess) {
              socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
              socket.destroy();
              return;
            }
          }
        } catch {
          // Bỏ qua lỗi cú pháp JSON không hợp lệ
        }
      }

      incrementIpConnection(clientIp);

      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request, {
          projectId,
          chapterId,
          userEmail,
          clientIp,
        });
      });
    } catch (err) {
      console.error('[WebSocketRelay] Lỗi trong upgrade handshake:', err);
      socket.destroy();
    }
  });

  wss.on('connection', (ws: WebSocket, request: IncomingMessage, metadata: any) => {
    const { projectId, chapterId, clientIp } = metadata;
    const roomId = formatRoomId(projectId, chapterId);

    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Set());
    }
    const clientSet = rooms.get(roomId)!;
    clientSet.add(ws);

    ws.on('message', (data: Buffer | ArrayBuffer | Buffer[]) => {
      const buffer = Buffer.isBuffer(data)
        ? data
        : Array.isArray(data)
          ? Buffer.concat(data)
          : Buffer.from(data);

      // Chuyển tiếp tới các client khác trong cùng phòng trên instance hiện tại
      broadcastToRoom(roomId, buffer, ws);

      // Chuyển tiếp tới Redis Pub/Sub để phát sang các instance khác nếu có
      if (redisPublisherHook) {
        redisPublisherHook(roomId, buffer);
      }
    });

    ws.on('close', () => {
      decrementIpConnection(clientIp);
      clientSet.delete(ws);
      if (clientSet.size === 0) {
        rooms.delete(roomId);
      }
    });

    ws.on('error', (err) => {
      console.warn(`[WebSocketRelay] Lỗi socket trong phòng ${roomId}:`, err.message);
    });
  });

  return wss;
}
