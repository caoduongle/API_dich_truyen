import Redis from 'ioredis';
import { redisManager } from './redisService';
import { broadcastToRoom, setRedisPublisherHook } from './websocketRelayService';

const CHANNEL_PREFIX = 'crdt:room:';
const INSTANCE_ID = `inst_${Math.random().toString(36).slice(2, 9)}_${Date.now()}`;

let subClient: Redis | null = null;
let pubClient: Redis | null = null;

export const SAFE_ROOM_ID_REGEX = /^[a-zA-Z0-9_\-:]{1,160}$/;

export function isValidRoomId(roomId: unknown): boolean {
  return (
    typeof roomId === 'string' &&
    SAFE_ROOM_ID_REGEX.test(roomId.trim()) &&
    !roomId.includes('\r') &&
    !roomId.includes('\n') &&
    !roomId.includes('\0')
  );
}

export function formatRedisChannel(roomId: string): string {
  if (!isValidRoomId(roomId)) {
    throw new Error(`Ký danh roomId không hợp lệ hoặc chứa ký tự nguy hiểm: ${roomId}`);
  }
  return `${CHANNEL_PREFIX}${roomId.trim()}`;
}

export function parseRedisChannel(channel: string): string {
  if (channel.startsWith(CHANNEL_PREFIX)) {
    return channel.slice(CHANNEL_PREFIX.length);
  }
  return channel;
}

export function serializeRedisPayload(instanceId: string, data: Buffer): string {
  return JSON.stringify({
    inst: instanceId,
    b64: data.toString('base64'),
  });
}

export function deserializeRedisPayload(payload: string): { instanceId: string; data: Buffer } {
  try {
    const parsed = JSON.parse(payload);
    return {
      instanceId: parsed.inst || '',
      data: Buffer.from(parsed.b64, 'base64'),
    };
  } catch (e) {
    return {
      instanceId: '',
      data: Buffer.alloc(0),
    };
  }
}

export async function setupCrdtRedisPubSub(): Promise<void> {
  const mainClient = redisManager.getClient();
  if (!mainClient) {
    return; // Đang chạy in-memory (1 instance), không cần pub/sub
  }

  try {
    pubClient = mainClient;

    // Bật enableOfflineQueue riêng cho subscriber client để tự động buffer lệnh psubscribe khi đang kết nối TCP
    subClient = mainClient.duplicate({
      enableOfflineQueue: true,
      maxRetriesPerRequest: null,
    });

    // Lắng nghe lỗi trên subClient để tránh EventEmitter uncaughtException
    subClient.on('error', (err) => {
      console.warn('[CrdtRedisPubSub] Redis Sub client error:', err?.message || err);
    });

    // Tự động đăng ký lại channel khi subClient kết nối thành công hoặc reconnect
    subClient.on('ready', async () => {
      try {
        await subClient?.psubscribe(`${CHANNEL_PREFIX}*`);
        console.log(`[CrdtRedisPubSub] Sub client sẵn sàng, đã đăng ký channel ${CHANNEL_PREFIX}*`);
      } catch (err: any) {
        console.warn('[CrdtRedisPubSub] Lỗi khi psubscribe trong event ready:', err?.message || err);
      }
    });

    // Đăng ký xử lý nhận tin nhắn CRDT từ Redis channel
    subClient.on('pmessage', (_pattern: string, channel: string, message: string) => {
      const { instanceId, data } = deserializeRedisPayload(message);

      // Bỏ qua tin nhắn do chính instance này phát đi
      if (instanceId === INSTANCE_ID || data.length === 0) {
        return;
      }

      const roomId = parseRedisChannel(channel);
      broadcastToRoom(roomId, data);
    });

    // Nếu subClient đã ở trạng thái ready từ trước, thực hiện psubscribe ngay
    if (subClient.status === 'ready') {
      await subClient.psubscribe(`${CHANNEL_PREFIX}*`);
    }

    // Gắn hook phát tin từ WebSocket Relay sang Redis
    setRedisPublisherHook((roomId: string, message: Buffer) => {
      if (pubClient && pubClient.status === 'ready') {
        const channel = formatRedisChannel(roomId);
        const payload = serializeRedisPayload(INSTANCE_ID, message);
        pubClient.publish(channel, payload).catch((err) => {
          console.warn(`[CrdtRedisPubSub] Lỗi publish tới channel ${channel}:`, err.message);
        });
      }
    });

    console.log(`[CrdtRedisPubSub] Đã kích hoạt Pub/Sub đa instance (Instance ID: ${INSTANCE_ID})`);
  } catch (err) {
    console.error('[CrdtRedisPubSub] Lỗi khởi tạo Redis Pub/Sub:', err);
  }
}

export async function cleanupCrdtRedisPubSub(): Promise<void> {
  if (subClient) {
    try {
      await subClient.punsubscribe(`${CHANNEL_PREFIX}*`);
      await subClient.quit();
    } catch (e) {
      try {
        subClient.disconnect();
      } catch {}
    }
    subClient = null;
  }
}
