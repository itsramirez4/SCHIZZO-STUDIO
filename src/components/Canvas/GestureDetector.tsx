import { useEffect, useRef } from 'react';
import { GestureRecognizer, TouchPoint } from '@/services/gestureRecognition.service';
import { useCustomizationStore } from '@/store/customizationStore';
import { useShortcutRuntimeStore } from '@/store/shortcutRuntimeStore';

interface Props {
  targetRef: React.RefObject<HTMLElement>;
  onZoomBy: (factor: number) => void;
}

/**
 * Real multi-touch gesture detection via the native Touch Events API — deliberately not the
 * `hammerjs` dependency the pasted spec listed, since the browser's own API already covers
 * everything needed here. Only fires on actual touch-capable hardware (a touchscreen or tablet
 * digitizer that reports touch events) — a trackpad's pinch-to-zoom on a non-touch Windows
 * laptop arrives as wheel+ctrlKey events instead, which this does not read, and isn't something
 * this round adds a second code path for.
 */
export default function GestureDetector({ targetRef, onZoomBy }: Props) {
  const onZoomByRef = useRef(onZoomBy);
  onZoomByRef.current = onZoomBy;

  useEffect(() => {
    const el = targetRef.current;
    if (!el) return;

    const recognizer = new GestureRecognizer(
      (type) => {
        const actionId = useCustomizationStore.getState().gestureBindings[type];
        if (actionId) useShortcutRuntimeStore.getState().dispatch(actionId);
      },
      (scaleRatio) => onZoomByRef.current(scaleRatio)
    );

    function toPoints(list: TouchList): TouchPoint[] {
      return Array.from(list).map((t) => ({ id: t.identifier, x: t.clientX, y: t.clientY }));
    }
    function onTouchStart(e: TouchEvent) {
      recognizer.handleStart(toPoints(e.touches));
    }
    function onTouchMove(e: TouchEvent) {
      recognizer.handleMove(toPoints(e.touches));
    }
    function onTouchEnd(e: TouchEvent) {
      recognizer.handleEnd(toPoints(e.changedTouches), e.touches.length);
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: true });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    el.addEventListener('touchcancel', onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [targetRef]);

  return null;
}
