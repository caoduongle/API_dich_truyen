import { useState, useCallback, UIEvent } from 'react';

export interface UseVirtualListProps<T> {
  items: T[];
  itemHeight?: number;
  containerHeight?: number;
  overscan?: number;
}

export function useVirtualList<T>({
  items,
  itemHeight = 52,
  containerHeight = 500,
  overscan = 10,
}: UseVirtualListProps<T>) {
  const [scrollTop, setScrollTop] = useState(0);

  const onScroll = useCallback((e: UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(
    items.length - 1,
    Math.floor((scrollTop + containerHeight) / itemHeight) + overscan
  );

  const visibleItems = items.slice(startIndex, endIndex + 1).map((item, index) => ({
    item,
    index: startIndex + index,
    style: {
      position: 'absolute' as const,
      top: 0,
      transform: `translateY(${(startIndex + index) * itemHeight}px)`,
      height: `${itemHeight}px`,
      left: 0,
      right: 0,
    },
  }));

  const totalHeight = items.length * itemHeight;

  return {
    visibleItems,
    totalHeight,
    onScroll,
    scrollTop,
  };
}
