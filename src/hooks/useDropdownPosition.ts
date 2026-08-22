import { useState, useLayoutEffect, useEffect, useRef, useCallback } from 'react';

export interface DropdownCoords {
  top: number;
  right: number;
}

export interface UseDropdownPositionOptions {
  isOpen: boolean;
  onClose: () => void;
  offsetY?: number;
}

export function useDropdownPosition<T extends HTMLElement = HTMLElement>({
  isOpen,
  onClose,
  offsetY = 4,
}: UseDropdownPositionOptions) {
  const triggerRef = useRef<T | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [coords, setCoords] = useState<DropdownCoords | null>(null);

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setCoords({
      top: rect.bottom + offsetY,
      right: Math.max(0, window.innerWidth - rect.right),
    });
  }, [offsetY]);

  useLayoutEffect(() => {
    if (!isOpen) {
      setCoords(null);
      return;
    }

    updatePosition();

    const handleResize = () => updatePosition();
    const handleScroll = () => updatePosition();

    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleScroll, true);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [isOpen, updatePosition]);

  // Handle outside click & Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        triggerRef.current &&
        !triggerRef.current.contains(target) &&
        menuRef.current &&
        !menuRef.current.contains(target)
      ) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  return {
    triggerRef,
    menuRef,
    coords,
    updatePosition,
  };
}
