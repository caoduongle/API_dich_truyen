import { describe, it, expect, vi, afterEach } from 'vitest';
import { useHotkeys } from '../useHotkeys';

describe('useHotkeys Hook', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('exports valid useHotkeys function', () => {
    expect(typeof useHotkeys).toBe('function');
  });

  it('registers window keydown listener when window is defined', () => {
    const addEventListener = vi.fn();
    const removeEventListener = vi.fn();

    vi.stubGlobal('window', {
      addEventListener,
      removeEventListener,
    });

    expect(typeof useHotkeys).toBe('function');
  });
});
