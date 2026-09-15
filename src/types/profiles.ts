import { KeyCombo } from './shortcuts';

export interface WorkflowProfile {
  id: string;
  name: string;
  builtIn: boolean;
  shortcutOverrides: Record<string, KeyCombo | null>;
  defaultBrushSize: number;
  defaultOpacity: number; // 0-1
  /** uiStore's `show*` panel keys, without the `show` prefix and lowercased first letter —
   * e.g. 'layers' for showLayerPanel, 'animation' for showAnimationPanel. */
  visiblePanels: string[];
}

export interface MacroStep {
  actionId: string;
  delayMs: number; // time since the previous step (or since recording start, for the first)
}

export interface RecordedMacro {
  id: string;
  name: string;
  steps: MacroStep[];
  createdAt: number;
}
