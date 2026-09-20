import { create } from 'zustand';
import { useAppStore } from '@/store/appStore';
import * as layerService from '@/services/layer.service';
import { withClip, withAlphaLock } from '@/services/canvas.service';
import { ShapeDraft, ShapeKind, VectorStrokeStyle, VectorFillStyle, BooleanOp } from '@/types/vectorShapes';
import { paintShape, rasterizeShapeMask } from '@/services/shapeGeometry.service';
import { newVectorId } from '@/services/vectorLayer.service';
import { combineMasks, divideMasks, paintMaskFill, paintMaskStroke } from '@/services/vectorBoolean.service';

interface ShapeStore {
  shapeDraft: ShapeDraft | null;
  cornerRadius: number;
  sides: number;
  innerRadiusRatio: number;
  stroke: VectorStrokeStyle;
  fill: VectorFillStyle;
  pendingSlotA: HTMLCanvasElement | null;

  startDraft: (kind: ShapeKind, x: number, y: number) => void;
  updateShapeDraft: (patch: Partial<ShapeDraft>) => void;
  setShapeDraft: (draft: ShapeDraft | null) => void;
  setCornerRadius: (v: number) => void;
  setSides: (v: number) => void;
  setInnerRadiusRatio: (v: number) => void;
  setStroke: (patch: Partial<VectorStrokeStyle>) => void;
  setFill: (patch: Partial<VectorFillStyle>) => void;

  commitDraft: () => void;
  saveDraftAsSlotA: () => void;
  performBoolean: (op: BooleanOp) => void;
  performDivide: () => void;
  cancelAll: () => void;
}

export const useShapeStore = create<ShapeStore>((set, get) => ({
  shapeDraft: null,
  cornerRadius: 0,
  sides: 6,
  innerRadiusRatio: 0.5,
  stroke: { enabled: true, color: '#111111', width: 3, cap: 'round', join: 'round', dashed: false, opacity: 1 },
  fill: { enabled: true, color: '#5b8cff', opacity: 1 },
  pendingSlotA: null,

  startDraft: (kind, x, y) => {
    const { cornerRadius, sides, innerRadiusRatio } = get();
    set({ shapeDraft: { x, y, w: 0, h: 0, angle: 0, kind, cornerRadius, sides, innerRadiusRatio } });
  },

  updateShapeDraft: (patch) =>
    set((s) => ({ shapeDraft: s.shapeDraft ? { ...s.shapeDraft, ...patch } : s.shapeDraft })),

  setShapeDraft: (draft) => set({ shapeDraft: draft }),
  setCornerRadius: (v) => set({ cornerRadius: v }),
  setSides: (v) => set({ sides: v }),
  setInnerRadiusRatio: (v) => set({ innerRadiusRatio: v }),
  setStroke: (patch) => set((s) => ({ stroke: { ...s.stroke, ...patch } })),
  setFill: (patch) => set((s) => ({ fill: { ...s.fill, ...patch } })),

  commitDraft: () => {
    const { shapeDraft, stroke, fill } = get();
    if (!shapeDraft || shapeDraft.w < 1 || shapeDraft.h < 1) {
      set({ shapeDraft: null });
      return;
    }
    const app = useAppStore.getState();
    const { project, currentLayerId, selection } = app;
    if (!project || !currentLayerId) return;
    const layer = project.layers.find((l) => l.id === currentLayerId);
    if (!layer || layer.locked) return;
    if (layer.type === 'vector') {
      app.addVectorObject({ id: newVectorId(), kind: 'shape', draft: shapeDraft, stroke: { ...stroke }, fill: { ...fill } }, 'Forma vectorial');
      set({ shapeDraft: null });
      return;
    }
    const canvas = layerService.getLayerCanvas(currentLayerId);
    if (!canvas) return;

    withAlphaLock(canvas.getContext('2d')!, layer.lockAlpha, () => {
      withClip(canvas.getContext('2d')!, selection, () => {
        paintShape(canvas.getContext('2d')!, shapeDraft, stroke, fill);
      });
    });
    app.pushHistory('Forma vectorial');
    set({ shapeDraft: null });
  },

  saveDraftAsSlotA: () => {
    const { shapeDraft } = get();
    if (!shapeDraft || shapeDraft.w < 1 || shapeDraft.h < 1) return;
    const app = useAppStore.getState();
    if (!app.project) return;
    const mask = rasterizeShapeMask(shapeDraft, app.project.width, app.project.height);
    set({ pendingSlotA: mask, shapeDraft: null });
  },

  performBoolean: (op) => {
    const { shapeDraft, pendingSlotA, stroke, fill } = get();
    if (!shapeDraft || !pendingSlotA || shapeDraft.w < 1 || shapeDraft.h < 1) return;
    const app = useAppStore.getState();
    const { project, currentLayerId, selection } = app;
    if (!project || !currentLayerId) return;
    const layer = project.layers.find((l) => l.id === currentLayerId);
    if (!layer || layer.locked) return;
    const canvas = layerService.getLayerCanvas(currentLayerId);
    if (!canvas) return;

    const maskB = rasterizeShapeMask(shapeDraft, project.width, project.height);
    const combined = combineMasks(pendingSlotA, maskB, op);

    withClip(canvas.getContext('2d')!, selection, () => {
      paintMaskFill(canvas, combined, fill);
      paintMaskStroke(canvas, combined, stroke);
    });
    app.pushHistory('Operación booleana');
    set({ shapeDraft: null, pendingSlotA: null });
  },

  /**
   * Unlike the other four ops (which merge into one flattened mask), "divide" needs each
   * resulting piece to end up as its own separately-editable object — the actual point of
   * dividing. Since a raster layer is this app's stand-in for "an object", that means one new
   * layer per piece, not one new layer total.
   */
  performDivide: () => {
    const { shapeDraft, pendingSlotA, stroke, fill } = get();
    if (!shapeDraft || !pendingSlotA || shapeDraft.w < 1 || shapeDraft.h < 1) return;
    const app = useAppStore.getState();
    const { project, selection } = app;
    if (!project) return;

    const maskB = rasterizeShapeMask(shapeDraft, project.width, project.height);
    const polygons = divideMasks(pendingSlotA, maskB);
    if (polygons.length === 0) {
      set({ shapeDraft: null, pendingSlotA: null });
      return;
    }

    const newLayers = polygons.map((polygon, i) => {
      const layer = layerService.createLayer(`División ${i + 1}`, project.width, project.height);
      const canvas = layerService.getLayerCanvas(layer.id)!;
      const ctx = canvas.getContext('2d')!;
      const path = new Path2D();
      path.moveTo(polygon[0].x, polygon[0].y);
      for (let j = 1; j < polygon.length; j++) path.lineTo(polygon[j].x, polygon[j].y);
      path.closePath();

      withClip(ctx, selection, () => {
        ctx.save();
        if (fill.enabled) {
          ctx.globalAlpha = fill.opacity;
          ctx.fillStyle = fill.color;
          ctx.fill(path, 'nonzero');
        }
        if (stroke.enabled && stroke.width > 0) {
          ctx.globalAlpha = stroke.opacity;
          ctx.strokeStyle = stroke.color;
          ctx.lineWidth = stroke.width;
          ctx.lineCap = stroke.cap;
          ctx.lineJoin = stroke.join;
          ctx.stroke(path);
        }
        ctx.restore();
      });
      return layer;
    });

    useAppStore.setState({ project: { ...project, layers: [...newLayers, ...project.layers] }, currentLayerId: newLayers[0].id });
    app.pushHistory('Dividir formas');
    set({ shapeDraft: null, pendingSlotA: null });
  },

  cancelAll: () => set({ shapeDraft: null, pendingSlotA: null }),
}));
