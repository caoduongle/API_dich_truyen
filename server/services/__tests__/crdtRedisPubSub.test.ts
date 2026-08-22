import { describe, it, expect, vi } from 'vitest';
import {
  formatRedisChannel,
  parseRedisChannel,
  serializeRedisPayload,
  deserializeRedisPayload,
} from '../crdtRedisPubSub';

describe('crdtRedisPubSub (Cross-Instance Room Sync)', () => {
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
});
