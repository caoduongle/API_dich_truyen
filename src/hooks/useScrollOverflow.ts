/**
 * useScrollOverflow Hook & Helpers
 * Feature: 076-nav-tabs-overflow-fix
 *
 * Theo dõi trạng thái cuộn ngang của một phần tử container (tràn trái / tràn phải),
 * cung cấp hàm cuộn từng nấc (Chevron click) và cuộn mượt mà một phần tử con vào vùng nhìn thấy.
 */

import { useState, useEffect, useCallback, useRef, RefObject } from 'react';

export interface UseScrollOverflowOptions {
  /**
   * Ngưỡng pixel để xác định bắt đầu cuộn khỏi mép biên (mặc định: 1)
   */
  threshold?: number;
  /**
   * Khoảng cách cuộn mặc định cho nút Chevron (mặc định: 200px)
   */
  scrollStep?: number;
}

export interface ScrollOverflowState {
  canScrollLeft: boolean;
  canScrollRight: boolean;
}

export interface UseScrollOverflowReturn<T extends HTMLElement = HTMLElement> {
  containerRef: RefObject<T | null>;
  canScrollLeft: boolean;
  canScrollRight: boolean;
  checkOverflow: () => void;
  scrollToElement: (elementOrId: HTMLElement | string | null, behavior?: ScrollBehavior) => void;
  scrollByOffset: (offset: number, behavior?: ScrollBehavior) => void;
  scrollLeftAction: () => void;
  scrollRightAction: () => void;
}

/**
 * Tính toán trạng thái tràn cuộn theo kích thước và vị trí cuộn
 */
export function calculateScrollOverflow(
  scrollLeft: number,
  clientWidth: number,
  scrollWidth: number,
  threshold = 1
): ScrollOverflowState {
  const hasLeftOverflow = scrollLeft > threshold;
  const hasRightOverflow = scrollLeft + clientWidth < scrollWidth - threshold;

  return {
    canScrollLeft: hasLeftOverflow,
    canScrollRight: hasRightOverflow,
  };
}

/**
 * Cuộn một phần tử DOM hoặc ID phần tử vào khung nhìn
 */
export function scrollElementIntoView(
  elementOrId: HTMLElement | string | null,
  behavior: ScrollBehavior = 'smooth'
): void {
  if (!elementOrId) return;

  let target: HTMLElement | null = null;

  if (typeof elementOrId === 'string') {
    if (typeof document !== 'undefined' && typeof document.getElementById === 'function') {
      target = document.getElementById(elementOrId);
    }
  } else {
    target = elementOrId;
  }

  if (target && typeof target.scrollIntoView === 'function') {
    target.scrollIntoView({
      behavior,
      block: 'nearest',
      inline: 'nearest',
    });
  }
}

export function useScrollOverflow<T extends HTMLElement = HTMLElement>(
  options: UseScrollOverflowOptions = {}
): UseScrollOverflowReturn<T> {
  const { threshold = 1, scrollStep = 200 } = options;
  const containerRef = useRef<T | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkOverflow = useCallback(() => {
    const el = containerRef.current;
    if (!el) {
      setCanScrollLeft(false);
      setCanScrollRight(false);
      return;
    }

    const { canScrollLeft: left, canScrollRight: right } = calculateScrollOverflow(
      el.scrollLeft,
      el.clientWidth,
      el.scrollWidth,
      threshold
    );

    setCanScrollLeft(left);
    setCanScrollRight(right);
  }, [threshold]);

  const scrollToElement = useCallback(
    (elementOrId: HTMLElement | string | null, behavior: ScrollBehavior = 'smooth') => {
      scrollElementIntoView(elementOrId, behavior);
    },
    []
  );

  const scrollByOffset = useCallback(
    (offset: number, behavior: ScrollBehavior = 'smooth') => {
      const el = containerRef.current;
      if (!el) return;

      if (typeof el.scrollBy === 'function') {
        el.scrollBy({ left: offset, behavior });
      } else {
        el.scrollLeft += offset;
      }
    },
    []
  );

  const scrollLeftAction = useCallback(() => {
    scrollByOffset(-scrollStep);
  }, [scrollByOffset, scrollStep]);

  const scrollRightAction = useCallback(() => {
    scrollByOffset(scrollStep);
  }, [scrollByOffset, scrollStep]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    checkOverflow();

    const handleScroll = () => {
      checkOverflow();
    };

    el.addEventListener('scroll', handleScroll, { passive: true });

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        checkOverflow();
      });
      resizeObserver.observe(el);
    }

    const handleWindowResize = () => {
      checkOverflow();
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', handleWindowResize, { passive: true });
    }

    return () => {
      el.removeEventListener('scroll', handleScroll);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      if (typeof window !== 'undefined') {
        window.removeEventListener('resize', handleWindowResize);
      }
    };
  }, [checkOverflow]);

  return {
    containerRef,
    canScrollLeft,
    canScrollRight,
    checkOverflow,
    scrollToElement,
    scrollByOffset,
    scrollLeftAction,
    scrollRightAction,
  };
}

export default useScrollOverflow;
