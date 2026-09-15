/** Pinch is handled separately as a continuous zoom drive, not a discrete dispatched action —
 * "rotate" isn't included at all: there's no live canvas-rotation view feature for it to drive,
 * and fabricating one just to have something to bind a gesture to isn't worth the code. */
export type DiscreteGestureType =
  | 'tap'
  | 'doubleTap'
  | 'longPress'
  | 'swipeLeft'
  | 'swipeRight'
  | 'swipeUp'
  | 'swipeDown'
  | 'twoFingerTap'
  | 'threeFingerTap';

export const GESTURE_LABELS: Record<DiscreteGestureType, string> = {
  tap: 'Toque',
  doubleTap: 'Doble toque',
  longPress: 'Mantener presionado',
  swipeLeft: 'Deslizar a la izquierda',
  swipeRight: 'Deslizar a la derecha',
  swipeUp: 'Deslizar hacia arriba',
  swipeDown: 'Deslizar hacia abajo',
  twoFingerTap: 'Toque con dos dedos',
  threeFingerTap: 'Toque con tres dedos',
};
