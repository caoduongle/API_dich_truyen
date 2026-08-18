import { useState, useEffect } from 'react';

export function useRangeState(totalChapters: number) {
  const [enabled, setEnabled] = useState<boolean>(false);
  const [start, setStart] = useState<number>(1);
  const [end, setEnd] = useState<number>(() => totalChapters || 1);

  useEffect(() => {
    if (totalChapters > 0) {
      setEnd(prev => (prev > totalChapters || prev === 0 ? totalChapters : prev));
    }
  }, [totalChapters]);

  return {
    enabled,
    setEnabled,
    start,
    setStart,
    end,
    setEnd,
  };
}
