/** How many undo states keep their pixel data in memory. Older ones are spilled to IndexedDB, so
 * the undo history itself has no fixed limit (it is bounded only by free disk space). */
export const HISTORY_IN_MEMORY = 30;

export const DEFAULT_CANVAS_WIDTH = 1920;
export const DEFAULT_CANVAS_HEIGHT = 1080;
export const DEFAULT_DPI = 72;

/** Where the "Enviar comentario" dialog's email button sends feedback — a placeholder for the
 * closed testing phase, change freely whenever there's a proper contact address. */
export const FEEDBACK_EMAIL = 'itsramirez4@gmail.com';

export const BLEND_MODES: { label: string; value: GlobalCompositeOperation }[] = [
  { label: 'Normal', value: 'source-over' },
  { label: 'Multiplicar', value: 'multiply' },
  { label: 'Pantalla', value: 'screen' },
  { label: 'Superponer', value: 'overlay' },
  { label: 'Oscurecer', value: 'darken' },
  { label: 'Aclarar', value: 'lighten' },
  { label: 'Diferencia', value: 'difference' },
  { label: 'Exclusión', value: 'exclusion' },
  { label: 'Luz fuerte', value: 'hard-light' },
  { label: 'Luz suave', value: 'soft-light' },
  { label: 'Subexponer color', value: 'color-dodge' },
  { label: 'Sobreexponer color', value: 'color-burn' },
  { label: 'Tono', value: 'hue' },
  { label: 'Saturación', value: 'saturation' },
  { label: 'Color', value: 'color' },
  { label: 'Luminosidad', value: 'luminosity' },
];

export const ZOOM_MIN = 0.05;
export const ZOOM_MAX = 32;
