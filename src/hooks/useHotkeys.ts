import { useEffect, useRef } from 'react';

export interface HotkeyOptions {
  /** Cho phép phím tắt kích hoạt ngay cả khi đang focus trong input / textarea */
  enableOnFormTags?: boolean;
  /** Tự động gọi e.preventDefault() */
  preventDefault?: boolean;
  /** Bật/tắt lắng nghe phím tắt */
  enabled?: boolean;
}

export type KeyCombo = string; // Ví dụ: 'ctrl+enter', 'ctrl+s', 'alt+1', 'escape'

/**
 * Hook lắng nghe phím tắt bàn phím toàn cục hoặc theo ngữ cảnh
 */
export function useHotkeys(
  keyCombo: KeyCombo,
  callback: (e: KeyboardEvent) => void,
  options: HotkeyOptions = {}
) {
  const {
    enableOnFormTags = true,
    preventDefault = true,
    enabled = true,
  } = options;

  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    const parsedKeys = keyCombo
      .toLowerCase()
      .split('+')
      .map((k) => k.trim());

    const hasCtrl = parsedKeys.includes('ctrl') || parsedKeys.includes('control');
    const hasAlt = parsedKeys.includes('alt');
    const hasShift = parsedKeys.includes('shift');
    const hasMeta = parsedKeys.includes('cmd') || parsedKeys.includes('meta');
    
    // Phím chính không phải phím bổ trợ (modifier)
    const mainKey = parsedKeys.find(
      (k) => !['ctrl', 'control', 'alt', 'shift', 'cmd', 'meta'].includes(k)
    );

    const handleKeyDown = (e: KeyboardEvent) => {
      // Bỏ qua nếu đang nhập liệu trong form và không cho phép
      const target = e.target as HTMLElement | null;
      const isFormTag =
        target &&
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);

      if (isFormTag && !enableOnFormTags) {
        return;
      }

      // Kiểm tra modifier keys (hỗ trợ Ctrl trên Windows/Linux hoặc Cmd trên macOS)
      const ctrlOrMeta = e.ctrlKey || e.metaKey;
      if (hasCtrl && !ctrlOrMeta) return;
      if (hasAlt && !e.altKey) return;
      if (hasShift && !e.shiftKey) return;
      if (hasMeta && !e.metaKey) return;

      // Kiểm tra main key
      if (mainKey) {
        const eventKey = e.key.toLowerCase();
        let match = false;

        if (mainKey === 'enter' && eventKey === 'enter') match = true;
        else if (mainKey === 'escape' && (eventKey === 'escape' || eventKey === 'esc')) match = true;
        else if (mainKey === 'space' && (eventKey === ' ' || eventKey === 'spacebar')) match = true;
        else if (eventKey === mainKey) match = true;

        if (match) {
          if (preventDefault) {
            e.preventDefault();
          }
          callbackRef.current(e);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [keyCombo, enableOnFormTags, preventDefault, enabled]);
}
