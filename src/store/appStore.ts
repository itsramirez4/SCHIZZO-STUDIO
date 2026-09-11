import { create } from 'zustand';
import { v4 as uuid } from 'uuid';
import {
  Project,
  Layer,
  Brush,
  ToolType,
  DEFAULT_PROJECT_SETTINGS,
  ProjectType,
  SelectionRect,
  AnimationFrame,
  AdjustmentType,
  FillType,
} from '@/types';
import * as layerService from '@/services/layer.service';
import * as filterService from '@/services/filter.service';
import { loadPresets, createBrush as makeBrush } from '@/services/brush.service';
import { HistoryManager } from '@/services/history.service';
import { DEFAULT_DPI } from '@/utils/constants';

export const historyManager = new HistoryManager();

/** Deep-copies a full layer set (fresh ids + cloned canvases/masks), preserving group nesting. */
function duplicateLayerSet(sourceLayers: Layer[]): Layer[] {
  const idMap = new Map<string, string>();
  const copies = sourceLayers.map((l) => {
    const copy = layerService.duplicateLayer(l);
    idMap.set(l.id, copy.id);
    return copy;
  });
  return copies.map((c) => ({ ...c, parent: c.parent && idMap.has(c.parent) ? idMap.get(c.parent) : undefined }));
}

interface AppState {
  project: Project | null;
  currentLayerId: string | null;
  currentTool: ToolType;
  primaryColor: string;
  secondaryColor: string;
  brushLibrary: Brush[];
  currentBrush: Brush;
  zoom: number;
  panX: number;
  panY: number;
  isDrawing: boolean;
  historyVersion: number;
  canUndo: boolean;
  canRedo: boolean;
  selection: SelectionRect | null;
  maskEditLayerId: string | null;
  onionSkinEnabled: boolean;

  newProject: (opts: { name: string; type: ProjectType; width: number; height: number; dpi?: number }) => void;
  loadProjectData: (project: Project) => void;

  setCurrentTool: (tool: ToolType) => void;
  setPrimaryColor: (color: string) => void;
  setSecondaryColor: (color: string) => void;
  swapColors: () => void;

  setCurrentBrush: (brush: Brush) => void;
  updateCurrentBrush: (patch: Partial<Brush>) => void;
  addBrushToLibrary: (brush: Brush) => void;
  removeBrushFromLibrary: (id: string) => void;

  addLayer: (name?: string) => string;
  addReferenceLayer: (name?: string) => string;
  deleteLayer: (id: string) => void;
  duplicateLayer: (id: string) => void;
  renameLayer: (id: string, name: string) => void;
  setLayerOpacity: (id: string, opacity: number) => void;
  commitLayerOpacity: () => void;
  setLayerBlendMode: (id: string, blendMode: GlobalCompositeOperation) => void;
  setLayerVisibility: (id: string, visible: boolean) => void;
  setLayerLocked: (id: string, locked: boolean) => void;
  reorderLayers: (layers: Layer[]) => void;
  selectLayer: (id: string) => void;
  mergeLayerDown: (id: string) => void;

  createGroup: (name?: string) => string;
  setLayerParent: (id: string, parentId: string | null) => void;

  addAdjustmentLayer: (adjustmentType: AdjustmentType) => string;
  setAdjustmentParams: (id: string, params: Record<string, number>) => void;
  commitAdjustmentParams: () => void;

  addFillLayer: (fillType: FillType) => string;
  setFillType: (id: string, fillType: FillType) => void;
  setFillProps: (id: string, patch: Partial<Pick<Layer, 'fillColor' | 'gradient' | 'patternId' | 'patternColor'>>) => void;
  commitFillProps: () => void;

  addMaskToLayer: (id: string) => void;
  removeMaskFromLayer: (id: string) => void;
  setMaskEditLayerId: (id: string | null) => void;

  setZoom: (zoom: number) => void;
  setPan: (x: number, y: number) => void;
  setIsDrawing: (drawing: boolean) => void;

  setSelection: (rect: SelectionRect | null) => void;
  clearSelectionArea: () => void;

  toggleGrid: () => void;
  finishContentAwareResize: (newWidth: number, newHeight: number, resizedFrames: HTMLCanvasElement[]) => void;

  enableAnimation: () => void;
  addFrame: (mode: 'duplicate' | 'blank') => void;
  generateColorCycleFrames: (rangeColors: filterService.RGB[], steps: number, frameDurationMs: number) => void;
  importAnimationFrames: (frames: { canvas: HTMLCanvasElement; delayMs: number }[]) => void;
  deleteFrame: (index: number) => void;
  selectFrame: (index: number) => void;
  reorderFrames: (frames: AnimationFrame[]) => void;
  setFrameDuration: (index: number, ms: number) => void;
  setAnimationFps: (fps: number) => void;
  setAnimationLoop: (loop: boolean) => void;
  toggleOnionSkin: () => void;

  pushHistory: (action: string) => void;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  project: null,
  currentLayerId: null,
  currentTool: 'brush',
  primaryColor: '#000000',
  secondaryColor: '#ffffff',
  brushLibrary: loadPresets(),
  currentBrush: loadPresets()[0],
  zoom: 1,
  panX: 0,
  panY: 0,
  isDrawing: false,
  historyVersion: 0,
  canUndo: false,
  canRedo: false,
  selection: null,
  maskEditLayerId: null,
  onionSkinEnabled: false,

  newProject: ({ name, type, width, height, dpi }) => {
    layerService.clearRegistry();
    historyManager.clear();
    const baseLayer = layerService.createLayer('Capa 1', width, height);
    const project: Project = {
      id: uuid(),
      name,
      type,
      width,
      height,
      dpi: dpi ?? DEFAULT_DPI,
      created: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      layers: [baseLayer],
      brushes: [],
      settings: { ...DEFAULT_PROJECT_SETTINGS, snapToGrid: type === 'pixelart', gridVisible: type === 'pixelart' },
    };
    historyManager.pushState('Proyecto creado', project.layers);
    set({
      project,
      currentLayerId: baseLayer.id,
      zoom: 1,
      panX: 0,
      panY: 0,
      historyVersion: 0,
      canUndo: historyManager.canUndo(),
      canRedo: historyManager.canRedo(),
      selection: null,
    });
  },

  loadProjectData: (project) => {
    historyManager.clear();
    historyManager.pushState('Proyecto cargado', project.layers);
    set({
      project,
      currentLayerId: project.layers[0]?.id ?? null,
      historyVersion: 0,
      canUndo: historyManager.canUndo(),
      canRedo: historyManager.canRedo(),
      selection: null,
    });
  },

  setCurrentTool: (tool) => set({ currentTool: tool }),
  setPrimaryColor: (color) => set({ primaryColor: color }),
  setSecondaryColor: (color) => set({ secondaryColor: color }),
  swapColors: () => set((s) => ({ primaryColor: s.secondaryColor, secondaryColor: s.primaryColor })),

  setCurrentBrush: (brush) => set({ currentBrush: brush }),
  updateCurrentBrush: (patch) => set((s) => ({ currentBrush: { ...s.currentBrush, ...patch } })),
  addBrushToLibrary: (brush) => set((s) => ({ brushLibrary: [...s.brushLibrary, brush] })),
  removeBrushFromLibrary: (id) =>
    set((s) => ({ brushLibrary: s.brushLibrary.filter((b) => b.id !== id) })),

  addLayer: (name) => {
    const { project } = get();
    if (!project) return '';
    const layer = layerService.createLayer(name ?? `Capa ${project.layers.length + 1}`, project.width, project.height);
    const layers = [layer, ...project.layers];
    set({ project: { ...project, layers }, currentLayerId: layer.id });
    get().pushHistory('Nueva capa');
    return layer.id;
  },

  // Reference layers are a drawing aid (traced photo, pose reference, ...) — locked by
  // default since they're meant to be looked at, not painted on, and excluded from every
  // export/flatten path (see layerService.paintLayerOnto).
  addReferenceLayer: (name) => {
    const { project } = get();
    if (!project) return '';
    const layer = { ...layerService.createLayer(name ?? 'Referencia', project.width, project.height, 'reference' as const), locked: true };
    const layers = [layer, ...project.layers];
    set({ project: { ...project, layers }, currentLayerId: layer.id });
    get().pushHistory('Nueva capa de referencia');
    return layer.id;
  },

  deleteLayer: (id) => {
    const { project, currentLayerId } = get();
    if (!project || project.layers.length <= 1) return;
    layerService.deleteLayer(id);
    // Deleting a group ungroups its children rather than deleting them too.
    const layers = project.layers
      .filter((l) => l.id !== id)
      .map((l) => (l.parent === id ? { ...l, parent: undefined } : l));
    set({
      project: { ...project, layers },
      currentLayerId: currentLayerId === id ? layers[0]?.id ?? null : currentLayerId,
    });
    get().pushHistory('Eliminar capa');
  },

  duplicateLayer: (id) => {
    const { project } = get();
    if (!project) return;
    const original = project.layers.find((l) => l.id === id);
    if (!original) return;
    const copy = layerService.duplicateLayer(original);
    const index = project.layers.findIndex((l) => l.id === id);
    const layers = [...project.layers];
    layers.splice(index, 0, copy);

    // Groups take their descendants along, recursively, remapped onto the new subtree.
    if (original.type === 'group') {
      const idMap = new Map<string, string>([[original.id, copy.id]]);
      const descendants = project.layers.filter((l) => {
        let cursor: string | undefined = l.parent;
        while (cursor) {
          if (cursor === original.id) return true;
          cursor = project.layers.find((p) => p.id === cursor)?.parent;
        }
        return false;
      });
      let insertAt = index + 1;
      const newCopyIds = new Set<string>([copy.id]);
      for (const desc of descendants) {
        const descCopy = layerService.duplicateLayer(desc);
        idMap.set(desc.id, descCopy.id);
        newCopyIds.add(descCopy.id);
        layers.splice(insertAt, 0, descCopy);
        insertAt++;
      }
      // Only remap the freshly inserted copies' parent references — the originals must
      // keep pointing at the original group, or duplicating would steal their children.
      for (let i = 0; i < layers.length; i++) {
        if (newCopyIds.has(layers[i].id) && layers[i].parent && idMap.has(layers[i].parent!)) {
          layers[i] = { ...layers[i], parent: idMap.get(layers[i].parent!) };
        }
      }
    }

    set({ project: { ...project, layers }, currentLayerId: copy.id });
    get().pushHistory('Duplicar capa');
  },

  renameLayer: (id, name) => {
    const { project } = get();
    if (!project) return;
    set({
      project: { ...project, layers: project.layers.map((l) => (l.id === id ? { ...l, name } : l)) },
    });
    get().pushHistory('Renombrar capa');
  },

  setLayerOpacity: (id, opacity) => {
    const { project } = get();
    if (!project) return;
    set({
      project: { ...project, layers: project.layers.map((l) => (l.id === id ? { ...l, opacity } : l)) },
    });
  },

  // Opacity updates live on every slider tick (see setLayerOpacity above) — pushing history
  // there would flood the undo stack with one entry per pixel of drag. Call this once the
  // drag ends (e.g. on the slider's pointerup) to record a single undoable step.
  commitLayerOpacity: () => {
    const { project } = get();
    if (!project) return;
    get().pushHistory('Cambiar opacidad');
  },

  setLayerBlendMode: (id, blendMode) => {
    const { project } = get();
    if (!project) return;
    set({
      project: { ...project, layers: project.layers.map((l) => (l.id === id ? { ...l, blendMode } : l)) },
    });
    get().pushHistory('Cambiar modo de fusión');
  },

  setLayerVisibility: (id, visible) => {
    const { project } = get();
    if (!project) return;
    set({
      project: { ...project, layers: project.layers.map((l) => (l.id === id ? { ...l, visible } : l)) },
    });
    get().pushHistory(visible ? 'Mostrar capa' : 'Ocultar capa');
  },

  setLayerLocked: (id, locked) => {
    const { project } = get();
    if (!project) return;
    set({
      project: { ...project, layers: project.layers.map((l) => (l.id === id ? { ...l, locked } : l)) },
    });
    get().pushHistory(locked ? 'Bloquear capa' : 'Desbloquear capa');
  },

  reorderLayers: (layers) => {
    const { project } = get();
    if (!project) return;
    set({ project: { ...project, layers } });
    get().pushHistory('Reordenar capas');
  },

  selectLayer: (id) =>
    set((s) => ({ currentLayerId: id, maskEditLayerId: s.maskEditLayerId === id ? s.maskEditLayerId : null })),

  mergeLayerDown: (id) => {
    const { project } = get();
    if (!project) return;
    const index = project.layers.findIndex((l) => l.id === id);
    if (index === -1 || index === project.layers.length - 1) return;
    const top = project.layers[index];
    const base = project.layers[index + 1];
    if (top.type !== 'raster' || base.type !== 'raster' || top.parent !== base.parent) return;
    layerService.mergeDown(top, base);
    layerService.deleteLayer(top.id);
    const layers = project.layers.filter((l) => l.id !== top.id);
    set({ project: { ...project, layers }, currentLayerId: base.id });
    get().pushHistory('Combinar hacia abajo');
  },

  createGroup: (name) => {
    const { project } = get();
    if (!project) return '';
    const group = layerService.createGroupLayer(name ?? 'Grupo', project.width, project.height);
    const layers = [group, ...project.layers];
    set({ project: { ...project, layers }, currentLayerId: group.id });
    get().pushHistory('Nuevo grupo');
    return group.id;
  },

  setLayerParent: (id, parentId) => {
    const { project } = get();
    if (!project) return;
    if (id === parentId) return;
    // Guard against creating a cycle (moving a group into one of its own descendants).
    if (parentId) {
      let cursor: string | undefined = parentId;
      while (cursor) {
        if (cursor === id) return;
        cursor = project.layers.find((l) => l.id === cursor)?.parent;
      }
    }
    set({
      project: {
        ...project,
        layers: project.layers.map((l) => (l.id === id ? { ...l, parent: parentId ?? undefined } : l)),
      },
    });
    get().pushHistory('Mover capa');
  },

  addAdjustmentLayer: (adjustmentType) => {
    const { project } = get();
    if (!project) return '';
    const layer = layerService.createAdjustmentLayer(filterService.ADJUSTMENT_LABELS[adjustmentType], adjustmentType, project.width, project.height);
    const layers = [layer, ...project.layers];
    set({ project: { ...project, layers }, currentLayerId: layer.id });
    get().pushHistory('Nueva capa de ajuste');
    return layer.id;
  },

  setAdjustmentParams: (id, params) => {
    const { project } = get();
    if (!project) return;
    set({
      project: {
        ...project,
        layers: project.layers.map((l) => (l.id === id ? { ...l, adjustmentParams: params } : l)),
      },
    });
  },

  // Sliders update live via setAdjustmentParams above; call this once the drag ends
  // (same pattern as commitLayerOpacity) to record a single undoable step.
  commitAdjustmentParams: () => {
    const { project } = get();
    if (!project) return;
    get().pushHistory('Ajustar capa');
  },

  addFillLayer: (fillType) => {
    const { project } = get();
    if (!project) return '';
    const names: Record<FillType, string> = { solid: 'Color sólido', gradient: 'Degradado', pattern: 'Patrón' };
    const layer = layerService.createFillLayer(names[fillType], fillType, project.width, project.height);
    const layers = [layer, ...project.layers];
    set({ project: { ...project, layers }, currentLayerId: layer.id });
    get().pushHistory('Nueva capa de relleno');
    return layer.id;
  },

  setFillType: (id, fillType) => {
    const { project } = get();
    if (!project) return;
    set({
      project: {
        ...project,
        layers: project.layers.map((l) =>
          l.id === id
            ? {
                ...l,
                fillType,
                gradient: fillType === 'gradient' ? (l.gradient ?? { kind: 'linear', color1: '#000000', color2: '#ffffff', angle: 0 }) : l.gradient,
                patternId: fillType === 'pattern' ? (l.patternId ?? 'lines-diagonal') : l.patternId,
              }
            : l
        ),
      },
    });
    get().pushHistory('Cambiar tipo de relleno');
  },

  setFillProps: (id, patch) => {
    const { project } = get();
    if (!project) return;
    set({
      project: {
        ...project,
        layers: project.layers.map((l) => (l.id === id ? { ...l, ...patch } : l)),
      },
    });
  },

  // Live-updating inputs (gradient angle slider, color pickers) call setFillProps above;
  // call this once the edit settles to record a single undoable step.
  commitFillProps: () => {
    const { project } = get();
    if (!project) return;
    get().pushHistory('Editar relleno');
  },

  addMaskToLayer: (id) => {
    const { project } = get();
    if (!project) return;
    const layer = project.layers.find((l) => l.id === id);
    if (!layer || layer.type === 'group') return;
    layerService.addMask(id, layer.width, layer.height);
    set({
      project: { ...project, layers: project.layers.map((l) => (l.id === id ? { ...l, hasMask: true } : l)) },
    });
    get().pushHistory('Añadir máscara');
  },

  removeMaskFromLayer: (id) => {
    const { project, maskEditLayerId } = get();
    if (!project) return;
    layerService.removeMask(id);
    set({
      project: { ...project, layers: project.layers.map((l) => (l.id === id ? { ...l, hasMask: false } : l)) },
      maskEditLayerId: maskEditLayerId === id ? null : maskEditLayerId,
    });
    get().pushHistory('Eliminar máscara');
  },

  setMaskEditLayerId: (id) => set({ maskEditLayerId: id }),

  setZoom: (zoom) => set({ zoom }),
  setPan: (panX, panY) => set({ panX, panY }),
  setIsDrawing: (isDrawing) => set({ isDrawing }),

  setSelection: (rect) => set({ selection: rect }),

  clearSelectionArea: () => {
    const { project, currentLayerId, selection } = get();
    if (!project || !currentLayerId || !selection) return;
    const layer = project.layers.find((l) => l.id === currentLayerId);
    if (!layer || layer.locked) return;
    const canvas = layerService.getLayerCanvas(currentLayerId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(selection.x, selection.y, selection.w, selection.h);
    get().pushHistory('Eliminar selección');
  },

  // Display-only setting — deliberately not pushed to undo history (same reasoning as pan/zoom).
  toggleGrid: () => {
    const { project } = get();
    if (!project) return;
    set({ project: { ...project, settings: { ...project.settings, gridVisible: !project.settings.gridVisible } } });
  },

  // Content-aware (seam-carve) resize is destructive by nature — a seam path threads
  // through every layer differently, so there's no sound way to keep the layer stack
  // intact. The caller (ResizeDialog) does the actual carving asynchronously with
  // progress/cancel; this just commits the already-computed result(s) atomically, one
  // flattened raster layer per animation frame (or a single one if animation is off).
  finishContentAwareResize: (newWidth, newHeight, resizedFrames) => {
    const { project } = get();
    if (!project || resizedFrames.length === 0) return;

    function replaceLayers(layers: Layer[], canvas: HTMLCanvasElement): Layer[] {
      layers.forEach((l) => layerService.deleteLayer(l.id));
      const newLayer = layerService.createLayer('Fondo', newWidth, newHeight, 'raster');
      layerService.getLayerCanvas(newLayer.id)!.getContext('2d')!.drawImage(canvas, 0, 0);
      return [newLayer];
    }

    if (!project.animation) {
      const layers = replaceLayers(project.layers, resizedFrames[0]);
      set({ project: { ...project, width: newWidth, height: newHeight, layers }, currentLayerId: layers[0].id, selection: null });
    } else {
      const anim = project.animation;
      const frames = anim.frames.map((f, i) => {
        const sourceLayers = i === anim.currentFrameIndex ? project.layers : f.layers;
        return { ...f, layers: replaceLayers(sourceLayers, resizedFrames[i] ?? resizedFrames[0]) };
      });
      const activeLayers = frames[anim.currentFrameIndex].layers;
      set({
        project: { ...project, width: newWidth, height: newHeight, layers: activeLayers, animation: { ...anim, frames } },
        currentLayerId: activeLayers[0].id,
        selection: null,
      });
    }
    get().pushHistory('Redimensionar (inteligente)');
  },

  // --- Animation: the active frame's layers ARE `project.layers` — every existing tool,
  // panel and filter keeps working unmodified for whichever frame is currently loaded.
  // Other frames' layers stay resident (with live canvases) in `project.animation.frames`.

  enableAnimation: () => {
    const { project } = get();
    if (!project || project.animation) return;
    const frame: AnimationFrame = { id: uuid(), durationMs: 100, layers: project.layers };
    set({ project: { ...project, animation: { frames: [frame], currentFrameIndex: 0, fps: 10, loop: true } } });
    get().pushHistory('Activar animación');
  },

  addFrame: (mode) => {
    const { project } = get();
    if (!project) return;
    get().enableAnimation();
    const p = get().project!;
    const anim = p.animation!;

    const newLayers =
      mode === 'duplicate' ? duplicateLayerSet(p.layers) : [layerService.createLayer('Capa 1', p.width, p.height)];
    const newFrame: AnimationFrame = { id: uuid(), durationMs: anim.frames[anim.currentFrameIndex]?.durationMs ?? 100, layers: newLayers };

    const frames = [...anim.frames];
    frames[anim.currentFrameIndex] = { ...frames[anim.currentFrameIndex], layers: p.layers };
    const insertAt = anim.currentFrameIndex + 1;
    frames.splice(insertAt, 0, newFrame);

    set({
      project: { ...p, layers: newLayers, animation: { ...anim, frames, currentFrameIndex: insertAt } },
      currentLayerId: newLayers[0]?.id ?? null,
      selection: null,
    });
    get().pushHistory(mode === 'duplicate' ? 'Duplicar frame' : 'Nuevo frame');
  },

  // Bakes classic palette-cycling into real, playable/exportable animation frames — reuses
  // the exact same frame/timeline/GIF machinery as manual animation instead of a throwaway
  // live preview. Frame 0 stays the current frame (shift 0); each inserted frame after it
  // is a full layer-set copy with cycleColors applied at an increasing shift, so scrubbing
  // or playing the timeline shows the palette rotating through `rangeColors`.
  generateColorCycleFrames: (rangeColors, steps, frameDurationMs) => {
    const { project } = get();
    if (!project || rangeColors.length < 2 || steps < 2) return;
    get().enableAnimation();
    const p = get().project!;
    const anim = p.animation!;

    const frames = [...anim.frames];
    frames[anim.currentFrameIndex] = { ...frames[anim.currentFrameIndex], layers: p.layers, durationMs: frameDurationMs };

    let insertAt = anim.currentFrameIndex + 1;
    for (let step = 1; step < steps; step++) {
      const newLayers = duplicateLayerSet(p.layers);
      newLayers.forEach((l) => {
        if (l.type !== 'raster') return;
        const canvas = layerService.getLayerCanvas(l.id);
        if (canvas) filterService.cycleColors(canvas, rangeColors, step);
      });
      frames.splice(insertAt, 0, { id: uuid(), durationMs: frameDurationMs, layers: newLayers });
      insertAt++;
    }

    set({ project: { ...p, animation: { ...anim, frames } } });
    get().pushHistory('Ciclado de color');
  },

  // Imports pre-rendered canvases (from an APNG's decoded frames) as real animation frames,
  // inserted right after the current one — same insertion pattern as generateColorCycleFrames,
  // just drawing the given bitmap onto a fresh layer instead of computing one from a filter.
  importAnimationFrames: (frames) => {
    const { project } = get();
    if (!project || frames.length === 0) return;
    get().enableAnimation();
    const p = get().project!;
    const anim = p.animation!;

    const newAnimFrames: AnimationFrame[] = frames.map((f) => {
      const layer = layerService.createLayer('Capa 1', p.width, p.height, 'raster');
      layerService.getLayerCanvas(layer.id)!.getContext('2d')!.drawImage(f.canvas, 0, 0, p.width, p.height);
      return { id: uuid(), durationMs: f.delayMs, layers: [layer] };
    });

    const insertAt = anim.currentFrameIndex + 1;
    const framesArr = [...anim.frames];
    framesArr.splice(insertAt, 0, ...newAnimFrames);
    set({ project: { ...p, animation: { ...anim, frames: framesArr } } });
    get().pushHistory('Importar animación');
  },

  deleteFrame: (index) => {
    const { project } = get();
    if (!project?.animation || project.animation.frames.length <= 1) return;
    const anim = project.animation;
    const target = index === anim.currentFrameIndex ? project.layers : anim.frames[index].layers;
    target.forEach((l) => layerService.deleteLayer(l.id));

    const frames = anim.frames.filter((_, i) => i !== index);
    let currentFrameIndex = anim.currentFrameIndex;
    let layers = project.layers;
    let currentLayerId = get().currentLayerId;

    if (index === anim.currentFrameIndex) {
      currentFrameIndex = Math.min(index, frames.length - 1);
      layers = frames[currentFrameIndex].layers;
      currentLayerId = layers[0]?.id ?? null;
    } else if (index < anim.currentFrameIndex) {
      currentFrameIndex = anim.currentFrameIndex - 1;
    }

    set({ project: { ...project, layers, animation: { ...anim, frames, currentFrameIndex } }, currentLayerId, selection: null });
    get().pushHistory('Eliminar frame');
  },

  // Pure navigation — deliberately not pushed to history, so scrubbing/playing frames
  // doesn't flood the undo stack (edits within a frame still push normally).
  selectFrame: (index) => {
    const { project } = get();
    if (!project?.animation) return;
    const anim = project.animation;
    if (index < 0 || index >= anim.frames.length || index === anim.currentFrameIndex) return;

    const frames = [...anim.frames];
    frames[anim.currentFrameIndex] = { ...frames[anim.currentFrameIndex], layers: project.layers };
    const target = frames[index];

    set({
      project: { ...project, layers: target.layers, animation: { ...anim, frames, currentFrameIndex: index } },
      currentLayerId: target.layers[0]?.id ?? null,
      selection: null,
      maskEditLayerId: null,
    });
  },

  reorderFrames: (frames) => {
    const { project } = get();
    if (!project?.animation) return;
    const currentId = project.animation.frames[project.animation.currentFrameIndex].id;
    const currentFrameIndex = Math.max(0, frames.findIndex((f) => f.id === currentId));
    set({ project: { ...project, animation: { ...project.animation, frames, currentFrameIndex } } });
    get().pushHistory('Reordenar frames');
  },

  setFrameDuration: (index, ms) => {
    const { project } = get();
    if (!project?.animation) return;
    const anim = project.animation;
    const frames = anim.frames.map((f, i) => (i === index ? { ...f, durationMs: Math.max(20, ms) } : f));
    set({ project: { ...project, animation: { ...anim, frames } } });
  },

  setAnimationFps: (fps) => {
    const { project } = get();
    if (!project?.animation) return;
    set({ project: { ...project, animation: { ...project.animation, fps: Math.max(1, Math.min(60, fps)) } } });
  },

  setAnimationLoop: (loop) => {
    const { project } = get();
    if (!project?.animation) return;
    set({ project: { ...project, animation: { ...project.animation, loop } } });
  },

  toggleOnionSkin: () => set((s) => ({ onionSkinEnabled: !s.onionSkinEnabled })),

  pushHistory: (action) => {
    const { project } = get();
    if (!project) return;
    historyManager.pushState(action, project.layers, project.animation);
    set((s) => ({
      historyVersion: s.historyVersion + 1,
      canUndo: historyManager.canUndo(),
      canRedo: historyManager.canRedo(),
    }));
  },

  undo: async () => {
    const snapshot = await historyManager.undo();
    if (!snapshot || !get().project) return;
    set((s) => ({
      project: s.project ? { ...s.project, layers: snapshot.layers, animation: snapshot.animation } : s.project,
      // Keep the current selection if that layer still exists post-undo (e.g. undoing a
      // brush stroke on the layer you're still on); otherwise fall back to the top layer
      // rather than pointing at an id that just got removed (undoing a "new layer").
      currentLayerId: snapshot.layers.some((l) => l.id === s.currentLayerId) ? s.currentLayerId : (snapshot.layers[0]?.id ?? null),
      historyVersion: s.historyVersion + 1,
      canUndo: historyManager.canUndo(),
      canRedo: historyManager.canRedo(),
    }));
  },

  redo: async () => {
    const snapshot = await historyManager.redo();
    if (!snapshot || !get().project) return;
    set((s) => ({
      project: s.project ? { ...s.project, layers: snapshot.layers, animation: snapshot.animation } : s.project,
      currentLayerId: snapshot.layers.some((l) => l.id === s.currentLayerId) ? s.currentLayerId : (snapshot.layers[0]?.id ?? null),
      historyVersion: s.historyVersion + 1,
      canUndo: historyManager.canUndo(),
      canRedo: historyManager.canRedo(),
    }));
  },
}));

/**
 * Layers for any animation frame by index — the active frame's real state lives in
 * `project.layers`, not `animation.frames[currentFrameIndex].layers` (which only gets
 * synced back in on switch-away), so reads must special-case it.
 */
export function getFrameLayers(project: Project, index: number): Layer[] {
  if (!project.animation) return project.layers;
  if (index === project.animation.currentFrameIndex) return project.layers;
  return project.animation.frames[index]?.layers ?? [];
}

export function createNewBrushFromCurrent(name: string): Brush {
  const { currentBrush } = useAppStore.getState();
  const { id: _id, ...rest } = currentBrush;
  return makeBrush({ ...rest, name });
}
