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
  LayerEffects,
  LayerComp,
  LayerCompState,
} from '@/types';
import { captureReplayFrame } from '@/services/replay.service';
import * as layerService from '@/services/layer.service';
import { renderVectorLayer } from '@/services/vectorLayer.service';
import * as filterService from '@/services/filter.service';
import { withAlphaLock } from '@/services/canvas.service';
import { loadPresets, createBrush as makeBrush } from '@/services/brush.service';
import { HistoryManager } from '@/services/history.service';
import { DEFAULT_DPI } from '@/utils/constants';
import { OnionSkinSettings, DEFAULT_ONION_SKIN_SETTINGS, TweenEasing } from '@/types/animation';
import { blendCanvases } from '@/services/frameInterpolation.service';
import {
  maskToBoundingBox,
  applyMaskedOperation,
  rectToMask,
  invertMask,
  featherMask,
  expandMask,
  contractMask,
  colorRangeMask,
} from '@/services/selectionMask.service';
import { hexToRgba } from '@/utils/colorUtils';
import { cropCanvas, canvasToDataUrl } from '@/utils/canvasUtils';
import { isElectron } from '@/utils/fileUtils';

export const historyManager = new HistoryManager();

/** The layer visibility snapshot from right before entering "isolate" mode — plain module
 * state (not Zustand) since nothing needs to react to it directly, same as `historyManager`. */
let preIsolateVisibility: Record<string, boolean> | null = null;

/** Shared crop+mask logic behind both copySelection (from the active layer) and copyMerged
 * (from the flattened composite) — the only difference between them is which canvas this is
 * called with. Cuts to the exact (possibly non-rectangular) selection shape when a mask is
 * present, same `destination-in` trick used everywhere else a selection mask needs applying. */
function cropToClipboard(
  source: HTMLCanvasElement,
  selection: SelectionRect | null,
  selectionMask: HTMLCanvasElement | null
): { cropped: HTMLCanvasElement; origin: { x: number; y: number } } {
  const rect = selection ?? { x: 0, y: 0, w: source.width, h: source.height };
  const cropped = cropCanvas(source, rect.x, rect.y, rect.w, rect.h);
  if (selectionMask) {
    const maskCropped = cropCanvas(selectionMask, rect.x, rect.y, rect.w, rect.h);
    const ctx = cropped.getContext('2d')!;
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(maskCropped, 0, 0);
  }
  return { cropped, origin: { x: rect.x, y: rect.y } };
}

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
  /** View-only rotation in degrees, around the canvas's own center — like zoom/pan, not
   * part of the saved project, purely how it's currently being looked at. */
  canvasRotation: number;
  /** View-only horizontal mirror — like zoom/pan/rotation, purely how the canvas is currently
   * being looked at, not a pixel edit. Lets an artist spot proportion/symmetry mistakes without
   * touching the actual layer content the way `flipHorizontal` (canvas.service) does. */
  viewFlippedH: boolean;
  isDrawing: boolean;
  historyVersion: number;
  canUndo: boolean;
  canRedo: boolean;
  selection: SelectionRect | null;
  /** The precise shape behind `selection` when it came from lasso/wand/color-range/a modifier
   * (invert, feather, expand, contract) instead of a plain drag-rectangle. `selection` is
   * always kept as this mask's bounding box so existing rect-only consumers keep working;
   * paint bucket and "delete selection" additionally respect the exact mask when present. */
  selectionMask: HTMLCanvasElement | null;
  /** Copy/cut/paste clipboard — a cropped snapshot of the copied region plus where it was
   * copied from, so "paste" can drop it back at the same spot by default. In-memory only
   * (not part of the saved project), matching `selectionMask`'s own non-persisted nature. */
  clipboardCanvas: HTMLCanvasElement | null;
  clipboardOrigin: { x: number; y: number } | null;
  maskEditLayerId: string | null;
  onionSkinEnabled: boolean;

  newProject: (opts: { name: string; type: ProjectType; width: number; height: number; dpi?: number }) => void;
  loadProjectData: (project: Project) => void;

  setCurrentTool: (tool: ToolType) => void;
  setPrimaryColor: (color: string) => void;
  setSecondaryColor: (color: string) => void;
  swapColors: () => void;
  /** Photoshop's "D" — resets to the default black-on-white, distinct from "X" (swapColors). */
  resetColors: () => void;

  setCurrentBrush: (brush: Brush) => void;
  updateCurrentBrush: (patch: Partial<Brush>) => void;
  addBrushToLibrary: (brush: Brush) => void;
  removeBrushFromLibrary: (id: string) => void;
  updateBrushInLibrary: (id: string, patch: Partial<Brush>) => void;

  addLayer: (name?: string) => string;
  addReferenceLayer: (name?: string) => string;
  deleteLayer: (id: string) => void;
  duplicateLayer: (id: string) => void;
  renameLayer: (id: string, name: string) => void;
  setLayerOpacity: (id: string, opacity: number) => void;
  commitLayerOpacity: () => void;
  setLayerBlendMode: (id: string, blendMode: GlobalCompositeOperation) => void;
  setLayerVisibility: (id: string, visible: boolean) => void;
  /** Alt+click on the eye icon — Photoshop's "solo" convention: hides every other layer to
   * show just this one, remembering the prior visibility so the same gesture on the same
   * layer restores it. Not pushed to history, same as toggleGrid/canvasRotation/etc — a
   * viewing aid, not a content edit. */
  isolatedLayerId: string | null;
  toggleIsolateLayer: (id: string) => void;
  setLayerLocked: (id: string, locked: boolean) => void;
  setLayerAlphaLock: (id: string, lockAlpha: boolean) => void;
  reorderLayers: (layers: Layer[]) => void;
  selectLayer: (id: string) => void;
  mergeLayerDown: (id: string) => void;
  mergeVisibleLayers: () => void;
  /** Collapses EVERY layer — visible or hidden, at any nesting depth — into one raster layer,
   * discarding whatever was hidden entirely. Distinct from `mergeVisibleLayers`, which leaves
   * hidden layers untouched. Returns false when there's nothing meaningful to flatten. */
  flattenImage: () => boolean;
  /** Crops the whole canvas (every layer, in every animation frame) down to the smallest
   * rectangle containing any non-transparent pixel. Returns false (no-op) when the canvas
   * is empty or already tight to its content. */
  trimToContent: () => boolean;

  createGroup: (name?: string) => string;
  setLayerParent: (id: string, parentId: string | null) => void;

  addAdjustmentLayer: (adjustmentType: AdjustmentType) => string;
  setAdjustmentParams: (id: string, params: Record<string, number>) => void;
  commitAdjustmentParams: () => void;

  addFillLayer: (fillType: FillType) => string;
  /** Vector layers: objects stay editable; the layer's pixels are re-rendered from them. */
  addVectorLayer: () => string;
  /** Replaces a vector layer's objects and re-renders it; `historyLabel` null skips the undo step (drags). */
  setVectorObjects: (layerId: string, objects: import('@/types/layer.types').VectorObject[], historyLabel?: string | null) => void;
  /** Adds an object to the current layer when it is a vector layer. Returns false otherwise. */
  addVectorObject: (obj: import('@/types/layer.types').VectorObject, historyLabel?: string) => boolean;
  rasterizeVectorLayer: (layerId: string) => void;
  setFillType: (id: string, fillType: FillType) => void;
  setFillProps: (id: string, patch: Partial<Pick<Layer, 'fillColor' | 'gradient' | 'patternId' | 'patternColor'>>) => void;
  commitFillProps: () => void;

  addMaskToLayer: (id: string) => void;
  removeMaskFromLayer: (id: string) => void;
  setMaskEditLayerId: (id: string | null) => void;
  featherLayerMask: (id: string, radius: number) => void;
  invertLayerMask: (id: string) => void;
  invertLayerColors: (id: string) => void;
  desaturateLayerColors: (id: string) => void;

  setLayerEffects: (id: string, effects: LayerEffects) => void;
  commitLayerEffects: () => void;
  setLayerClipTo: (id: string, clipTo: boolean) => void;
  createLinkedInstance: (id: string) => void;

  selectedLayerIds: string[];
  toggleLayerSelection: (id: string, additive: boolean) => void;
  clearLayerSelection: () => void;
  groupSelectedLayers: (name?: string) => void;
  ungroupLayer: (id: string) => void;
  setSelectedLayersVisibility: (visible: boolean) => void;
  setSelectedLayersLocked: (locked: boolean) => void;

  captureLayerComp: (name: string) => void;
  applyLayerComp: (id: string) => void;
  deleteLayerComp: (id: string) => void;

  setZoom: (zoom: number) => void;
  setPan: (x: number, y: number) => void;
  setCanvasRotation: (deg: number) => void;
  toggleViewFlip: () => void;
  setIsDrawing: (drawing: boolean) => void;

  setSelection: (rect: SelectionRect | null) => void;
  selectAll: () => void;
  deselectAll: () => void;
  setSelectionMask: (mask: HTMLCanvasElement | null) => void;
  invertSelection: () => void;
  featherSelection: (radius: number) => void;
  expandSelection: (amount: number) => void;
  contractSelection: (amount: number) => void;
  selectColorRange: (hexColor: string, tolerance: number) => void;
  clearSelectionArea: () => void;
  /** Fills the selection (or, with no active selection, the whole current layer) with a
   * solid color — Photoshop's Alt+Backspace/Ctrl+Backspace convention. */
  fillSelection: (color: string) => void;

  /** Copies the selection's pixels (or, with no active selection, the whole current layer)
   * into `clipboardCanvas`. Read-only — doesn't touch history. */
  copySelection: () => void;
  copyMerged: () => void;
  /** Same as `copySelection`, then clears the copied region from the layer. */
  cutSelection: () => void;
  /** Drops `clipboardCanvas` into a new layer at the position it was copied from. */
  pasteAsLayer: () => void;

  setTransparentBg: (v: boolean) => void;
  setBackgroundColor: (color: string) => void;

  toggleGrid: () => void;
  setGridSize: (size: number) => void;
  toggleRulerVisible: () => void;
  updatePerspectiveData: (data: import('@/types/perspective').PerspectiveProjectData) => void;
  updateStudyGuides: (guides: import('@/services/studyGuides.service').StudyGuide[]) => void;
  updateProjectReferences: (refs: import('@/types/references').ReferenceImage[]) => void;
  updateProjectPalettes: (palettes: import('@/types/assetLibrary').LibraryPalette[]) => void;
  finishContentAwareResize: (newWidth: number, newHeight: number, resizedFrames: HTMLCanvasElement[]) => void;

  enableAnimation: () => void;
  addFrame: (mode: 'duplicate' | 'blank') => void;
  generateColorCycleFrames: (rangeColors: filterService.RGB[], steps: number, frameDurationMs: number) => void;
  generateInbetweenFrames: (count: number, easing: TweenEasing) => void;
  importAnimationFrames: (frames: { canvas: HTMLCanvasElement; delayMs: number }[]) => void;
  deleteFrame: (index: number) => void;
  selectFrame: (index: number) => void;
  reorderFrames: (frames: AnimationFrame[]) => void;
  setFrameDuration: (index: number, ms: number) => void;
  setAnimationFps: (fps: number) => void;
  setAnimationLoop: (loop: boolean) => void;
  toggleOnionSkin: () => void;
  onionSkinSettings: OnionSkinSettings;
  setOnionSkinSettings: (patch: Partial<OnionSkinSettings>) => void;
  magicWandTolerance: number;
  setMagicWandTolerance: (tolerance: number) => void;
  /** Eyedropper (and Alt+click) sample size in pixels — 1 for the exact pixel, 3/5 for an
   * NxN average centered on the click, useful on textured or anti-aliased art. */
  eyedropperSampleSize: 1 | 3 | 5;
  setEyedropperSampleSize: (size: 1 | 3 | 5) => void;
  /** When true, the eyedropper (and Alt+click) samples the flattened, visible composite
   * instead of just the active layer — for picking the color you actually SEE when it sits
   * under other layers, rather than whatever (possibly transparent) pixel is on the active one. */
  eyedropperSampleAllLayers: boolean;
  setEyedropperSampleAllLayers: (v: boolean) => void;
  /** Linear (axis-to-axis) or radial (center-to-edge) mode for the Gradient tool. */
  gradientToolMode: 'linear' | 'radial';
  setGradientToolMode: (mode: 'linear' | 'radial') => void;

  pushHistory: (action: string) => void;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
  jumpToHistory: (index: number) => Promise<void>;
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
  canvasRotation: 0,
  viewFlippedH: false,
  isDrawing: false,
  historyVersion: 0,
  canUndo: false,
  canRedo: false,
  selection: null,
  selectionMask: null,
  clipboardCanvas: null,
  clipboardOrigin: null,
  maskEditLayerId: null,
  onionSkinEnabled: false,
  onionSkinSettings: DEFAULT_ONION_SKIN_SETTINGS,
  magicWandTolerance: 32,
  eyedropperSampleSize: 1,
  eyedropperSampleAllLayers: false,
  gradientToolMode: 'linear',
  selectedLayerIds: [],
  isolatedLayerId: null,

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
      settings: {
        ...DEFAULT_PROJECT_SETTINGS,
        snapToGrid: type === 'pixelart',
        gridVisible: type === 'pixelart',
        // A per-pixel grid is what "pixel grid overlay" means for pixel-art work (Aseprite,
        // Piskel) — the general 32px default is for a coarser compositional/layout grid.
        gridSize: type === 'pixelart' ? 1 : DEFAULT_PROJECT_SETTINGS.gridSize,
      },
    };
    historyManager.pushState('Proyecto creado', project.layers);
    captureReplayFrame(project, 'Proyecto creado');
    set({
      project,
      currentLayerId: baseLayer.id,
      // Cómic arranca directo en la pluma vectorial (entintado limpio) en vez del pincel
      // genérico — el resto sigue con pincel, que es el punto de partida más neutro.
      currentTool: type === 'comic' ? 'pen' : 'brush',
      zoom: 1,
      panX: 0,
      panY: 0,
      canvasRotation: 0,
      viewFlippedH: false,
      historyVersion: 0,
      canUndo: historyManager.canUndo(),
      canRedo: historyManager.canRedo(),
      selection: null,
      selectionMask: null,
      isolatedLayerId: null,
    });
    preIsolateVisibility = null;
  },

  loadProjectData: (project) => {
    historyManager.clear();
    preIsolateVisibility = null;
    historyManager.pushState('Proyecto cargado', project.layers);
    captureReplayFrame(project, 'Proyecto cargado');
    set({
      project,
      currentLayerId: project.layers[0]?.id ?? null,
      historyVersion: 0,
      canUndo: historyManager.canUndo(),
      canRedo: historyManager.canRedo(),
      selection: null,
      selectionMask: null,
      isolatedLayerId: null,
    });
  },

  setCurrentTool: (tool) => set({ currentTool: tool }),
  setPrimaryColor: (color) => set({ primaryColor: color }),
  setSecondaryColor: (color) => set({ secondaryColor: color }),
  swapColors: () => set((s) => ({ primaryColor: s.secondaryColor, secondaryColor: s.primaryColor })),
  resetColors: () => set({ primaryColor: '#000000', secondaryColor: '#ffffff' }),

  setCurrentBrush: (brush) => set({ currentBrush: brush }),
  updateCurrentBrush: (patch) => set((s) => ({ currentBrush: { ...s.currentBrush, ...patch } })),
  addBrushToLibrary: (brush) => set((s) => ({ brushLibrary: [...s.brushLibrary, brush] })),
  removeBrushFromLibrary: (id) =>
    set((s) => ({ brushLibrary: s.brushLibrary.filter((b) => b.id !== id) })),
  updateBrushInLibrary: (id, patch) =>
    set((s) => ({ brushLibrary: s.brushLibrary.map((b) => (b.id === id ? { ...b, ...patch } : b)) })),

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

  toggleIsolateLayer: (id) => {
    const { project, isolatedLayerId } = get();
    if (!project) return;

    if (isolatedLayerId === id && preIsolateVisibility) {
      // Same layer, Alt+clicked again — restore what visibility looked like before isolating.
      const snapshot = preIsolateVisibility;
      const layers = project.layers.map((l) => ({ ...l, visible: snapshot[l.id] ?? l.visible }));
      preIsolateVisibility = null;
      set({ project: { ...project, layers }, isolatedLayerId: null });
      return;
    }

    // Either nothing was isolated yet, or a DIFFERENT layer was — keep the ORIGINAL snapshot
    // if one's already pending (so hopping between layers while isolating still restores the
    // true starting state, not whatever the previously-isolated single layer looked like).
    const snapshot = preIsolateVisibility ?? Object.fromEntries(project.layers.map((l) => [l.id, l.visible]));
    preIsolateVisibility = snapshot;
    const layers = project.layers.map((l) => ({ ...l, visible: l.id === id }));
    set({ project: { ...project, layers }, isolatedLayerId: id });
  },

  setLayerLocked: (id, locked) => {
    const { project } = get();
    if (!project) return;
    set({
      project: { ...project, layers: project.layers.map((l) => (l.id === id ? { ...l, locked } : l)) },
    });
    get().pushHistory(locked ? 'Bloquear capa' : 'Desbloquear capa');
  },

  setLayerAlphaLock: (id, lockAlpha) => {
    const { project } = get();
    if (!project) return;
    set({
      project: { ...project, layers: project.layers.map((l) => (l.id === id ? { ...l, lockAlpha } : l)) },
    });
    get().pushHistory(lockAlpha ? 'Bloquear transparencia' : 'Desbloquear transparencia');
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

  // Flattens every currently-visible layer (raster/fill/adjustment/group, at any nesting
  // depth) into one new raster layer, replacing them in place — hidden layers are left
  // completely untouched. Only acts on TOP-LEVEL visibility: a visible group's hidden
  // children collapse along with it (same as Photoshop, which doesn't preserve per-child
  // visibility once its parent group has been merged away either).
  mergeVisibleLayers: () => {
    const { project } = get();
    if (!project) return;
    const topLevel = project.layers.filter((l) => !l.parent);
    const visibleTop = topLevel.filter((l) => l.visible);
    if (visibleTop.length < 2) return;

    const merged = layerService.flattenLayers(project.layers, project.width, project.height);

    const removeIds = new Set<string>();
    for (const root of visibleTop) {
      removeIds.add(root.id);
      project.layers.forEach((l) => {
        let cursor: string | undefined = l.parent;
        while (cursor) {
          if (cursor === root.id) {
            removeIds.add(l.id);
            break;
          }
          cursor = project.layers.find((p) => p.id === cursor)?.parent;
        }
      });
    }

    const topmostIndex = project.layers.findIndex((l) => l.id === visibleTop[0].id);
    const survivingAbove = project.layers.slice(0, topmostIndex).filter((l) => !removeIds.has(l.id)).length;

    removeIds.forEach((id) => layerService.deleteLayer(id));
    const newLayer = layerService.createLayer('Combinado', project.width, project.height);
    layerService.getLayerCanvas(newLayer.id)!.getContext('2d')!.drawImage(merged, 0, 0);

    const remaining = project.layers.filter((l) => !removeIds.has(l.id));
    remaining.splice(survivingAbove, 0, newLayer);

    set({ project: { ...project, layers: remaining }, currentLayerId: newLayer.id, selectedLayerIds: [] });
    get().pushHistory('Combinar visibles');
  },

  // Unlike mergeVisibleLayers, this discards hidden layers entirely rather than preserving
  // them — the whole layer stack (visible and hidden, any nesting depth) becomes one raster
  // layer. Alpha is kept as-is (no forced white/background fill), so it stays reversible via
  // Ctrl+Z and doesn't surprise anyone still relying on transparency after flattening.
  flattenImage: () => {
    const { project } = get();
    if (!project || project.layers.length <= 1) return false;

    const merged = layerService.flattenLayers(project.layers, project.width, project.height);
    project.layers.forEach((l) => layerService.deleteLayer(l.id));
    const newLayer = layerService.createLayer('Fondo', project.width, project.height);
    layerService.getLayerCanvas(newLayer.id)!.getContext('2d')!.drawImage(merged, 0, 0);

    set({ project: { ...project, layers: [newLayer] }, currentLayerId: newLayer.id, selectedLayerIds: [] });
    get().pushHistory('Aplanar imagen');
    return true;
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

  addVectorLayer: () => {
    const { project } = get();
    if (!project) return '';
    const layer = { ...layerService.createLayer('Vectorial', project.width, project.height, 'vector' as const), vectorObjects: [] };
    set({ project: { ...project, layers: [layer, ...project.layers] }, currentLayerId: layer.id });
    get().pushHistory('Nueva capa vectorial');
    return layer.id;
  },

  setVectorObjects: (layerId, objects, historyLabel = 'Editar objeto vectorial') => {
    const { project } = get();
    if (!project) return;
    const canvas = layerService.getLayerCanvas(layerId);
    if (canvas) renderVectorLayer(canvas, objects);
    set({ project: { ...project, layers: project.layers.map((l) => (l.id === layerId ? { ...l, vectorObjects: objects } : l)) } });
    if (historyLabel) get().pushHistory(historyLabel);
  },

  addVectorObject: (obj, historyLabel = 'Objeto vectorial') => {
    const { project, currentLayerId } = get();
    const layer = project?.layers.find((l) => l.id === currentLayerId);
    if (!layer || layer.type !== 'vector' || layer.locked) return false;
    get().setVectorObjects(layer.id, [...(layer.vectorObjects ?? []), obj], historyLabel);
    return true;
  },

  rasterizeVectorLayer: (layerId) => {
    const { project } = get();
    if (!project) return;
    set({ project: { ...project, layers: project.layers.map((l) => (l.id === layerId ? { ...l, type: 'raster' as const, vectorObjects: undefined } : l)) } });
    get().pushHistory('Rasterizar capa vectorial');
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
    const { project, selection, selectionMask } = get();
    if (!project) return;
    const layer = project.layers.find((l) => l.id === id);
    if (!layer || layer.type === 'group') return;
    // Seed the mask from the active selection when there is one, instead of always starting
    // fully blank-white — matches what an artist expects "add mask" to do with a selection up.
    if (selectionMask) {
      layerService.addMaskFromAlpha(id, selectionMask, layer.width, layer.height);
    } else if (selection) {
      layerService.addMaskFromAlpha(id, rectToMask(selection, layer.width, layer.height), layer.width, layer.height);
    } else {
      layerService.addMask(id, layer.width, layer.height);
    }
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

  featherLayerMask: (id, radius) => {
    layerService.featherLayerMask(id, radius);
    get().pushHistory('Difuminar máscara');
  },

  invertLayerMask: (id) => {
    layerService.invertLayerMask(id);
    get().pushHistory('Invertir máscara');
  },

  // Destructive, one-shot color inversion of the layer's own pixels — Photoshop's Ctrl+I.
  // Distinct from the 'invert' ADJUSTMENT layer type, which is non-destructive but heavier
  // (adds a whole new layer to the stack); this is for "just flip it, right now".
  invertLayerColors: (id) => {
    const { project } = get();
    if (!project) return;
    const layer = project.layers.find((l) => l.id === id);
    if (!layer || layer.locked || (layer.type !== 'raster' && layer.type !== 'reference')) return;
    const canvas = layerService.getLayerCanvas(id);
    if (!canvas) return;
    filterService.invert(canvas);
    get().pushHistory('Invertir colores');
  },

  // Same shape as invertLayerColors — destructive, one-shot, Photoshop's Ctrl+Shift+U.
  desaturateLayerColors: (id) => {
    const { project } = get();
    if (!project) return;
    const layer = project.layers.find((l) => l.id === id);
    if (!layer || layer.locked || (layer.type !== 'raster' && layer.type !== 'reference')) return;
    const canvas = layerService.getLayerCanvas(id);
    if (!canvas) return;
    filterService.desaturate(canvas);
    get().pushHistory('Desaturar');
  },

  setLayerEffects: (id, effects) => {
    const { project } = get();
    if (!project) return;
    set({ project: { ...project, layers: project.layers.map((l) => (l.id === id ? { ...l, effects } : l)) } });
  },

  // Effects update live as sliders/color pickers change (see setLayerEffects above) — pushing
  // history there would flood the undo stack, same reasoning as commitLayerOpacity.
  commitLayerEffects: () => {
    const { project } = get();
    if (!project) return;
    get().pushHistory('Editar efectos de capa');
  },

  setLayerClipTo: (id, clipTo) => {
    const { project } = get();
    if (!project) return;
    set({ project: { ...project, layers: project.layers.map((l) => (l.id === id ? { ...l, clipTo } : l)) } });
    get().pushHistory(clipTo ? 'Recortar a la capa de abajo' : 'Quitar recorte');
  },

  createLinkedInstance: (id) => {
    const { project } = get();
    if (!project) return;
    const original = project.layers.find((l) => l.id === id);
    if (!original || original.type !== 'raster') return;
    const instance = layerService.createLinkedInstance(original);
    const index = project.layers.findIndex((l) => l.id === id);
    const layers = [...project.layers];
    layers.splice(index, 0, instance);
    set({ project: { ...project, layers }, currentLayerId: instance.id });
    get().pushHistory('Crear instancia vinculada');
  },

  toggleLayerSelection: (id, additive) => {
    set((s) => {
      if (!additive) return { selectedLayerIds: s.selectedLayerIds.includes(id) && s.selectedLayerIds.length === 1 ? [] : [id] };
      return {
        selectedLayerIds: s.selectedLayerIds.includes(id)
          ? s.selectedLayerIds.filter((x) => x !== id)
          : [...s.selectedLayerIds, id],
      };
    });
  },

  clearLayerSelection: () => set({ selectedLayerIds: [] }),

  groupSelectedLayers: (name) => {
    const { project, selectedLayerIds } = get();
    if (!project || selectedLayerIds.length === 0) return;
    const selectedSet = new Set(selectedLayerIds);
    const selectedInOrder = project.layers.filter((l) => selectedSet.has(l.id));
    if (selectedInOrder.length === 0) return;
    // Grouping across different parents isn't well-defined (which position would the group
    // take?) — require every selected layer to share one parent.
    const parent = selectedInOrder[0].parent;
    if (!selectedInOrder.every((l) => l.parent === parent)) return;

    const rest = project.layers.filter((l) => !selectedSet.has(l.id));
    const topIndex = project.layers.findIndex((l) => selectedSet.has(l.id));
    const restInsertIndex = project.layers.slice(0, topIndex).filter((l) => !selectedSet.has(l.id)).length;

    const group = layerService.createGroupLayer(name ?? 'Grupo', project.width, project.height);
    group.parent = parent;
    const reparented = selectedInOrder.map((l) => ({ ...l, parent: group.id }));

    const layers = [...rest];
    layers.splice(restInsertIndex, 0, group, ...reparented);

    set({ project: { ...project, layers }, currentLayerId: group.id, selectedLayerIds: [] });
    get().pushHistory('Agrupar capas');
  },

  // Photoshop's Ctrl+Shift+G — the inverse of groupSelectedLayers: lifts the group's direct
  // children up to sit where the group itself was (its own parent, which may itself be
  // another group, or the top level), rather than always dropping them to the top level the
  // way deleting a group does.
  ungroupLayer: (id) => {
    const { project, currentLayerId } = get();
    if (!project) return;
    const group = project.layers.find((l) => l.id === id);
    if (!group || group.type !== 'group') return;
    const firstChildId = project.layers.find((l) => l.parent === id)?.id ?? null;
    const layers = project.layers
      .filter((l) => l.id !== id)
      .map((l) => (l.parent === id ? { ...l, parent: group.parent } : l));
    set({ project: { ...project, layers }, currentLayerId: currentLayerId === id ? firstChildId : currentLayerId });
    get().pushHistory('Desagrupar');
  },

  setSelectedLayersVisibility: (visible) => {
    const { project, selectedLayerIds } = get();
    if (!project || selectedLayerIds.length === 0) return;
    set({
      project: { ...project, layers: project.layers.map((l) => (selectedLayerIds.includes(l.id) ? { ...l, visible } : l)) },
    });
    get().pushHistory(visible ? 'Mostrar capas' : 'Ocultar capas');
  },

  setSelectedLayersLocked: (locked) => {
    const { project, selectedLayerIds } = get();
    if (!project || selectedLayerIds.length === 0) return;
    set({
      project: { ...project, layers: project.layers.map((l) => (selectedLayerIds.includes(l.id) ? { ...l, locked } : l)) },
    });
    get().pushHistory(locked ? 'Bloquear capas' : 'Desbloquear capas');
  },

  // A "layer comp" (surfaced in the UI as a "scene") snapshots the real, honest set of state
  // that actually varies today: per-layer visibility/opacity/blendMode/effects, PLUS the canvas
  // view (zoom/pan) — deliberately not layer position/scale, since raster layers don't actually
  // use x/y for live positioning in this app (they're always full-canvas).
  captureLayerComp: (name) => {
    const { project, zoom, panX, panY } = get();
    if (!project) return;
    const states: LayerCompState[] = project.layers.map((l) => ({
      layerId: l.id,
      visible: l.visible,
      opacity: l.opacity,
      blendMode: l.blendMode,
      effects: l.effects,
    }));
    const comp: LayerComp = { id: uuid(), name, states, createdAt: new Date().toISOString(), view: { zoom, panX, panY } };
    set({ project: { ...project, layerComps: [...(project.layerComps ?? []), comp] } });
  },

  applyLayerComp: (id) => {
    const { project } = get();
    if (!project) return;
    const comp = project.layerComps?.find((c) => c.id === id);
    if (!comp) return;
    const byId = new Map(comp.states.map((s) => [s.layerId, s]));
    const layers = project.layers.map((l) => {
      const s = byId.get(l.id);
      return s ? { ...l, visible: s.visible, opacity: s.opacity, blendMode: s.blendMode, effects: s.effects } : l;
    });
    set({ project: { ...project, layers }, ...(comp.view ? { zoom: comp.view.zoom, panX: comp.view.panX, panY: comp.view.panY } : {}) });
    get().pushHistory(`Aplicar composición "${comp.name}"`);
  },

  deleteLayerComp: (id) => {
    const { project } = get();
    if (!project) return;
    set({ project: { ...project, layerComps: (project.layerComps ?? []).filter((c) => c.id !== id) } });
  },

  setZoom: (zoom) => set({ zoom }),
  setPan: (panX, panY) => set({ panX, panY }),
  setCanvasRotation: (deg) => set({ canvasRotation: deg }),
  toggleViewFlip: () => set((s) => ({ viewFlippedH: !s.viewFlippedH })),
  setIsDrawing: (isDrawing) => set({ isDrawing }),

  // A plain drag-rectangle always replaces whatever mask-based selection was active before.
  setSelection: (rect) => set({ selection: rect, selectionMask: null }),

  // Photoshop's Ctrl+A / Ctrl+D. Like every other selection setter, not pushed to history.
  selectAll: () => {
    const { project } = get();
    if (!project) return;
    set({ selection: { x: 0, y: 0, w: project.width, h: project.height }, selectionMask: null });
  },
  deselectAll: () => set({ selection: null, selectionMask: null }),

  setSelectionMask: (mask) => {
    if (!mask) {
      set({ selectionMask: null, selection: null });
      return;
    }
    const bbox = maskToBoundingBox(mask);
    set({ selectionMask: bbox ? mask : null, selection: bbox });
  },

  // These four all work the same way regardless of how the selection was made: synthesize a
  // mask from the plain rectangle if there isn't one already, transform it, and hand the
  // result back through setSelectionMask (which recomputes the bounding box).
  invertSelection: () => {
    const { project, selection, selectionMask } = get();
    if (!project || !selection) return;
    const mask = selectionMask ?? rectToMask(selection, project.width, project.height);
    get().setSelectionMask(invertMask(mask));
  },

  featherSelection: (radius) => {
    const { project, selection, selectionMask } = get();
    if (!project || !selection) return;
    const mask = selectionMask ?? rectToMask(selection, project.width, project.height);
    get().setSelectionMask(featherMask(mask, radius));
  },

  expandSelection: (amount) => {
    const { project, selection, selectionMask } = get();
    if (!project || !selection) return;
    const mask = selectionMask ?? rectToMask(selection, project.width, project.height);
    get().setSelectionMask(expandMask(mask, amount));
  },

  contractSelection: (amount) => {
    const { project, selection, selectionMask } = get();
    if (!project || !selection) return;
    const mask = selectionMask ?? rectToMask(selection, project.width, project.height);
    get().setSelectionMask(contractMask(mask, amount));
  },

  selectColorRange: (hexColor, tolerance) => {
    const { currentLayerId } = get();
    if (!currentLayerId) return;
    const canvas = layerService.getLayerCanvas(currentLayerId);
    if (!canvas) return;
    get().setSelectionMask(colorRangeMask(canvas, hexToRgba(hexColor), tolerance));
  },

  clearSelectionArea: () => {
    const { project, currentLayerId, selection, selectionMask } = get();
    if (!project || !currentLayerId || !selection) return;
    const layer = project.layers.find((l) => l.id === currentLayerId);
    if (!layer || layer.locked) return;
    const canvas = layerService.getLayerCanvas(currentLayerId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const clearIt = () => ctx.clearRect(selection.x, selection.y, selection.w, selection.h);
    if (selectionMask) {
      // Clear only where the exact mask says selected, not its whole bounding rect.
      applyMaskedOperation(canvas, selectionMask, clearIt);
    } else {
      clearIt();
    }
    get().pushHistory('Eliminar selección');
  },

  fillSelection: (color) => {
    const { project, currentLayerId, selection, selectionMask } = get();
    if (!project || !currentLayerId) return;
    const layer = project.layers.find((l) => l.id === currentLayerId);
    if (!layer || layer.locked) return;
    const canvas = layerService.getLayerCanvas(currentLayerId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const fillIt = () =>
      withAlphaLock(ctx, layer.lockAlpha, () => {
        ctx.fillStyle = color;
        if (selection) ctx.fillRect(selection.x, selection.y, selection.w, selection.h);
        else ctx.fillRect(0, 0, canvas.width, canvas.height);
      });
    if (selectionMask) {
      applyMaskedOperation(canvas, selectionMask, fillIt);
    } else {
      fillIt();
    }
    get().pushHistory('Rellenar selección');
  },

  copySelection: () => {
    const { project, currentLayerId, selection, selectionMask } = get();
    if (!project || !currentLayerId) return;
    const canvas = layerService.getLayerCanvas(currentLayerId);
    if (!canvas) return;
    const { cropped, origin } = cropToClipboard(canvas, selection, selectionMask);
    set({ clipboardCanvas: cropped, clipboardOrigin: origin });
    // Mirrors the copy onto the OS clipboard too, so it stays interchangeable with Ctrl+C/V
    // in any other app — and so a LATER external image copy doesn't shadow this one on paste
    // (pasteAsLayer/pasteImageFromClipboard both read whichever clipboard was written to last).
    if (isElectron()) window.electronAPI.writeClipboardImage(canvasToDataUrl(cropped));
  },

  // Photoshop's Ctrl+Shift+C: copies what's actually VISIBLE (every visible layer, flattened)
  // instead of just the active layer's own pixels — useful when the active layer is mostly
  // transparent and what you want is the composited result underneath it too.
  copyMerged: () => {
    const { project, selection, selectionMask } = get();
    if (!project) return;
    const composite = layerService.flattenLayers(project.layers, project.width, project.height);
    const { cropped, origin } = cropToClipboard(composite, selection, selectionMask);
    set({ clipboardCanvas: cropped, clipboardOrigin: origin });
    if (isElectron()) window.electronAPI.writeClipboardImage(canvasToDataUrl(cropped));
  },

  cutSelection: () => {
    const { project, currentLayerId, selection, selectionMask } = get();
    if (!project || !currentLayerId) return;
    const layer = project.layers.find((l) => l.id === currentLayerId);
    if (!layer || layer.locked) return;
    const canvas = layerService.getLayerCanvas(currentLayerId);
    if (!canvas) return;

    get().copySelection();

    const ctx = canvas.getContext('2d')!;
    const clearIt = () =>
      selection ? ctx.clearRect(selection.x, selection.y, selection.w, selection.h) : ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (selection && selectionMask) {
      applyMaskedOperation(canvas, selectionMask, clearIt);
    } else {
      clearIt();
    }
    get().pushHistory('Cortar');
  },

  pasteAsLayer: () => {
    const { project, clipboardCanvas, clipboardOrigin } = get();
    if (!project || !clipboardCanvas) return;
    const layer = layerService.createLayer('Pegado', project.width, project.height);
    const ctx = layerService.getLayerCanvas(layer.id)!.getContext('2d')!;
    const origin = clipboardOrigin ?? { x: 0, y: 0 };
    ctx.drawImage(clipboardCanvas, origin.x, origin.y);
    set({
      project: { ...project, layers: [layer, ...project.layers] },
      currentLayerId: layer.id,
      selection: { x: origin.x, y: origin.y, w: clipboardCanvas.width, h: clipboardCanvas.height },
      selectionMask: null,
    });
    get().pushHistory('Pegar');
  },

  setTransparentBg: (v) => {
    const { project } = get();
    if (!project) return;
    set({ project: { ...project, settings: { ...project.settings, transparentBg: v } } });
  },

  setBackgroundColor: (color) => {
    const { project } = get();
    if (!project) return;
    set({ project: { ...project, settings: { ...project.settings, backgroundColor: color, transparentBg: false } } });
  },

  // Display-only setting — deliberately not pushed to undo history (same reasoning as pan/zoom).
  toggleGrid: () => {
    const { project } = get();
    if (!project) return;
    set({ project: { ...project, settings: { ...project.settings, gridVisible: !project.settings.gridVisible } } });
  },

  setGridSize: (size) => {
    const { project } = get();
    if (!project) return;
    set({ project: { ...project, settings: { ...project.settings, gridSize: Math.max(1, Math.round(size)) } } });
  },

  toggleRulerVisible: () => {
    const { project } = get();
    if (!project) return;
    set({ project: { ...project, settings: { ...project.settings, rulerVisible: !project.settings.rulerVisible } } });
  },

  // Deliberately not pushed to undo history — like layer panel visibility, this is project
  // content but not something an artist would expect Ctrl+Z to step back through one guide at a
  // time. Called from perspectiveStore after every mutation so it round-trips through
  // serializeProject/deserializeProject (which spread the whole `project` object through as-is).
  updatePerspectiveData: (data) => {
    const { project } = get();
    if (!project) return;
    set({ project: { ...project, perspective: data } });
  },

  // Same reasoning as updatePerspectiveData: saved with the project, not part of undo history.
  updateStudyGuides: (guides) => {
    const { project } = get();
    if (!project) return;
    set({ project: { ...project, studyGuides: guides } });
  },

  // Per-project references and palettes: saved with the project, not part of undo history.
  updateProjectReferences: (refs) => {
    const { project } = get();
    if (!project) return;
    set({ project: { ...project, references: refs } });
  },
  updateProjectPalettes: (palettes) => {
    const { project } = get();
    if (!project) return;
    set({ project: { ...project, palettes } });
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
        selectionMask: null,
      });
    }
    get().pushHistory('Redimensionar (inteligente)');
  },

  // Auto-crops the whole canvas to the smallest rectangle containing any non-transparent
  // pixel — reuses the same bounding-box math a selection mask uses (`maskToBoundingBox`),
  // fed from the flattened composite instead of a selection. Applies the SAME crop rectangle
  // to every layer (so nothing shifts relative to anything else) and to every animation
  // frame (so frames stay aligned), matching how a plain canvas resize is expected to behave.
  trimToContent: () => {
    const { project } = get();
    if (!project) return false;
    const composite = layerService.flattenLayers(project.layers, project.width, project.height);
    const bbox = maskToBoundingBox(composite);
    if (!bbox) return false;
    if (bbox.x === 0 && bbox.y === 0 && bbox.w === project.width && bbox.h === project.height) return false;

    const trimLayers = (layers: Layer[]): Layer[] =>
      layers.map((l) => {
        layerService.trimLayerToBounds(l.id, bbox);
        return { ...l, width: bbox.w, height: bbox.h };
      });

    const layers = trimLayers(project.layers);
    let animation = project.animation;
    if (animation) {
      const currentFrameIndex = animation.currentFrameIndex;
      const frames = animation.frames.map((f, i) => (i === currentFrameIndex ? { ...f, layers } : { ...f, layers: trimLayers(f.layers) }));
      animation = { ...animation, frames };
    }

    set({
      project: { ...project, width: bbox.w, height: bbox.h, layers, animation },
      selection: null,
      selectionMask: null,
    });
    get().pushHistory('Recortar al contenido');
    return true;
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
      selectionMask: null,
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

  // Tweening between the current frame and the next one: crossfades their flattened bitmaps
  // into `count` new in-between frames, inserted between them — a rough "ghost" guide, not a
  // replacement for hand-drawn inbetweens (see frameInterpolation.service.ts).
  generateInbetweenFrames: (count, easing) => {
    const { project } = get();
    if (!project?.animation || count < 1) return;
    const anim = project.animation;
    if (anim.currentFrameIndex >= anim.frames.length - 1) return;

    const fromCanvas = layerService.flattenLayers(project.layers, project.width, project.height);
    const toLayers = getFrameLayers(project, anim.currentFrameIndex + 1);
    const toCanvas = layerService.flattenLayers(toLayers, project.width, project.height);

    const frames = [...anim.frames];
    frames[anim.currentFrameIndex] = { ...frames[anim.currentFrameIndex], layers: project.layers };
    const baseDuration = frames[anim.currentFrameIndex].durationMs;

    let insertAt = anim.currentFrameIndex + 1;
    for (let step = 1; step <= count; step++) {
      const progress = step / (count + 1);
      const blended = blendCanvases(fromCanvas, toCanvas, progress, easing);
      const layer = layerService.createLayer('Intermedio', project.width, project.height, 'raster');
      layerService.getLayerCanvas(layer.id)!.getContext('2d')!.drawImage(blended, 0, 0);
      frames.splice(insertAt, 0, { id: uuid(), durationMs: baseDuration, layers: [layer] });
      insertAt++;
    }

    set({ project: { ...project, animation: { ...anim, frames } } });
    get().pushHistory('Generar intermedios');
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
      selectionMask: null,
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
  setOnionSkinSettings: (patch) => set((s) => ({ onionSkinSettings: { ...s.onionSkinSettings, ...patch } })),
  setMagicWandTolerance: (tolerance) => set({ magicWandTolerance: Math.max(0, Math.min(255, tolerance)) }),
  setEyedropperSampleSize: (size) => set({ eyedropperSampleSize: size }),
  setEyedropperSampleAllLayers: (v) => set({ eyedropperSampleAllLayers: v }),
  setGradientToolMode: (mode) => set({ gradientToolMode: mode }),

  pushHistory: (action) => {
    const { project } = get();
    if (!project) return;
    historyManager.pushState(action, project.layers, project.animation);
    captureReplayFrame(project, action);
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

  jumpToHistory: async (index) => {
    const snapshot = await historyManager.jumpTo(index);
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
