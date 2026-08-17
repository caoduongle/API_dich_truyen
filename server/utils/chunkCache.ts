import { createHash } from "crypto";

export interface CachedChunkResult {
  text: string;
  discoveredEntities?: any[];
  suggestions?: any[];
  timestamp: number;
}

export class ChunkCache {
  private cache = new Map<string, CachedChunkResult>();
  private ttlMs: number;
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(ttlMinutes = 60) {
    this.ttlMs = ttlMinutes * 60 * 1000;
    this.cleanupTimer = setInterval(() => this.cleanup(), 10 * 60 * 1000);
    if (this.cleanupTimer && typeof this.cleanupTimer.unref === "function") {
      this.cleanupTimer.unref();
    }
  }

  public stopCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  public generateKey(
    task: string,
    text: string,
    options: { genre?: string; tone?: string; model?: string; extra?: string } = {}
  ): string {
    const data = `${task}:::${options.model || ""}:::${options.genre || ""}:::${options.tone || ""}:::${options.extra || ""}:::${(text || "").trim()}`;
    return createHash("sha256").update(data).digest("hex");
  }

  public get(key: string): CachedChunkResult | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(key);
      return null;
    }
    return entry;
  }

  public set(
    key: string,
    result: { text?: string; discoveredEntities?: any[]; suggestions?: any[] }
  ): void {
    this.cache.set(key, {
      text: result.text || "",
      discoveredEntities: result.discoveredEntities,
      suggestions: result.suggestions,
      timestamp: Date.now(),
    });
  }

  public has(key: string): boolean {
    return this.get(key) !== null;
  }

  public delete(key: string): boolean {
    return this.cache.delete(key);
  }

  public clear(): void {
    this.cache.clear();
  }

  public size(): number {
    return this.cache.size;
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.ttlMs) {
        this.cache.delete(key);
      }
    }
  }
}

export const translationChunkCache = new ChunkCache(60);
