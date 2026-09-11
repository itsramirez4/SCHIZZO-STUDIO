import { WorkspacePreset } from '@/types/workspace';

/** Fractions of the viewport — resolved to real pixels against the current window size when
 * a preset loads, so the layout looks reasonable at any window size instead of only the one
 * resolution it was designed against. */
export const WORKSPACE_PRESETS: WorkspacePreset[] = [
  {
    id: 'digital-painting',
    name: 'Pintura digital',
    description: 'Lienzo grande al centro, capas y filtros a la derecha.',
    uiScale: 1,
    theme: 'dark',
    panels: {
      toolbox: { x: 0, y: 0.03, w: 0.12, h: 0.6 },
      canvas: { x: 0.13, y: 0.03, w: 0.66, h: 0.94 },
      layers: { x: 0.8, y: 0.03, w: 0.2, h: 0.47 },
      filters: { x: 0.8, y: 0.51, w: 0.2, h: 0.46 },
      comic: { x: 0.8, y: 0.03, w: 0.2, h: 0.47, visible: false },
      animation: { x: 0.8, y: 0.51, w: 0.2, h: 0.46, visible: false },
      histogram: { x: 0, y: 0.65, w: 0.12, h: 0.32 },
      history: { x: 0, y: 0.65, w: 0.12, h: 0.32, visible: false },
    },
  },
  {
    id: 'comic-drawing',
    name: 'Dibujo de cómic',
    description: 'Herramientas de viñetas, tramas y globos siempre a mano.',
    uiScale: 1,
    theme: 'dark',
    panels: {
      toolbox: { x: 0, y: 0.03, w: 0.12, h: 0.45 },
      canvas: { x: 0.13, y: 0.03, w: 0.63, h: 0.94 },
      comic: { x: 0.77, y: 0.03, w: 0.23, h: 0.62 },
      layers: { x: 0.77, y: 0.66, w: 0.23, h: 0.31 },
      filters: { x: 0.77, y: 0.03, w: 0.23, h: 0.62, visible: false },
      animation: { x: 0.77, y: 0.66, w: 0.23, h: 0.31, visible: false },
      histogram: { x: 0, y: 0.5, w: 0.12, h: 0.24, visible: false },
      history: { x: 0, y: 0.5, w: 0.12, h: 0.47 },
    },
  },
  {
    id: 'concept-art',
    name: 'Concept art',
    description: 'Lienzo amplio con filtros atmosféricos y capas a la vista.',
    uiScale: 0.95,
    theme: 'dark',
    panels: {
      toolbox: { x: 0, y: 0.03, w: 0.11, h: 0.94 },
      canvas: { x: 0.12, y: 0.03, w: 0.68, h: 0.94 },
      filters: { x: 0.81, y: 0.03, w: 0.19, h: 0.5 },
      layers: { x: 0.81, y: 0.54, w: 0.19, h: 0.43 },
      comic: { x: 0.81, y: 0.03, w: 0.19, h: 0.5, visible: false },
      animation: { x: 0.81, y: 0.54, w: 0.19, h: 0.43, visible: false },
      histogram: { x: 0.81, y: 0.03, w: 0.19, h: 0.5, visible: false },
      history: { x: 0.81, y: 0.54, w: 0.19, h: 0.43, visible: false },
    },
  },
  {
    id: 'ui-design',
    name: 'Diseño de UI',
    description: 'Layout limpio y minimalista: lienzo, capas e historial.',
    uiScale: 1,
    theme: 'light',
    panels: {
      toolbox: { x: 0, y: 0.03, w: 0.1, h: 0.94 },
      canvas: { x: 0.11, y: 0.03, w: 0.68, h: 0.94 },
      layers: { x: 0.8, y: 0.03, w: 0.2, h: 0.6 },
      history: { x: 0.8, y: 0.64, w: 0.2, h: 0.33 },
      filters: { x: 0.8, y: 0.03, w: 0.2, h: 0.6, visible: false },
      comic: { x: 0.8, y: 0.03, w: 0.2, h: 0.6, visible: false },
      animation: { x: 0.8, y: 0.64, w: 0.2, h: 0.33, visible: false },
      histogram: { x: 0.8, y: 0.64, w: 0.2, h: 0.33, visible: false },
    },
  },
  {
    id: 'pixel-art',
    name: 'Pixel art',
    description: 'Paletas, dithering y ciclado de color a mano, timeline de animación abajo.',
    uiScale: 1,
    theme: 'dark',
    panels: {
      toolbox: { x: 0, y: 0.03, w: 0.1, h: 0.55 },
      canvas: { x: 0.11, y: 0.03, w: 0.65, h: 0.6 },
      filters: { x: 0.77, y: 0.03, w: 0.23, h: 0.94 },
      animation: { x: 0.11, y: 0.65, w: 0.65, h: 0.32 },
      layers: { x: 0, y: 0.6, w: 0.1, h: 0.37 },
      comic: { x: 0.77, y: 0.03, w: 0.23, h: 0.94, visible: false },
      histogram: { x: 0, y: 0.6, w: 0.1, h: 0.37, visible: false },
      history: { x: 0, y: 0.6, w: 0.1, h: 0.37, visible: false },
    },
  },
  {
    id: 'animation',
    name: 'Animación',
    description: 'Timeline ancho abajo, vista previa grande arriba.',
    uiScale: 1,
    theme: 'dark',
    panels: {
      layers: { x: 0, y: 0.03, w: 0.15, h: 0.63 },
      canvas: { x: 0.16, y: 0.03, w: 0.65, h: 0.63 },
      history: { x: 0.82, y: 0.03, w: 0.18, h: 0.63 },
      animation: { x: 0, y: 0.68, w: 1, h: 0.29 },
      toolbox: { x: 0, y: 0.03, w: 0.15, h: 0.63, visible: false },
      filters: { x: 0.82, y: 0.03, w: 0.18, h: 0.63, visible: false },
      comic: { x: 0.82, y: 0.03, w: 0.18, h: 0.63, visible: false },
      histogram: { x: 0.82, y: 0.03, w: 0.18, h: 0.63, visible: false },
    },
  },
];

export function getPreset(id: string): WorkspacePreset | undefined {
  return WORKSPACE_PRESETS.find((p) => p.id === id);
}
