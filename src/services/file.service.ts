import { Project, Layer, AnimationFrame } from '@/types';
import { isElectron, downloadDataUrl, sanitizeFilename } from '@/utils/fileUtils';
import { layerToDataUrl, loadLayerCanvasFromDataUrl, maskToDataUrl, loadMaskFromDataUrl } from './layer.service';

type SerializedLayer = Layer & { dataUrl?: string; maskDataUrl?: string };

interface SerializedProject extends Omit<Project, 'layers' | 'animation'> {
  layers: SerializedLayer[];
  animation?: { frames: (Omit<AnimationFrame, 'layers'> & { layers: SerializedLayer[] })[]; currentFrameIndex: number; fps: number; loop: boolean };
}

function serializeLayers(layers: Layer[]): SerializedLayer[] {
  return layers.map((layer) => ({
    ...layer,
    dataUrl: layerToDataUrl(layer.id),
    maskDataUrl: layer.hasMask ? maskToDataUrl(layer.id) : undefined,
  }));
}

function serializeProject(project: Project): SerializedProject {
  // The active frame's true state lives in `project.layers`, not the (possibly stale)
  // copy sitting in `animation.frames[currentFrameIndex]` — fold it back in before saving.
  const animation = project.animation
    ? {
        ...project.animation,
        frames: project.animation.frames.map((f, i) => ({
          ...f,
          layers: serializeLayers(i === project.animation!.currentFrameIndex ? project.layers : f.layers),
        })),
      }
    : undefined;

  return {
    ...project,
    lastModified: new Date().toISOString(),
    layers: serializeLayers(project.layers),
    animation,
  };
}

export async function saveProject(project: Project): Promise<{ canceled: boolean; filePath?: string }> {
  const serialized = serializeProject(project);
  const json = JSON.stringify(serialized);

  if (isElectron()) {
    const result = await window.electronAPI.saveProject(json, project.filePath);
    return result;
  }

  downloadDataUrl(
    `data:application/json;base64,${btoa(unescape(encodeURIComponent(json)))}`,
    `${sanitizeFilename(project.name)}.drawing`
  );
  return { canceled: false };
}

export async function saveProjectAs(project: Project): Promise<{ canceled: boolean; filePath?: string }> {
  const serialized = serializeProject(project);
  const json = JSON.stringify(serialized);

  if (isElectron()) {
    return window.electronAPI.saveProjectAs(json);
  }

  downloadDataUrl(
    `data:application/json;base64,${btoa(unescape(encodeURIComponent(json)))}`,
    `${sanitizeFilename(project.name)}.drawing`
  );
  return { canceled: false };
}

export async function openProject(): Promise<{ canceled: boolean; project?: Project }> {
  if (!isElectron()) return { canceled: true };

  const result = await window.electronAPI.openProject();
  if (result.canceled || !result.json) return { canceled: true };

  return { canceled: false, project: await deserializeProject(result.json, result.filePath) };
}

export async function openProjectAtPath(filePath: string): Promise<{ canceled: boolean; project?: Project }> {
  if (!isElectron()) return { canceled: true };
  const result = await window.electronAPI.openProjectAtPath(filePath);
  if (result.canceled || !result.json) return { canceled: true };
  return { canceled: false, project: await deserializeProject(result.json, result.filePath) };
}

async function loadLayers(layers: SerializedLayer[]): Promise<Layer[]> {
  await Promise.all(
    layers.flatMap((layer) => {
      const tasks: Promise<void>[] = [];
      if (layer.dataUrl) tasks.push(loadLayerCanvasFromDataUrl(layer.id, layer.dataUrl, layer.width, layer.height));
      if (layer.hasMask && layer.maskDataUrl) tasks.push(loadMaskFromDataUrl(layer.id, layer.maskDataUrl, layer.width, layer.height));
      return tasks;
    })
  );
  return layers.map(({ dataUrl, maskDataUrl, ...layer }) => layer);
}

async function deserializeProject(json: string, filePath?: string): Promise<Project> {
  const data: SerializedProject = JSON.parse(json);
  const layers = await loadLayers(data.layers);

  let animation: Project['animation'];
  if (data.animation) {
    const frames = await Promise.all(
      data.animation.frames.map(async (f) => ({ ...f, layers: await loadLayers(f.layers) }))
    );
    animation = { frames, currentFrameIndex: data.animation.currentFrameIndex, fps: data.animation.fps, loop: data.animation.loop };
  }

  const { layers: _l, animation: _a, ...rest } = data;
  return {
    ...rest,
    filePath: filePath ?? rest.filePath,
    layers,
    animation,
  };
}

export async function getRecentProjects(): Promise<string[]> {
  if (!isElectron()) return [];
  return window.electronAPI.getRecentProjects();
}
