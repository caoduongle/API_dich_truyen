import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  formatRedisChannel,
  parseRedisChannel,
  serializeRedisPayload,
  deserializeRedisPayload,
  setupCrdtRedisPubSub,
  cleanupCrdtRedisPubSub,
} from '../crdtRedisPubSub';
import { redisManager } from '../redisService';

describe('crdtRedisPubSub (Cross-Instance Room Sync)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(async () => {
    await cleanupCrdtRedisPubSub();
    vi.restoreAllMocks();
  });

  it('formats and parses Redis channel names accurately', () => {
    const channel = formatRedisChannel('project_p1_chapter_c1');
    expect(channel).toBe('crdt:room:project_p1_chapter_c1');

    const roomId = parseRedisChannel(channel);
    expect(roomId).toBe('project_p1_chapter_c1');
  });

  it('serializes and deserializes binary messages with instance isolation', () => {
    const originalBuffer = Buffer.from([0, 1, 2, 3, 255]);
    const instanceId = 'inst_test_99';

    const serialized = serializeRedisPayload(instanceId, originalBuffer);
    expect(typeof serialized).toBe('string');

    const parsed = deserializeRedisPayload(serialized);
    expect(parsed.instanceId).toBe(instanceId);
    expect(parsed.data).toEqual(originalBuffer);
  });

  it('handles invalid json payloads gracefully in deserializeRedisPayload', () => {
    const parsed = deserializeRedisPayload('not-a-valid-json');
    expect(parsed.instanceId).toBe('');
    expect(parsed.data.length).toBe(0);
  });

  it('skips setup gracefully when redisManager returns null (in-memory mode)', async () => {
    vi.spyOn(redisManager, 'getClient').mockReturnValue(null);
    await expect(setupCrdtRedisPubSub()).resolves.toBeUndefined();
  });

  it('initializes subClient with enableOfflineQueue: true and registers event listeners', async () => {
    const eventHandlers: Record<string, Function[]> = {};

    const mockSubClient: any = {
      status: 'connecting',
      on: vi.fn((event: string, handler: Function) => {
        if (!eventHandlers[event]) eventHandlers[event] = [];
        eventHandlers[event].push(handler);
        return mockSubClient;
      }),
      psubscribe: vi.fn().mockResolvedValue(undefined),
      punsubscribe: vi.fn().mockResolvedValue(undefined),
      quit: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn(),
    };

    const mockMainClient: any = {
      status: 'connecting',
      duplicate: vi.fn().mockReturnValue(mockSubClient),
      publish: vi.fn().mockResolvedValue(1),
    };

    vi.spyOn(redisManager, 'getClient').mockReturnValue(mockMainClient);

    await setupCrdtRedisPubSub();

    // Verify duplicate was called with enableOfflineQueue: true
    expect(mockMainClient.duplicate).toHaveBeenCalledWith({
      enableOfflineQueue: true,
      maxRetriesPerRequest: null,
    });

    // Verify event listeners were registered
    expect(mockSubClient.on).toHaveBeenCalledWith('error', expect.any(Function));
    expect(mockSubClient.on).toHaveBeenCalledWith('ready', expect.any(Function));
    expect(mockSubClient.on).toHaveBeenCalledWith('pmessage', expect.any(Function));

    // Verify error handler catches errors safely without crashing
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const errorHandler = eventHandlers['error']?.[0];
    expect(errorHandler).toBeDefined();
    errorHandler(new Error('Test connection drop'));
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[CrdtRedisPubSub] Redis Sub client error:'),
      'Test connection drop'
    );

    // Verify ready handler executes psubscribe
    const readyHandler = eventHandlers['ready']?.[0];
    expect(readyHandler).toBeDefined();
    await readyHandler();
    expect(mockSubClient.psubscribe).toHaveBeenCalledWith('crdt:room:*');

    // Test cleanup
    await cleanupCrdtRedisPubSub();
    expect(mockSubClient.punsubscribe).toHaveBeenCalledWith('crdt:room:*');
    expect(mockSubClient.quit).toHaveBeenCalled();
  });

  it('subscribes immediately if subClient status is already ready upon duplication', async () => {
    const mockSubClient: any = {
      status: 'ready',
      on: vi.fn().mockReturnThis(),
      psubscribe: vi.fn().mockResolvedValue(undefined),
      punsubscribe: vi.fn().mockResolvedValue(undefined),
      quit: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn(),
    };

    const mockMainClient: any = {
      status: 'ready',
      duplicate: vi.fn().mockReturnValue(mockSubClient),
      publish: vi.fn().mockResolvedValue(1),
    };

    vi.spyOn(redisManager, 'getClient').mockReturnValue(mockMainClient);

    await setupCrdtRedisPubSub();

    expect(mockSubClient.psubscribe).toHaveBeenCalledWith('crdt:room:*');
  });
});
