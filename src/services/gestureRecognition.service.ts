import { DiscreteGestureType } from '@/types/gestures';

export interface TouchPoint {
  id: number;
  x: number;
  y: number;
}

const LONG_PRESS_MS = 500;
const DOUBLE_TAP_MAX_GAP_MS = 350;
const DOUBLE_TAP_MAX_DISTANCE = 30;
const SWIPE_MIN_DISTANCE = 50;
const SWIPE_MAX_DURATION_MS = 600;
const TAP_MAX_MOVEMENT = 10;
const TAP_MAX_DURATION_MS = 250;

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * A real, stateful gesture recognizer — the pasted spec's version checked `Date.now() -
 * startTime < 250` for tap and `< 500` for "double tap" on the SAME single touch sequence,
 * which can never actually detect a double tap: a quick tap always satisfies the tighter
 * 250ms check first, so the 500ms branch is dead code. A genuine double tap requires comparing
 * TWO separate tap events (this one's position/time against the previous one's), which is what
 * this tracks instead.
 */
export class GestureRecognizer {
  private startTouches: TouchPoint[] = [];
  private startTime = 0;
  private lastPinchDistance = 0;
  private moved = false;
  private lastTapTime = 0;
  private lastTapPos: { x: number; y: number } | null = null;
  private longPressTimer: ReturnType<typeof setTimeout> | null = null;
  private longPressFired = false;

  constructor(
    private onDiscrete: (type: DiscreteGestureType) => void,
    private onPinch: (scaleRatio: number) => void
  ) {}

  handleStart(touches: TouchPoint[]) {
    this.startTouches = touches;
    this.startTime = Date.now();
    this.moved = false;
    this.longPressFired = false;
    this.clearLongPressTimer();

    if (touches.length === 2) {
      this.lastPinchDistance = distance(touches[0], touches[1]);
    } else if (touches.length === 1) {
      this.longPressTimer = setTimeout(() => {
        if (!this.moved) {
          this.longPressFired = true;
          this.onDiscrete('longPress');
        }
      }, LONG_PRESS_MS);
    }
  }

  handleMove(touches: TouchPoint[]) {
    if (touches.length === 2 && this.lastPinchDistance > 0) {
      const currentDistance = distance(touches[0], touches[1]);
      const ratio = currentDistance / this.lastPinchDistance;
      if (Math.abs(ratio - 1) > 0.01) this.onPinch(ratio);
      this.lastPinchDistance = currentDistance;
    }

    if (touches[0] && this.startTouches[0] && distance(touches[0], this.startTouches[0]) > TAP_MAX_MOVEMENT) {
      this.moved = true;
      this.clearLongPressTimer();
    }
  }

  /** `endedTouches` is the browser's `changedTouches` for this touchend — the touches that just
   * lifted, still carrying their final position (unlike `touches`, which no longer includes
   * them). `remainingCount` is how many touches are still down afterward. */
  handleEnd(endedTouches: TouchPoint[], remainingCount: number) {
    this.clearLongPressTimer();
    // Fingers rarely lift in the same instant: while any is still down the gesture is not over, and
    // forgetting it now would make every two- or three-finger tap impossible to recognise.
    if (remainingCount > 0) return;
    const wasLongPress = this.longPressFired;
    const duration = Date.now() - this.startTime;
    const touchCountAtStart = this.startTouches.length;
    const startPoint = this.startTouches[0];
    const endPoint = endedTouches[0];

    if (!wasLongPress && touchCountAtStart >= 2 && remainingCount === 0 && duration < TAP_MAX_DURATION_MS && !this.moved) {
      this.onDiscrete(touchCountAtStart === 2 ? 'twoFingerTap' : 'threeFingerTap');
    } else if (!wasLongPress && touchCountAtStart === 1 && remainingCount === 0 && startPoint && endPoint) {
      const dx = endPoint.x - startPoint.x;
      const dy = endPoint.y - startPoint.y;
      const dist = Math.hypot(dx, dy);

      if (!this.moved && duration < TAP_MAX_DURATION_MS) {
        const now = Date.now();
        if (this.lastTapPos && now - this.lastTapTime < DOUBLE_TAP_MAX_GAP_MS && distance(startPoint, this.lastTapPos) < DOUBLE_TAP_MAX_DISTANCE) {
          this.onDiscrete('doubleTap');
          this.lastTapTime = 0;
          this.lastTapPos = null;
        } else {
          this.onDiscrete('tap');
          this.lastTapTime = now;
          this.lastTapPos = { ...startPoint };
        }
      } else if (dist > SWIPE_MIN_DISTANCE && duration < SWIPE_MAX_DURATION_MS) {
        const angle = Math.atan2(dy, dx) * (180 / Math.PI);
        if (angle > -45 && angle <= 45) this.onDiscrete('swipeRight');
        else if (angle > 45 && angle <= 135) this.onDiscrete('swipeDown');
        else if (angle > 135 || angle <= -135) this.onDiscrete('swipeLeft');
        else this.onDiscrete('swipeUp');
      }
    }

    this.startTouches = [];
    this.moved = false;
  }

  private clearLongPressTimer() {
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
  }
}
