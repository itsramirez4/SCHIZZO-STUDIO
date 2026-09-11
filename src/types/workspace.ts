export interface PanelPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Panel ids map 1:1 to real, already-existing components (see PANEL_REGISTRY in
 * WorkspaceShell.tsx) — not the finer-grained ids a from-scratch design might invent
 * (separate "brushes"/"colors"/"properties" panels don't exist as standalone components
 * today; they're bundled inside Toolbox.tsx). 'canvas' is always visible and not closable —
 * a workspace without a canvas isn't meaningful — but it's still movable/resizable like any
 * other panel.
 */
export type PanelId = 'toolbox' | 'canvas' | 'layers' | 'filters' | 'comic' | 'animation' | 'histogram' | 'history';

export interface PanelLayout {
  position: PanelPosition;
  collapsed: boolean;
  visible: boolean;
  zIndex: number;
}

export type ThemeMode = 'light' | 'dark' | 'auto';

export interface WorkspacePreset {
  id: string;
  name: string;
  description: string;
  uiScale: number;
  theme: ThemeMode;
  /** Fractions of the viewport (0-1), resolved to pixels at load time — not hardcoded
   * pixel rectangles, which would only look right at one specific window size. */
  panels: Record<PanelId, { x: number; y: number; w: number; h: number; collapsed?: boolean; visible?: boolean }>;
}
