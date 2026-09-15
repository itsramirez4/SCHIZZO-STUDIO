import { WorkflowProfile } from '@/types/profiles';

/**
 * The 5 built-in profiles differ in what's actually real and useful to differ: which panels
 * open by default and the default brush size/opacity. They deliberately do NOT ship different
 * default keybindings per profession — there's no honest basis for e.g. "animators press Z for
 * X" that isn't just made up, so every built-in profile starts from the same shortcuts (empty
 * overrides) and the user customizes from there if they want per-profile key differences.
 */
export const BUILT_IN_PROFILES: WorkflowProfile[] = [
  {
    id: 'builtin-illustration',
    name: 'Ilustración',
    builtIn: true,
    shortcutOverrides: {},
    defaultBrushSize: 20,
    defaultOpacity: 1,
    visiblePanels: ['layers', 'colorTools'],
  },
  {
    id: 'builtin-design',
    name: 'Diseño gráfico',
    builtIn: true,
    shortcutOverrides: {},
    defaultBrushSize: 10,
    defaultOpacity: 1,
    visiblePanels: ['layers', 'assetLibrary', 'colorTools'],
  },
  {
    id: 'builtin-animation',
    name: 'Animación',
    builtIn: true,
    shortcutOverrides: {},
    defaultBrushSize: 15,
    defaultOpacity: 1,
    visiblePanels: ['layers', 'animation'],
  },
  {
    id: 'builtin-conceptart',
    name: 'Concept art',
    builtIn: true,
    shortcutOverrides: {},
    defaultBrushSize: 40,
    defaultOpacity: 0.85,
    visiblePanels: ['layers', 'references', 'colorTools'],
  },
  {
    id: 'builtin-photoediting',
    name: 'Edición de fotos',
    builtIn: true,
    shortcutOverrides: {},
    defaultBrushSize: 25,
    defaultOpacity: 0.7,
    visiblePanels: ['layers', 'filters', 'histogram'],
  },
];
