import { Project } from '@/types';
import { flattenLayers } from './layer.service';
import { serializeProject } from './file.service';

const MAX_COLOR_SAMPLES = 20000; // same bound as paletteExtraction.service — counting every
// pixel of a large canvas is real, avoidable wall time for a number that only needs to be
// approximately right.

export interface ProjectStats {
  layerCount: number;
  layerCountByType: Record<string, number>;
  canvasWidth: number;
  canvasHeight: number;
  approxDistinctColors: number;
  estimatedFileSizeBytes: number;
  created: string;
  lastModified: string;
  undoStepsAvailable: number;
  redoStepsAvailable: number;
  blendModesUsed: string[];
  hasAnimation: boolean;
  frameCount: number | null;
}

function countApproxDistinctColors(imageData: ImageData): number {
  const data = imageData.data;
  const pixelCount = data.length / 4;
  const step = Math.max(1, Math.floor(pixelCount / MAX_COLOR_SAMPLES));
  const seen = new Set<number>();
  for (let p = 0; p < pixelCount; p += step) {
    const i = p * 4;
    if (data[i + 3] === 0) continue; // fully transparent pixels don't count as a "color"
    seen.add((data[i] << 16) | (data[i + 1] << 8) | data[i + 2]);
  }
  return seen.size;
}

export function computeProjectStats(
  project: Project,
  undoStepsAvailable: number,
  redoStepsAvailable: number
): ProjectStats {
  const layerCountByType: Record<string, number> = {};
  for (const layer of project.layers) {
    layerCountByType[layer.type] = (layerCountByType[layer.type] ?? 0) + 1;
  }

  const flattened = flattenLayers(project.layers, project.width, project.height);
  const imageData = flattened.getContext('2d')!.getImageData(0, 0, flattened.width, flattened.height);

  // Same JSON the real save/autosave path writes — an honest size estimate, not a guess.
  const estimatedFileSizeBytes = JSON.stringify(serializeProject(project)).length;

  return {
    layerCount: project.layers.length,
    layerCountByType,
    canvasWidth: project.width,
    canvasHeight: project.height,
    approxDistinctColors: countApproxDistinctColors(imageData),
    estimatedFileSizeBytes,
    created: project.created,
    lastModified: project.lastModified,
    undoStepsAvailable,
    redoStepsAvailable,
    blendModesUsed: [...new Set(project.layers.map((l) => l.blendMode))],
    hasAnimation: !!project.animation,
    frameCount: project.animation ? project.animation.frames.length : null,
  };
}
