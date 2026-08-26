import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  calculateScrollOverflow,
  scrollElementIntoView,
  useScrollOverflow,
} from '../useScrollOverflow';

describe('useScrollOverflow Unit Tests', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('calculateScrollOverflow', () => {
    it('detects right overflow when scrollWidth > clientWidth and scrollLeft is 0', () => {
      const result = calculateScrollOverflow(0, 500, 1000);
      expect(result.canScrollLeft).toBe(false);
      expect(result.canScrollRight).toBe(true);
    });

    it('detects both left and right overflow when scrolled in between', () => {
      const result = calculateScrollOverflow(200, 500, 1000);
      expect(result.canScrollLeft).toBe(true);
      expect(result.canScrollRight).toBe(true);
    });

    it('detects left overflow only when scrolled to end', () => {
      const result = calculateScrollOverflow(500, 500, 1000);
      expect(result.canScrollLeft).toBe(true);
      expect(result.canScrollRight).toBe(false);
    });

    it('detects no overflow when content fits within client width', () => {
      const result = calculateScrollOverflow(0, 500, 500);
      expect(result.canScrollLeft).toBe(false);
      expect(result.canScrollRight).toBe(false);
    });

    it('handles custom threshold parameter', () => {
      const result1 = calculateScrollOverflow(5, 500, 1000, 10);
      expect(result1.canScrollLeft).toBe(false); // 5 is <= threshold 10

      const result2 = calculateScrollOverflow(15, 500, 1000, 10);
      expect(result2.canScrollLeft).toBe(true); // 15 > threshold 10
    });

    it('accurately detects boundary conditions on common screen widths (1024, 1280, 1366, 1920)', () => {
      // Laptop 1024px with 1400px tabs
      const laptop1024 = calculateScrollOverflow(0, 1024, 1400);
      expect(laptop1024.canScrollLeft).toBe(false);
      expect(laptop1024.canScrollRight).toBe(true);

      // Laptop 1280px with 1400px tabs scrolled by 100px
      const laptop1280 = calculateScrollOverflow(100, 1280, 1400);
      expect(laptop1280.canScrollLeft).toBe(true);
      expect(laptop1280.canScrollRight).toBe(true);

      // Laptop 1366px scrolled to end
      const laptop1366 = calculateScrollOverflow(34, 1366, 1400);
      expect(laptop1366.canScrollLeft).toBe(true);
      expect(laptop1366.canScrollRight).toBe(false);

      // Desktop 1920px with 1400px tabs (no overflow)
      const desktop1920 = calculateScrollOverflow(0, 1920, 1400);
      expect(desktop1920.canScrollLeft).toBe(false);
      expect(desktop1920.canScrollRight).toBe(false);
    });
  });

  describe('scrollElementIntoView', () => {
    it('calls scrollIntoView on target element when passed an element directly', () => {
      const scrollIntoView = vi.fn();
      const mockElement = {
        scrollIntoView,
      } as unknown as HTMLElement;

      scrollElementIntoView(mockElement, 'smooth');

      expect(scrollIntoView).toHaveBeenCalledWith({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'nearest',
      });
    });

    it('calls scrollIntoView on target element found by ID when document is defined', () => {
      const scrollIntoView = vi.fn();
      const mockElement = {
        id: 'tab-hako-checker',
        scrollIntoView,
      } as unknown as HTMLElement;

      vi.stubGlobal('document', {
        getElementById: vi.fn((id: string) => (id === 'tab-hako-checker' ? mockElement : null)),
      });

      scrollElementIntoView('tab-hako-checker', 'smooth');

      expect(scrollIntoView).toHaveBeenCalledWith({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'nearest',
      });
    });

    it('handles gracefully when element or ID does not exist', () => {
      vi.stubGlobal('document', {
        getElementById: vi.fn(() => null),
      });

      expect(() => {
        scrollElementIntoView('non-existent-id');
      }).not.toThrow();

      expect(() => {
        scrollElementIntoView(null);
      }).not.toThrow();
    });
  });

  describe('useScrollOverflow hook export', () => {
    it('exports a valid React hook function', () => {
      expect(typeof useScrollOverflow).toBe('function');
    });
  });
});
