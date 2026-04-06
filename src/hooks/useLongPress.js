import { useRef, useCallback, useState } from 'react';

/**
 * Returns props to spread on an element to detect a long press.
 * Works with both mouse and touch.
 *
 * @param {Function} onLongPress - called when long press fires
 * @param {number}   duration    - ms to hold before firing (default 2000)
 */
export function useLongPress(onLongPress, duration = 2000) {
  const timerRef = useRef(null);
  const [pressing, setPressing] = useState(false);

  const start = useCallback((e) => {
    // Don't steal scroll events on touch
    if (e.type === 'touchstart') {
      // Only left-touch (single finger)
      if (e.touches.length !== 1) return;
    }
    setPressing(true);
    timerRef.current = setTimeout(() => {
      setPressing(false);
      onLongPress();
    }, duration);
  }, [onLongPress, duration]);

  const cancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setPressing(false);
  }, []);

  return {
    pressing,
    handlers: {
      onMouseDown: start,
      onMouseUp: cancel,
      onMouseLeave: cancel,
      onTouchStart: start,
      onTouchEnd: cancel,
      onTouchCancel: cancel,
      onContextMenu: (e) => e.preventDefault(), // suppress iOS long-press menu
    },
  };
}
