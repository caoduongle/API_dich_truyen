import Redis from 'ioredis';
import { redisManager } from './redisService';
import { broadcastToRoom, setRedisPublisherHook } from './websocketRelayService';

const CHANNEL_PREFIX = 'crdt:room:';
const INSTANCE_ID = `inst_${Math.random().toString(36).slice(2, 9)}_${Date.now()}`;

let subClient: Redis | null = null;
let pubClient: Redis | null = null;

export function formatRedisChannel(roomId: string): string {
  return `${CHANNEL_PREFIX}${roomId}`;
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
    subClient = mainClient.duplicate();

    await subClient.psubscribe(`${CHANNEL_PREFIX}*`);

    subClient.on('pmessage', (_pattern: string, channel: string, message: string) => {
      const { instanceId, data } = deserializeRedisPayload(message);

      // Bỏ qua tin nhắn do chính instance này gửi đi để tránh echo loop
      if (instanceId === INSTANCE_ID || data.length === 0) {
        return;
      }

      const roomId = parseRedisChannel(channel);
      // Chuyển tiếp tới các client cục bộ trên instance này
      broadcastToRoom(roomId, data);
    });

    // Đăng ký hook gửi tin nhắn từ WebSocket Relay sang Redis
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
    } catch (e) {}
    subClient = null;
  }
}
