import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ChunkCache, translationChunkCache } from "../chunkCache";

describe("ChunkCache", () => {
  let cache: ChunkCache;

  beforeEach(() => {
    cache = new ChunkCache(10); // 10 minutes TTL
    translationChunkCache.clear();
  });

  afterEach(() => {
    cache.clear();
  });

  it("should generate deterministic sha256 cache keys", () => {
    const key1 = cache.generateKey("raw", "văn bản mẫu", { genre: "Tiên Hiệp", tone: "Trang nghiêm" });
    const key2 = cache.generateKey("raw", "văn bản mẫu", { genre: "Tiên Hiệp", tone: "Trang nghiêm" });
    const key3 = cache.generateKey("raw", "văn bản mẫu khác", { genre: "Tiên Hiệp", tone: "Trang nghiêm" });

    expect(key1).toBe(key2);
    expect(key1).not.toBe(key3);
    expect(key1.length).toBe(64); // SHA-256 hex length
  });

  it("should set and retrieve cached chunk results", () => {
    const key = cache.generateKey("raw", "văn bản A");
    cache.set(key, {
      text: "bản dịch A",
      discoveredEntities: [{ chinese: "萧炎", vietnamese: "Tiêu Viêm" }],
    });

    const cached = cache.get(key);
    expect(cached).not.toBeNull();
    expect(cached?.text).toBe("bản dịch A");
    expect(cached?.discoveredEntities).toHaveLength(1);
    expect(cached?.discoveredEntities?.[0].vietnamese).toBe("Tiêu Viêm");
  });

  it("should return null for non-existent or expired keys", () => {
    vi.useFakeTimers();
    const shortTtlCache = new ChunkCache(1); // 1 minute TTL
    const key = shortTtlCache.generateKey("raw", "test text");
    shortTtlCache.set(key, { text: "translated" });

    expect(shortTtlCache.get(key)?.text).toBe("translated");

    // Advance 65 seconds
    vi.advanceTimersByTime(65 * 1000);

    expect(shortTtlCache.get(key)).toBeNull();
    vi.useRealTimers();
  });

  it("should clear all entries when clear() is called", () => {
    const key1 = cache.generateKey("raw", "text 1");
    const key2 = cache.generateKey("raw", "text 2");
    cache.set(key1, { text: "res 1" });
    cache.set(key2, { text: "res 2" });

    expect(cache.size()).toBe(2);
    cache.clear();
    expect(cache.size()).toBe(0);
    expect(cache.get(key1)).toBeNull();
  });
});
