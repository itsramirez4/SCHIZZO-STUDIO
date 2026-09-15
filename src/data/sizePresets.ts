/** Named canvas-size presets — the honest, real core of what the pasted "artboard template
 * engine" spec asked for: a curated list of common target sizes, not a fabricated multi-artboard
 * document model this app's single-canvas-per-project architecture doesn't have. Reused both by
 * "New Project" (pick a starting size) and by "Export at multiple sizes" (batch-resize the
 * current canvas to several of these at once). */

export interface SizePreset {
  id: string;
  name: string;
  width: number;
  height: number;
  category: 'web' | 'print' | 'social' | 'ui';
}

export const SIZE_PRESETS: SizePreset[] = [
  { id: 'web-desktop', name: 'Web escritorio (1920×1080)', width: 1920, height: 1080, category: 'web' },
  { id: 'web-tablet', name: 'Web tablet (768×1024)', width: 768, height: 1024, category: 'web' },
  { id: 'web-mobile', name: 'Web móvil (375×812)', width: 375, height: 812, category: 'web' },
  { id: 'print-a4', name: 'Impresión A4 300dpi (2480×3508)', width: 2480, height: 3508, category: 'print' },
  { id: 'print-letter', name: 'Impresión Carta 300dpi (2550×3300)', width: 2550, height: 3300, category: 'print' },
  { id: 'social-instagram-post', name: 'Instagram publicación (1080×1080)', width: 1080, height: 1080, category: 'social' },
  { id: 'social-instagram-story', name: 'Instagram historia (1080×1920)', width: 1080, height: 1920, category: 'social' },
  { id: 'social-twitter', name: 'Twitter/X publicación (1600×900)', width: 1600, height: 900, category: 'social' },
  { id: 'social-facebook', name: 'Facebook publicación (1200×630)', width: 1200, height: 630, category: 'social' },
  { id: 'ui-mobile-app', name: 'App móvil (375×812)', width: 375, height: 812, category: 'ui' },
  { id: 'ui-desktop-app', name: 'App de escritorio (1440×900)', width: 1440, height: 900, category: 'ui' },
];

export const SIZE_PRESET_CATEGORY_LABELS: Record<SizePreset['category'], string> = {
  web: 'Web',
  print: 'Impresión',
  social: 'Redes sociales',
  ui: 'UI / apps',
};
