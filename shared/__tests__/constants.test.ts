import { describe, it, expect } from 'vitest';
import {
  SERVER_CONFIG,
  AI_SERVICE_CONFIG,
  GLOSSARY_LIMITS,
  UI_CONFIG,
  STORAGE_CONFIG,
} from '../constants';

describe('Shared Constants System', () => {
  it('defines valid server configuration constants', () => {
    expect(SERVER_CONFIG.BODY_SIZE_LIMIT).toBe('15mb');
    expect(SERVER_CONFIG.DEFAULT_PORT).toBe(3000);
    expect(SERVER_CONFIG.RATE_LIMIT_WINDOW_MS).toBe(60000);
    expect(SERVER_CONFIG.RATE_LIMIT_MAX_REQUESTS).toBe(60);
    expect(SERVER_CONFIG.AUTH_RATE_LIMIT_WINDOW_MS).toBe(15 * 60 * 1000);
    expect(SERVER_CONFIG.AUTH_RATE_LIMIT_MAX_REQUESTS).toBe(10);
  });

  it('defines valid AI service configurations', () => {
    expect(AI_SERVICE_CONFIG.MIN_REQUEST_INTERVAL_PER_KEY_MS).toBeGreaterThan(0);
    expect(AI_SERVICE_CONFIG.BLACKLIST_COOLDOWN_MS).toBeGreaterThan(0);
    expect(AI_SERVICE_CONFIG.MAX_OVERLOAD_RETRIES).toBeGreaterThan(0);
    expect(AI_SERVICE_CONFIG.CLEANUP_INTERVAL_MS).toBeGreaterThan(0);
  });

  it('defines valid glossary and UI limits', () => {
    expect(GLOSSARY_LIMITS.MAX_CHARS_FOR_GLOSSARY_ANALYSIS).toBe(8000);
    expect(GLOSSARY_LIMITS.MAX_CHARS_FOR_GUIDELINES_ANALYSIS).toBe(4000);
    expect(GLOSSARY_LIMITS.WORKSPACE_GLOSSARY_VISIBLE_LIMIT).toBe(100);
    expect(UI_CONFIG.VIRTUAL_LIST_ITEM_HEIGHT).toBe(72);
    expect(UI_CONFIG.VIRTUAL_LIST_CONTAINER_HEIGHT).toBe(400);
  });

  it('defines valid storage config', () => {
    expect(STORAGE_CONFIG.NEAR_LIMIT_PERCENT).toBe(80);
    expect(STORAGE_CONFIG.DB_NAME).toBe('ai-story-translator-db');
    expect(STORAGE_CONFIG.DB_VERSION).toBe(4);
  });
});
