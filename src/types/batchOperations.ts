/**
 * A much smaller slice of the pasted "Batch Operations & CLI Pro" spec.
 *
 * Dropped entirely: the CLI terminal (a fake shell parsing typed strings like "resize x.png
 * 800 600" — theater with no real command execution behind it, and this is a GUI drawing app,
 * not a terminal emulator), the script/scheduling system (BatchSchedule's daily/weekly/monthly
 * triggers need a background service; a closed Electron app can't run a scheduled job, and
 * "while the app happens to be open" cron has no real use case here), dedicated Web Workers per
 * operation (canvas filter ops here are cheap single-image passes — the same cost class as
 * every other synchronous filter in this app, not GIF-encoding-scale work), and performance
 * metrics tracking CPU/memory (not meaningfully obtainable from a renderer process, and not
 * something a fabricated number should stand in for).
 *
 * What's real: import N images, resize + apply a few existing filters + convert format, in
 * one pass, then write all results into a folder. The resize/filter/encode functions this
 * leans on already exist (filter.service.ts, bmp.service.ts, tiff.service.ts) — nothing here
 * reimplements brightness/contrast/etc. from scratch.
 */

export type BatchResizeMode = 'exact' | 'fit' | 'fill';

export interface BatchResizeConfig {
  enabled: boolean;
  width: number;
  height: number;
  mode: BatchResizeMode;
}

export interface BatchFilterConfig {
  brightness: number; // -100..100
  contrast: number; // -100..100
  saturation: number; // -100..100
  sepia: number; // 0..100
  grayscale: boolean;
  invert: boolean;
}

export type BatchOutputFormat = 'png' | 'jpg' | 'webp' | 'avif' | 'bmp' | 'tiff';

export const BATCH_FORMAT_LABELS: Record<BatchOutputFormat, string> = {
  png: 'PNG',
  jpg: 'JPG',
  webp: 'WebP',
  avif: 'AVIF',
  bmp: 'BMP',
  tiff: 'TIFF',
};

export type BatchItemStatus = 'pending' | 'processing' | 'done' | 'error';

export interface BatchItem {
  id: string;
  name: string;
  sourceDataUrl: string;
  status: BatchItemStatus;
  resultDataUrl?: string;
  error?: string;
}
