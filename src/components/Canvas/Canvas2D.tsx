import { Fragment, useEffect, useRef, useState } from 'react';
import { Bold, AlignLeft, AlignCenter, AlignRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAppStore } from '@/store/appStore';
import { useLayers } from '@/hooks/useLayers';
import { useTools } from '@/hooks/useTools';
import { useBrush } from '@/hooks/useBrush';
import { useCanvas } from '@/hooks/useCanvas';
import { useHistory } from '@/hooks/useHistory';
import { useRecentColorsStore } from '@/store/recentColorsStore';
import * as layerService from '@/services/layer.service';
import { strokeBrush } from '@/services/brush.service';
import { StrokeSession, needsStrokeBuffer } from '@/services/strokeBuffer.service';
import { buildLinePoints, snapAngle, taperRamp } from '@/services/lineTools.service';
import { hitTestVector, newVectorId, objectBounds, translateObject } from '@/services/vectorLayer.service';
import { useVectorLayerStore } from '@/store/vectorLayerStore';
import { eraseStroke, floodFill, getPixelAveraged, withClip, withAlphaLock } from '@/services/canvas.service';
import { drawStyledText, drawTextAlongPath, DEFAULT_TEXT_OPTIONS, TextEffect, TEXT_EFFECT_LABELS, TextOptions } from '@/services/text.service';
import { screenToProjectPoint } from '@/utils/canvasUtils';
import { ZOOM_MIN, ZOOM_MAX } from '@/utils/constants';
import { hexToRgba, rgbaToHex } from '@/utils/colorUtils';
import { Layer } from '@/types';
import TransformBox, { TransformState } from './TransformBox';
import PixelArtOverlay from './PixelArtOverlay';
import GridOverlay from './GridOverlay';
import GestureDetector from './GestureDetector';
import BrushCursor from './BrushCursor';
import PenOverlay from './PenOverlay';
import { PenPath, distance, drawPathToCanvas } from '@/services/path.service';
import { getFrameLayers } from '@/store/appStore';
import { canvasToDataUrl } from '@/utils/canvasUtils';
import { tintFrame } from '@/services/onionSkin.service';
import { polygonToMask, magicWandMask, applyMaskedOperation } from '@/services/selectionMask.service';
import { useShapeStore } from '@/store/shapeStore';
import { paintShape } from '@/services/shapeGeometry.service';
import { ShapeKind } from '@/types/vectorShapes';
import { useVectorTextStore } from '@/store/vectorTextStore';
import { paintTextDraft } from '@/services/vectorText.service';
import { usePerspectiveStore } from '@/store/perspectiveStore';
import { bakeLayerEffects, hasAnyEnabledEffect } from '@/services/layerEffects.service';
import MeshWarpOverlay from './MeshWarpOverlay';
import { applyLiquifyDab } from '@/services/warpTool.service';
import { useWarpToolStore } from '@/store/warpToolStore';
import { calculateSymmetricPoints } from '@/services/symmetryEngine.service';
import { findSnapPoint } from '@/services/snapEngine.service';
import { warpImagePerspective } from '@/services/perspectiveTransform.service';
import PerspectiveGridOverlay from '../PerspectiveTools/PerspectiveGridOverlay';
import SymmetryOverlay from '../PerspectiveTools/SymmetryOverlay';
import StudyGuidesOverlay from './StudyGuidesOverlay';
import FigureOverlay from './FigureOverlay';
import { useStudyGuidesStore } from '@/store/studyGuidesStore';
import { smartFill } from '@/services/smartFill.service';
import { beginSmudge, smudgeSegment, SmudgeState } from '@/services/smudge.service';
import { useFillOptionsStore, useSmudgeStore } from '@/store/fillOptionsStore';
import GuideLines from '../PerspectiveTools/GuideLines';
import RulerBars from '../PerspectiveTools/RulerBars';

interface Point {
  x: number;
  y: number;
  /** Stylus tilt 0-1 at this point (only for brush strokes). */
  tilt?: number;
  /** Stylus pressure (0-1) at this point, for pressure-sensitive brush dynamics — only ever
   * set on points headed into a brush stroke; every other tool leaves it undefined. */
  pressure?: number;
  /** Stamp-radius multiplier (tapered stroke ends). */
  scale?: number;
}

// A handful of fonts every OS ships with, so the text always renders as picked instead of
// silently falling back for anyone without some obscure font installed.
const TEXT_FONT_OPTIONS = ['Arial', 'Georgia', 'Times New Roman', 'Courier New', 'Verdana', 'Impact', 'Comic Sans MS'];

/** Tools that work on a vector layer; every pixel-painting tool asks for the layer to be rasterized first. */
const VECTOR_LAYER_TOOLS = ['shapeRect', 'shapeEllipse', 'shapePolygon', 'shapeStar', 'text', 'vectorText', 'pen', 'vectorSelect', 'eyedropper', 'pan', 'zoom', 'selection', 'lasso', 'magicWand'];

const SHAPE_TOOL_KIND: Partial<Record<string, ShapeKind>> = {
  shapeRect: 'rectangle',
  shapeEllipse: 'ellipse',
  shapePolygon: 'polygon',
  shapeStar: 'star',
};

export default function Canvas2D() {
  const project = useAppStore((s) => s.project);
  const { layers, currentLayerId, currentLayer } = useLayers();
  const { currentTool, primaryColor, secondaryColor, setPrimaryColor } = useTools();
  const addRecentColor = useRecentColorsStore((s) => s.addColor);
  const { currentBrush } = useBrush();
  const { zoom, panX, panY, canvasRotation, viewFlippedH, setZoom, setPan, zoomBy, setIsDrawing } = useCanvas();
  const { historyVersion } = useHistory();
  const pushHistory = useAppStore((s) => s.pushHistory);
  const addVectorObject = useAppStore((s) => s.addVectorObject);
  const setVectorObjects = useAppStore((s) => s.setVectorObjects);
  const selectedVectorId = useVectorLayerStore((s) => s.selectedId);
  const selection = useAppStore((s) => s.selection);
  const setSelection = useAppStore((s) => s.setSelection);
  const selectionMask = useAppStore((s) => s.selectionMask);
  const setSelectionMask = useAppStore((s) => s.setSelectionMask);
  const magicWandTolerance = useAppStore((s) => s.magicWandTolerance);
  const eyedropperSampleSize = useAppStore((s) => s.eyedropperSampleSize);
  const eyedropperSampleAllLayers = useAppStore((s) => s.eyedropperSampleAllLayers);
  const gradientToolMode = useAppStore((s) => s.gradientToolMode);
  const clearSelectionArea = useAppStore((s) => s.clearSelectionArea);
  const setCurrentTool = useAppStore((s) => s.setCurrentTool);
  const maskEditLayerId = useAppStore((s) => s.maskEditLayerId);
  const onionSkinEnabled = useAppStore((s) => s.onionSkinEnabled);
  const onionSkinSettings = useAppStore((s) => s.onionSkinSettings);

  const shapeDraft = useShapeStore((s) => s.shapeDraft);
  const startShapeDraft = useShapeStore((s) => s.startDraft);
  const updateShapeDraft = useShapeStore((s) => s.updateShapeDraft);
  const setShapeDraft = useShapeStore((s) => s.setShapeDraft);
  const shapeStroke = useShapeStore((s) => s.stroke);
  const shapeFill = useShapeStore((s) => s.fill);
  const pendingSlotA = useShapeStore((s) => s.pendingSlotA);
  const commitShapeDraft = useShapeStore((s) => s.commitDraft);
  const cancelAllShapes = useShapeStore((s) => s.cancelAll);

  const textDraft = useVectorTextStore((s) => s.textDraft);
  const buildTextDraft = useVectorTextStore((s) => s.buildDraft);
  const updateTextDraft = useVectorTextStore((s) => s.updateTextDraft);
  const commitTextDraft = useVectorTextStore((s) => s.commitDraft);
  const cancelTextDraft = useVectorTextStore((s) => s.cancel);
  const [vectorTextInputPos, setVectorTextInputPos] = useState<Point | null>(null);
  const [vectorTextPreviewUrl, setVectorTextPreviewUrl] = useState<string | null>(null);
  const vectorTextAreaRef = useRef<HTMLTextAreaElement>(null);

  // `autoFocus` loses a race here: the mousedown that opens this textarea hasn't finished its
  // browser-level default action (which can assign focus back to the previously-hit element)
  // by the time React's commit runs autoFocus, so the focus gets immediately stolen back.
  // Deferring to the next frame runs after that default action has settled.
  useEffect(() => {
    if (!vectorTextInputPos) return;
    const id = requestAnimationFrame(() => vectorTextAreaRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [vectorTextInputPos]);

  const canvasRefs = useRef<Record<string, HTMLCanvasElement>>({});
  const maskCanvasRefs = useRef<Record<string, HTMLCanvasElement>>({});
  const fillCanvasRefs = useRef<Record<string, HTMLCanvasElement>>({});
  const adjustmentCanvasRefs = useRef<Record<string, HTMLCanvasElement>>({});
  const effectsBehindCanvasRefs = useRef<Record<string, HTMLCanvasElement>>({});
  const effectsFrontCanvasRefs = useRef<Record<string, HTMLCanvasElement>>({});
  const [maskDataUrls, setMaskDataUrls] = useState<Record<string, string>>({});
  const stageRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  const warpRadius = useWarpToolStore((s) => s.radius);
  const warpStrength = useWarpToolStore((s) => s.strength);
  const warpMode = useWarpToolStore((s) => s.mode);

  const symmetry = usePerspectiveStore((s) => s.symmetry);
  const perspectiveGrid = usePerspectiveStore((s) => s.grid);
  const guides = usePerspectiveStore((s) => s.guides);
  const snapSettings = usePerspectiveStore((s) => s.snap);
  const addGuide = usePerspectiveStore((s) => s.addGuide);

  // Perspective grid/guides/symmetry are per-project content (Project.perspective) — re-seed
  // this app-wide store whenever the open project changes, same lifecycle as everything else
  // here that's keyed on project.id.
  useEffect(() => {
    usePerspectiveStore.getState().hydrateFromProject(project);
    useStudyGuidesStore.getState().hydrateFromProject(project);
  }, [project]);

  // React's synthetic onWheel is attached as a passive listener (same as the browser's own
  // default for wheel/touch, for scroll perf) — preventDefault() inside it is silently
  // ignored, so Ctrl+wheel would still trigger the browser's own page-zoom underneath ours.
  // A native, non-passive listener is the only way to actually suppress that.
  const zoomByRef = useRef(zoomBy);
  zoomByRef.current = zoomBy;
  const panPosRef = useRef({ panX, panY });
  panPosRef.current = { panX, panY };

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    function onWheel(e: WheelEvent) {
      // Chromium swaps deltaY into deltaX when Shift is held during a wheel event (its
      // native "shift turns vertical scroll into horizontal" convention) — reading whichever
      // axis actually carries the value keeps this correct regardless of that swap.
      const delta = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      if (delta === 0) return;
      e.preventDefault();

      if (e.ctrlKey) {
        zoomByRef.current(delta < 0 ? 1.1 : 1 / 1.1);
      } else if (e.shiftKey) {
        const { panX: px, panY: py } = panPosRef.current;
        setPan(px, py - delta);
      } else if (e.altKey) {
        const { panX: px, panY: py } = panPosRef.current;
        setPan(px - delta, py);
      }
    }

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [setPan]);

  // Ctrl+0: fit the whole canvas in the viewport (Photoshop's convention) — a fixed gesture
  // like the digit-key brush opacity shortcut, not part of the remappable shortcut list, since
  // it needs the viewport's live on-screen size which only this component has.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!((e.ctrlKey || e.metaKey) && e.key === '0')) return;
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
      if (!project || !viewportRef.current) return;
      e.preventDefault();
      const rect = viewportRef.current.getBoundingClientRect();
      const fitZoom = Math.min(rect.width / project.width, rect.height / project.height) * 0.9;
      const clamped = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, fitZoom));
      setZoom(clamped);
      // Re-centers the scaled stage within the (flexbox-centered, top-left-pivoted) viewport —
      // same formula as the space/wheel pan math: scaling shrinks/grows the box from its own
      // top-left, so half the size delta has to be added back as pan to keep it centered.
      setPan((project.width * (1 - clamped)) / 2, (project.height * (1 - clamped)) / 2);
      // The viewport is `overflow-auto`; if it was scrolled while zoomed in past its bounds,
      // that scroll offset lingers even after the content shrinks back to fit — reset it so
      // the flex-centering (and the pan math above) actually lines up with what's on screen.
      viewportRef.current.scrollLeft = 0;
      viewportRef.current.scrollTop = 0;
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [project, setZoom, setPan]);

  // Holding Space temporarily pans on drag no matter which tool is selected — same reflex
  // as Photoshop/Krita/Clip Studio. Tracked in a ref (read inside handlePointerDown) plus a
  // bit of state just to swap the cursor to 'grab' while held; keydown/keyup are rare enough
  // that the extra render here isn't a concern the way pointermove would be.
  const isSpaceDownRef = useRef(false);
  const [isSpacePanning, setIsSpacePanning] = useState(false);

  useEffect(() => {
    function isTypingTarget(target: EventTarget | null): boolean {
      const el = target as HTMLElement;
      return el?.tagName === 'INPUT' || el?.tagName === 'TEXTAREA' || el?.isContentEditable === true;
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.code !== 'Space' || isTypingTarget(e.target)) return;
      e.preventDefault(); // stops Space from also activating a focused button/scrolling the page
      if (!isSpaceDownRef.current) {
        isSpaceDownRef.current = true;
        setIsSpacePanning(true);
      }
    }
    function onKeyUp(e: KeyboardEvent) {
      if (e.code !== 'Space') return;
      isSpaceDownRef.current = false;
      setIsSpacePanning(false);
    }
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  /** 0 (pen upright) .. 1 (pen flat) from the pointer event's tilt angles; 0 for a mouse. */
  const stylusTilt = (e: { tiltX?: number; tiltY?: number }) => Math.min(1, Math.hypot(e.tiltX ?? 0, e.tiltY ?? 0) / 90);
  const lastPointRef = useRef<Point | null>(null);
  const strokeSessionRef = useRef<StrokeSession | null>(null);
  const vectorDragRef = useRef<{ id: string; last: Point; moved: boolean } | null>(null);
  /** Distance travelled by the current freehand stroke, for the start taper. */
  const strokeDistRef = useRef(0);
  /** Freehand strokes with an end taper: every point plus the layer as it was, to redraw on release. */
  const strokePtsRef = useRef<Point[]>([]);
  const strokeBaseRef = useRef<HTMLCanvasElement | null>(null);
  /** Line / Curve tools: `a`→`b` is the drag; `c` (curve only) is the bend, chosen while `bend` is set. */
  const [lineDraft, setLineDraft] = useState<{ a: Point; b: Point; c: Point | null; bend: boolean } | null>(null);
  const lineDraftRef = useRef(lineDraft);
  lineDraftRef.current = lineDraft;
  const smudgeRef = useRef<SmudgeState | null>(null);
  // Unlike `lastPointRef` (cleared on every pointer-up), this survives across separate clicks —
  // it's the anchor for Shift+click straight lines (Photoshop/Krita/CSP convention): click once
  // to lay down a point, then Shift+click elsewhere to stroke a straight line from that point to
  // the new one. Cleared whenever the active layer changes, so a stray Shift+click right after
  // switching layers can't draw a line anchored to a point on a completely different canvas.
  const lastStrokeEndRef = useRef<Point | null>(null);
  useEffect(() => {
    lastStrokeEndRef.current = null;
  }, [currentLayer?.id]);
  const panStartRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const selectionStartRef = useRef<Point | null>(null);
  const lassoPointsRef = useRef<Point[]>([]);
  const [lassoPreview, setLassoPreview] = useState<Point[]>([]);
  const [selectionMaskPreviewUrl, setSelectionMaskPreviewUrl] = useState<string | null>(null);
  const shapeDragStartRef = useRef<Point | null>(null);
  const isNewShapeDragRef = useRef(false);
  const [shapePreviewUrl, setShapePreviewUrl] = useState<string | null>(null);
  const gradientStartRef = useRef<Point | null>(null);
  const [gradientPreview, setGradientPreview] = useState<{ start: Point; end: Point } | null>(null);

  // Tints the selection mask blue so a lasso/wand/color-range shape reads visually distinct
  // from the plain dashed-rectangle overlay, which only ever covers a bounding box.
  useEffect(() => {
    if (!selectionMask) {
      setSelectionMaskPreviewUrl(null);
      return;
    }
    const preview = document.createElement('canvas');
    preview.width = selectionMask.width;
    preview.height = selectionMask.height;
    const ctx = preview.getContext('2d')!;
    ctx.drawImage(selectionMask, 0, 0);
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = 'rgba(91,140,255,0.35)';
    ctx.fillRect(0, 0, preview.width, preview.height);
    setSelectionMaskPreviewUrl(preview.toDataURL());
  }, [selectionMask]);

  // Live fill+stroke preview of the pending shape draft, redrawn on every geometry/style change —
  // same "offscreen canvas -> data URL -> <img> overlay" technique as the selection mask preview.
  useEffect(() => {
    if (!shapeDraft || !project) {
      setShapePreviewUrl(null);
      return;
    }
    const preview = document.createElement('canvas');
    preview.width = project.width;
    preview.height = project.height;
    paintShape(preview.getContext('2d')!, shapeDraft, shapeStroke, shapeFill);
    setShapePreviewUrl(preview.toDataURL());
  }, [shapeDraft, shapeStroke, shapeFill, project]);

  // Switching away from a shape tool discards any pending draft/slot, same as the pen tool does.
  useEffect(() => {
    if (!SHAPE_TOOL_KIND[currentTool]) {
      setShapeDraft(null);
      cancelAllShapes();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTool]);

  // Enter commits the pending shape draft (bakes it); Escape cancels it and any saved slot A.
  useEffect(() => {
    if (!SHAPE_TOOL_KIND[currentTool]) return;
    function onKey(e: KeyboardEvent) {
      if (!shapeDraft) return;
      if ((e.target as HTMLElement).tagName === 'INPUT') return;
      if (e.key === 'Enter') {
        e.preventDefault();
        commitShapeDraft();
        setCurrentTool('brush');
      } else if (e.key === 'Escape') {
        e.preventDefault();
        cancelAllShapes();
        setCurrentTool('brush');
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTool, shapeDraft]);

  // Live preview of the pending vector-text draft, same offscreen-canvas technique as shapes.
  useEffect(() => {
    if (!textDraft || !project) {
      setVectorTextPreviewUrl(null);
      return;
    }
    const { stroke, fill } = useShapeStore.getState();
    const preview = document.createElement('canvas');
    preview.width = project.width;
    preview.height = project.height;
    paintTextDraft(preview.getContext('2d')!, textDraft, stroke, fill);
    setVectorTextPreviewUrl(preview.toDataURL());
    // Re-runs when shapeStore's shared stroke/fill change too (read via getState above, so
    // subscribe explicitly here rather than relying on a hook re-render).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [textDraft, shapeStroke, shapeFill, project]);

  // Switching away from the vector-text tool discards any pending draft/input, same as shapes.
  useEffect(() => {
    if (currentTool !== 'vectorText') {
      setVectorTextInputPos(null);
      cancelTextDraft();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTool]);

  // Enter commits the pending text draft (bakes it); Escape cancels it.
  useEffect(() => {
    if (currentTool !== 'vectorText') return;
    function onKey(e: KeyboardEvent) {
      if (!textDraft) return;
      if ((e.target as HTMLElement).tagName === 'TEXTAREA') return;
      if (e.key === 'Enter') {
        e.preventDefault();
        commitTextDraft();
        setCurrentTool('brush');
      } else if (e.key === 'Escape') {
        e.preventDefault();
        cancelTextDraft();
        setCurrentTool('brush');
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTool, textDraft]);
  const [textInput, setTextInput] = useState<{ x: number; y: number } | null>(null);
  const [textEffect, setTextEffect] = useState<TextEffect>('normal');
  // Font/size/weight/alignment for the (raster) Text tool — color comes from primaryColor
  // separately, same as everywhere else color is picked. Persists across uses like currentBrush.
  const [textStyle, setTextStyle] = useState<Omit<TextOptions, 'color'>>({
    font: DEFAULT_TEXT_OPTIONS.font,
    size: DEFAULT_TEXT_OPTIONS.size,
    align: DEFAULT_TEXT_OPTIONS.align,
    weight: DEFAULT_TEXT_OPTIONS.weight,
  });
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  // Focus moving from the textarea into one of the toolbar's own controls (the size input,
  // font select, bold/align buttons...) shouldn't close/commit the text — only losing focus to
  // something OUTSIDE both should. `onMouseDown preventDefault` on the toolbar stops a plain
  // click from stealing focus at all, but a control that needs real focus to be usable (typing
  // into the size input, opening the font <select>) still receives it — this ref lets onBlur
  // tell that apart from a genuine "clicked away" blur.
  const textToolbarRef = useRef<HTMLDivElement>(null);

  const [transform, setTransform] = useState<TransformState | null>(null);
  const originalBoundsRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null);
  const [pivotOverride, setPivotOverride] = useState<Point | null>(null);
  const [perspectiveWarpMode, setPerspectiveWarpMode] = useState(false);
  const [freeCorners, setFreeCorners] = useState<[Point, Point, Point, Point] | null>(null);

  const [penPath, setPenPath] = useState<PenPath | null>(null);
  const [penPreviewPoint, setPenPreviewPoint] = useState<Point | null>(null);
  const [penFillEnabled, setPenFillEnabled] = useState(false);
  const [penTextMode, setPenTextMode] = useState(false);
  const [penText, setPenText] = useState('');
  const [penTextSize, setPenTextSize] = useState(32);
  const penDraggingRef = useRef(false);
  const CLOSE_THRESHOLD_PX = 10;

  // Mirrors the store's `isDrawing` synchronously: pointer events can fire faster than
  // React re-renders, so gating on store state (read from a stale closure) can drop moves.
  const isDrawingRef = useRef(false);
  function beginDrawing() {
    isDrawingRef.current = true;
    setIsDrawing(true);
  }
  function endDrawing() {
    isDrawingRef.current = false;
    setIsDrawing(false);
  }

  const eraserSize = currentBrush.size;

  // Keep the mounted DOM canvases in sync with the pixel registry: on layer add/remove
  // and after undo/redo (which swaps registry canvases wholesale), mirror content in.
  useEffect(() => {
    if (!project) return;
    layers.forEach((layer) => {
      const el = canvasRefs.current[layer.id];
      if (!el) return;
      const registryCanvas = layerService.getLayerCanvas(layer.id);
      // Reassigning canvas.width/height clears its bitmap even when the value is
      // unchanged, so only touch these (and re-sync pixels) when the canvas is new
      // or its dimensions genuinely changed.
      if (registryCanvas === el && el.width === layer.width && el.height === layer.height) {
        return;
      }
      el.width = layer.width;
      el.height = layer.height;
      if (registryCanvas && registryCanvas !== el) {
        const ctx = el.getContext('2d')!;
        ctx.drawImage(registryCanvas, 0, 0);
      }
      layerService.registerLayerCanvas(layer.id, el);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id, layers.map((l) => l.id).join(','), historyVersion]);

  // Mirror the mask being actively edited into its mounted DOM canvas, same pattern
  // as the raster sync above (new/resized canvas only — width/height resets pixels).
  useEffect(() => {
    if (!maskEditLayerId) return;
    const el = maskCanvasRefs.current[maskEditLayerId];
    const layer = layers.find((l) => l.id === maskEditLayerId);
    if (!el || !layer) return;
    const registryCanvas = layerService.getMaskCanvas(maskEditLayerId);
    if (registryCanvas === el && el.width === layer.width && el.height === layer.height) return;
    el.width = layer.width;
    el.height = layer.height;
    if (registryCanvas && registryCanvas !== el) {
      el.getContext('2d')!.drawImage(registryCanvas, 0, 0);
    }
    layerService.registerMaskCanvas(maskEditLayerId, el);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maskEditLayerId, layers.map((l) => l.id).join(','), historyVersion]);

  // Regenerate the CSS mask-image previews after every committed change (pointerup bumps
  // historyVersion); painting the mask can lag one stroke behind live, which is an
  // acceptable trade-off against recomposing on every pointermove.
  //
  // Also folds in "clip to layer below" here: a clipped layer's live DOM preview reuses this
  // exact same mask-image mechanism, fed from its clip base's alpha (converted to a luminance
  // mask) instead of a hand-painted one. When a layer has BOTH a real paint mask and clipping,
  // the two luminance masks are combined via a 'multiply' composite, which is the correct
  // intersection for two [0,1]-normalized grayscale masks. Only raster/reference/fill layers can
  // serve as a live clip base (a group would need flattening its whole subtree on every stroke,
  // which the export/flatten path supports but this live preview skips for cost).
  useEffect(() => {
    const next: Record<string, string> = {};
    layers.forEach((layer) => {
      const ownMask = layer.hasMask ? layerService.getMaskCanvas(layer.id) : undefined;

      let clipAlpha: HTMLCanvasElement | undefined;
      if (layer.clipTo) {
        const siblings = layers.filter((l) => l.parent === layer.parent);
        const idx = siblings.findIndex((l) => l.id === layer.id);
        for (let i = idx + 1; i < siblings.length; i++) {
          const candidate = siblings[i];
          if (candidate.clipTo) continue;
          if (candidate.type === 'raster' || candidate.type === 'reference' || candidate.type === 'vector') {
            const c = layerService.getLayerCanvas(candidate.id);
            if (c) clipAlpha = layerService.alphaToLuminanceMask(c);
          } else if (candidate.type === 'fill') {
            clipAlpha = layerService.alphaToLuminanceMask(layerService.renderFillLayer(candidate, candidate.width, candidate.height));
          }
          break;
        }
      }

      if (!ownMask && !clipAlpha) return;

      let combined: HTMLCanvasElement;
      if (ownMask && clipAlpha) {
        combined = document.createElement('canvas');
        combined.width = ownMask.width;
        combined.height = ownMask.height;
        const ctx = combined.getContext('2d')!;
        ctx.drawImage(ownMask, 0, 0);
        ctx.globalCompositeOperation = 'multiply';
        ctx.drawImage(clipAlpha, 0, 0);
      } else {
        combined = (ownMask ?? clipAlpha)!;
      }
      next[layer.id] = combined.toDataURL();
    });
    setMaskDataUrls(next);
  }, [layers, historyVersion]);

  // Live layer-style preview (drop shadow, glow, bevel, overlays, stroke) for raster layers —
  // scoped to raster only; fill/group layers still get correct effects in the export/flatten
  // path (layerService.paintLayerOnto), just not a live interactive preview, to keep this
  // effect's cost bounded. Baked into two auxiliary canvases mounted around the layer's own
  // canvas (see renderLayerNode) so "behind" effects (shadow, outer glow) and "front" effects
  // (inner shadow/glow, bevel, overlays, stroke) land in the right DOM stacking order for free.
  useEffect(() => {
    layers.forEach((layer) => {
      if (layer.type !== 'raster' && layer.type !== 'reference') return;
      const behindEl = effectsBehindCanvasRefs.current[layer.id];
      const frontEl = effectsFrontCanvasRefs.current[layer.id];
      if (!behindEl || !frontEl) return;

      behindEl.width = layer.width;
      behindEl.height = layer.height;
      frontEl.width = layer.width;
      frontEl.height = layer.height;
      const bctx = behindEl.getContext('2d')!;
      const fctx = frontEl.getContext('2d')!;
      bctx.clearRect(0, 0, behindEl.width, behindEl.height);
      fctx.clearRect(0, 0, frontEl.width, frontEl.height);

      if (!hasAnyEnabledEffect(layer.effects)) return;
      const source = layerService.getLayerCanvas(layer.id);
      if (!source) return;
      const { behind, front } = bakeLayerEffects(source, layer.effects);
      if (behind) bctx.drawImage(behind, 0, 0);
      if (front) fctx.drawImage(front, 0, 0);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layers, historyVersion]);

  // Fill layers have no registry canvas — their bitmap is generated purely from their
  // fillType/color/gradient/pattern props, then composited via the same CSS opacity/
  // blendMode/mask as a raster layer's canvas node.
  useEffect(() => {
    if (!project) return;
    layers.forEach((layer) => {
      if (layer.type !== 'fill') return;
      const el = fillCanvasRefs.current[layer.id];
      if (!el) return;
      el.width = layer.width;
      el.height = layer.height;
      const rendered = layerService.renderFillLayer(layer, layer.width, layer.height);
      el.getContext('2d')!.drawImage(rendered, 0, 0);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id, layers, historyVersion]);

  // Adjustment layers have no pixels of their own — their DOM node bakes "everything
  // below it in its group, plus its own effect" via renderLayerPreview (opacity/mask
  // already lerped in), so it can sit as a normal opaque overlay in the layer stack.
  // Recomputes on any layer change, so it can lag one stroke behind a live brush stroke
  // on a layer below it, matching the same trade-off already accepted for mask previews.
  useEffect(() => {
    if (!project) return;
    layers.forEach((layer) => {
      if (layer.type !== 'adjustment') return;
      const el = adjustmentCanvasRefs.current[layer.id];
      if (!el) return;
      el.width = project.width;
      el.height = project.height;
      const rendered = layerService.renderLayerPreview(layers, layer, project.width, project.height);
      el.getContext('2d')!.drawImage(rendered, 0, 0);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id, layers, historyVersion]);

  // Onion skin: flatten `framesBack`/`framesForward` neighboring frames and show them as
  // faint (optionally tinted) overlays while animating, so the current frame can be drawn in
  // alignment with its neighbors. Closer frames are more opaque than farther ones.
  interface OnionSkinLayer {
    url: string;
    opacity: number;
  }
  const [onionSkinLayers, setOnionSkinLayers] = useState<{ back: OnionSkinLayer[]; forward: OnionSkinLayer[] }>({ back: [], forward: [] });
  useEffect(() => {
    if (!onionSkinEnabled || !project?.animation) {
      setOnionSkinLayers({ back: [], forward: [] });
      return;
    }
    const anim = project.animation;
    const settings = onionSkinSettings;

    function buildLayer(index: number, distanceFromCurrent: number, count: number, baseOpacity: number, tintColor: string): OnionSkinLayer {
      const frameLayers = getFrameLayers(project!, index);
      const flat = layerService.flattenLayers(frameLayers, project!.width, project!.height);
      const opacity = baseOpacity * (count - distanceFromCurrent + 1) / count;
      const url = settings.tint ? tintFrame(flat, tintColor) : canvasToDataUrl(flat);
      return { url, opacity };
    }

    const back: OnionSkinLayer[] = [];
    for (let i = 1; i <= settings.framesBack; i++) {
      const index = anim.currentFrameIndex - i;
      if (index < 0) break;
      back.push(buildLayer(index, i, settings.framesBack, settings.opacityBack, '#ff0000'));
    }

    const forward: OnionSkinLayer[] = [];
    for (let i = 1; i <= settings.framesForward; i++) {
      const index = anim.currentFrameIndex + i;
      if (index >= anim.frames.length) break;
      forward.push(buildLayer(index, i, settings.framesForward, settings.opacityForward, '#0000ff'));
    }

    // Reversed so the closest frame renders last (on top) — otherwise the farthest, dimmest
    // frame would visually sit above the more relevant nearby ones.
    setOnionSkinLayers({ back: back.reverse(), forward: forward.reverse() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onionSkinEnabled, onionSkinSettings, project?.animation?.currentFrameIndex, project?.animation?.frames.length, historyVersion]);

  // Deferred to the next frame rather than focusing immediately: the mousedown that opens this
  // textarea hasn't finished its browser-level default action (which can reassign focus back to
  // whatever was under the cursor) by the time this effect runs, so an immediate focus() gets
  // stolen right back — same race fixed for the vector-text tool's input, see its comment above.
  useEffect(() => {
    if (!textInput) return;
    const id = requestAnimationFrame(() => textAreaRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [textInput]);

  // Enter transform mode: seed the box from the active selection, or the whole layer.
  useEffect(() => {
    if (currentTool === 'transform' && currentLayer) {
      const base = selection ?? { x: 0, y: 0, w: currentLayer.width, h: currentLayer.height };
      originalBoundsRef.current = { ...base };
      setTransform({ ...base, angle: 0 });
      setPivotOverride(null);
      setPerspectiveWarpMode(false);
      setFreeCorners([
        { x: base.x, y: base.y },
        { x: base.x + base.w, y: base.y },
        { x: base.x + base.w, y: base.y + base.h },
        { x: base.x, y: base.y + base.h },
      ]);
    } else {
      setTransform(null);
      originalBoundsRef.current = null;
      setPivotOverride(null);
      setPerspectiveWarpMode(false);
      setFreeCorners(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTool, currentLayer?.id]);

  function commitTransform() {
    if (!currentLayer || !originalBoundsRef.current) return;
    const canvas = canvasRefs.current[currentLayer.id];
    if (!canvas) return;
    const ob = originalBoundsRef.current;
    const srcW = Math.max(1, Math.round(ob.w));
    const srcH = Math.max(1, Math.round(ob.h));

    const temp = document.createElement('canvas');
    temp.width = srcW;
    temp.height = srcH;
    temp.getContext('2d')!.drawImage(canvas, ob.x, ob.y, ob.w, ob.h, 0, 0, srcW, srcH);

    const ctx = canvas.getContext('2d')!;

    if (perspectiveWarpMode && freeCorners) {
      const { canvas: warped, x, y } = warpImagePerspective(temp, freeCorners);
      ctx.clearRect(ob.x, ob.y, ob.w, ob.h);
      ctx.drawImage(warped, x, y);
      pushHistory('Transformar en perspectiva');
    } else {
      if (!transform) return;
      ctx.clearRect(ob.x, ob.y, ob.w, ob.h);
      ctx.save();
      const pivot = pivotOverride ?? { x: transform.x + transform.w / 2, y: transform.y + transform.h / 2 };
      const boxCenter = { x: transform.x + transform.w / 2, y: transform.y + transform.h / 2 };
      // Rotate around the custom pivot: translate so the pivot sits at the origin, rotate, then
      // draw the box's own center at its rotated-around-pivot position.
      ctx.translate(pivot.x, pivot.y);
      ctx.rotate(transform.angle);
      ctx.translate(-pivot.x, -pivot.y);
      ctx.translate(boxCenter.x, boxCenter.y);
      ctx.scale(transform.w / srcW, transform.h / srcH);
      ctx.drawImage(temp, -srcW / 2, -srcH / 2);
      ctx.restore();
      pushHistory('Transformar');
    }

    setSelection(null);
    setCurrentTool('brush');
  }

  function cancelTransform() {
    setCurrentTool('brush');
  }

  // Leaving the pen tool discards any uncommitted (unclosed/unfinished) path.
  useEffect(() => {
    if (currentTool !== 'pen') {
      setPenPath(null);
      setPenPreviewPoint(null);
      penDraggingRef.current = false;
      setPenTextMode(false);
      setPenText('');
    }
  }, [currentTool]);

  function commitPenPath() {
    if (!penPath || !currentLayer || penPath.points.length < 2) {
      setPenPath(null);
      setCurrentTool('brush');
      return;
    }
    if (currentLayer.type === 'vector' && penTextMode && penText.trim()) {
      addVectorObject(
        {
          id: newVectorId(),
          kind: 'pathText',
          text: penText,
          path: penPath,
          font: DEFAULT_TEXT_OPTIONS.font,
          fontSize: penTextSize,
          weight: DEFAULT_TEXT_OPTIONS.weight,
          fill: { enabled: true, color: primaryColor, opacity: 1 },
          stroke: { enabled: false, color: primaryColor, width: 1, cap: 'round', join: 'round', dashed: false, opacity: 1 },
        },
        'Texto en trazo'
      );
      setPenPath(null);
      setPenText('');
      setCurrentTool('brush');
      return;
    }
    if (currentLayer.type === 'vector') {
      addVectorObject(
        {
          id: newVectorId(),
          kind: 'path',
          path: penPath,
          stroke: { enabled: true, color: primaryColor, width: currentBrush.size, cap: 'round', join: 'round', dashed: false, opacity: 1 },
          fill: { enabled: penFillEnabled && penPath.closed, color: secondaryColor, opacity: 1 },
        },
        'Trazado vectorial'
      );
      setPenPath(null);
      setPenText('');
      setCurrentTool('brush');
      return;
    }
    const canvasEl = getActiveCanvas(currentLayer);
    if (canvasEl) {
      if (penTextMode && penText.trim()) {
        withAlphaLock(canvasEl.getContext('2d')!, currentLayer.lockAlpha, () => {
          withClip(canvasEl.getContext('2d')!, selection, () => {
            drawTextAlongPath(canvasEl, penText, penPath, { ...DEFAULT_TEXT_OPTIONS, color: primaryColor, size: penTextSize });
          });
        });
        pushHistory('Texto en trazo');
      } else {
        withAlphaLock(canvasEl.getContext('2d')!, currentLayer.lockAlpha, () => {
          withClip(canvasEl.getContext('2d')!, selection, () => {
            drawPathToCanvas(canvasEl, penPath, {
              strokeColor: primaryColor,
              strokeWidth: currentBrush.size,
              fillColor: penFillEnabled ? secondaryColor : undefined,
            });
          });
        });
        pushHistory('Trazo de pluma');
      }
    }
    setPenPath(null);
    setPenText('');
    setCurrentTool('brush');
  }

  function cancelPenPath() {
    setPenPath(null);
    setCurrentTool('brush');
  }

  function finishPenPath(closed: boolean) {
    setPenPath((prev) => (prev ? { ...prev, closed } : prev));
  }

  // Enter/Escape apply or cancel the in-progress transform; arrow keys nudge its position by
  // 1px (10px with Shift) — the keyboard equivalent of dragging the box, for pixel-precise
  // placement without needing a steady mouse hand.
  useEffect(() => {
    if (currentTool !== 'transform') return;
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
      if (e.key === 'Enter') {
        e.preventDefault();
        commitTransform();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        cancelTransform();
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
        if (perspectiveWarpMode && freeCorners) {
          setFreeCorners(freeCorners.map((c) => ({ x: c.x + dx, y: c.y + dy })) as [Point, Point, Point, Point]);
        } else if (transform) {
          setTransform({ ...transform, x: transform.x + dx, y: transform.y + dy });
        }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTool, transform, perspectiveWarpMode, freeCorners]);

  // Enter finishes an in-progress pen path (open); Escape cancels it entirely.
  useEffect(() => {
    if (currentTool !== 'pen') return;
    function onKey(e: KeyboardEvent) {
      if (!penPath) return;
      // Typing into the "texto en trazo" field shouldn't finish/cancel the path underneath it.
      if ((e.target as HTMLElement).tagName === 'INPUT') return;
      if (e.key === 'Enter') {
        e.preventDefault();
        finishPenPath(false);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        cancelPenPath();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTool, penPath]);

  // Delete/Backspace clears the selected pixels; Escape drops the selection.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
      // Not gated on which tool is active: a selection made with lasso/wand/rect stays
      // actionable via these keys even after switching tools, same as it already behaved
      // for drag-rectangle selections while the Selection tool stayed active.
      if (!selection) return;
      // Alt+Backspace / Ctrl+Backspace are claimed by "fill with primary/secondary color"
      // (edit.fillPrimary/edit.fillSecondary in App.tsx) — only a BARE Delete/Backspace
      // clears the selection here, so the two don't fight over the same keypress.
      if ((e.key === 'Delete' || e.key === 'Backspace') && !e.altKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        clearSelectionArea();
      } else if (e.key === 'Escape') {
        setSelectionMask(null);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selection, clearSelectionArea, setSelectionMask]);

  /** The canvas drawing tools should target: the layer's mask while editing it, else its color canvas. */
  function getActiveCanvas(layer: Layer): HTMLCanvasElement | undefined {
    if (maskEditLayerId === layer.id) return maskCanvasRefs.current[layer.id];
    return canvasRefs.current[layer.id];
  }

  /** Eyedropper color sampling — from just the active layer by default, or (when "sample all
   * layers" is on) from the flattened, visible composite instead, so it picks the color you
   * actually SEE rather than whatever's on the active layer underneath everything else. */
  function sampleEyedropperColor(fallbackCanvas: HTMLCanvasElement, x: number, y: number) {
    const source = eyedropperSampleAllLayers ? layerService.flattenLayers(layers, project!.width, project!.height) : fallbackCanvas;
    return getPixelAveraged(source.getContext('2d')!, x, y, eyedropperSampleSize);
  }

  /** Paints `points` (1 point = a stamp, 2 = a segment) via `paintFn`, then — if a symmetry mode
   * is active — repaints the same shape at each symmetric transform of those points, pairing up
   * corresponding indices so a 2-point segment stays a real connected line in its mirrored copies
   * too, not just isolated stamps at each endpoint. */
  function strokeWithSymmetry(paintFn: (pts: Point[]) => void, points: Point[]) {
    paintFn(points);
    if (!symmetry.enabled || symmetry.mode === 'none') return;
    const perPointVariants = points.map((p) => calculateSymmetricPoints(p.x, p.y, symmetry));
    const variantCount = perPointVariants[0]?.length ?? 0;
    for (let i = 0; i < variantCount; i++) {
      paintFn(perPointVariants.map((variants, k) => ({ ...points[k], ...variants[i] })));
    }
  }

  /** One brush stroke segment. Brushes with flow or a blend mode go through a stroke session
   * (see strokeBuffer.service); the rest paint straight onto the layer as before. */
  function paintBrushSegment(canvasEl: HTMLCanvasElement, pts: Point[], layer: { lockAlpha?: boolean }) {
    const session = strokeSessionRef.current;
    const pixel = project?.type === 'pixelart';
    if (session) {
      strokeWithSymmetry((p) => {
        session.touch(p);
        strokeBrush(session.ctx, p, session.stampBrush, primaryColor, pixel);
      }, pts);
      session.flush(selection, layer.lockAlpha);
      return;
    }
    const ctx = canvasEl.getContext('2d')!;
    withAlphaLock(ctx, layer.lockAlpha, () => {
      withClip(ctx, selection, () => {
        strokeWithSymmetry((p) => strokeBrush(ctx, p, currentBrush, primaryColor, pixel), pts);
      });
    });
  }

  /** Strokes the pending Line/Curve with the current brush (tapered ends included). */
  function commitLineDraft(draft: { a: Point; b: Point; c: Point | null }) {
    setLineDraft(null);
    if (!currentLayer || currentLayer.locked || !project) return;
    const canvasEl = getActiveCanvas(currentLayer);
    if (!canvasEl) return;
    if (Math.hypot(draft.b.x - draft.a.x, draft.b.y - draft.a.y) < 1) return;
    const pts = buildLinePoints(draft.a, draft.b, draft.c, currentBrush) as Point[];
    strokeSessionRef.current = needsStrokeBuffer(currentBrush) ? new StrokeSession(canvasEl, currentBrush) : null;
    paintBrushSegment(canvasEl, pts, currentLayer);
    strokeSessionRef.current = null;
    layerService.syncLinkedInstances(layers, currentLayer.id);
    lastStrokeEndRef.current = draft.b;
    pushHistory(currentTool === 'curve' ? 'Curva' : 'Línea recta');
  }

  useEffect(() => {
    if (!lineDraft) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLineDraft(null);
      else if (e.key === 'Enter' && lineDraftRef.current) commitLineDraft(lineDraftRef.current);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!lineDraft, currentTool]);
  useEffect(() => {
    if (currentTool !== 'line' && currentTool !== 'curve') setLineDraft(null);
  }, [currentTool]);

  function getPos(e: React.PointerEvent): Point | null {
    if (!project || !currentLayer || !stageRef.current) return null;
    const rect = stageRef.current.getBoundingClientRect();
    return screenToProjectPoint(e.clientX, e.clientY, rect, zoom, canvasRotation, project.width, project.height, viewFlippedH);
  }

  /** Smart-guide snapping — deliberately applied only to shape/transform anchor points, never to
   * freehand brush/eraser strokes (which would feel broken if they kept jumping to a grid). */
  function snapPos(pos: Point): Point {
    if (!project) return pos;
    // Pixel-art projects snap automatically (that's what the per-project flag is for); any
    // other project can opt in via the same "Cuadrícula de píxeles" checkbox as the other
    // snap targets in the Guides panel.
    const pixelGrid = {
      enabled: project.settings.snapToGrid || snapSettings.targets.includes('pixelGrid'),
      size: project.settings.gridSize,
    };
    const snapped = findSnapPoint(pos.x, pos.y, snapSettings, guides, perspectiveGrid, project.width, project.height, pixelGrid);
    return snapped ? { x: snapped.x, y: snapped.y } : pos;
  }

  /**
   * Stroke stabilizer: the stamped point trails the raw pointer position instead of
   * snapping straight to it, damping out hand tremor on freehand lines. `smoothing` 0
   * returns `raw` unchanged (identical to no stabilizer, the pre-existing behavior);
   * closer to 1 pulls the trail only a small fraction of the way each move event, so the
   * line lags further behind and comes out visibly smoother (at the cost of responsiveness).
   */
  function applySmoothing(prev: Point, raw: Point, smoothing: number): Point {
    if (smoothing <= 0) return raw;
    const lagFactor = 1 - Math.min(0.95, smoothing) * 0.9;
    return {
      x: prev.x + (raw.x - prev.x) * lagFactor,
      y: prev.y + (raw.y - prev.y) * lagFactor,
    };
  }

  function handlePointerDown(e: React.PointerEvent) {
    if (!project || !currentLayer) return;
    try {
      (e.target as Element).setPointerCapture?.(e.pointerId);
    } catch {
      // Some pointer ids can't be captured; drawing still works via the container's move/up handlers.
    }

    // Space-held or middle-mouse pan works no matter which tool is active — the same
    // reflex every other drawing app supports, so a brush/eraser drag doesn't get eaten
    // just because the user wanted to reposition the view without switching tools.
    if (isSpaceDownRef.current || e.button === 1) {
      e.preventDefault();
      panStartRef.current = { x: e.clientX, y: e.clientY, panX, panY };
      beginDrawing();
      return;
    }

    if (currentTool === 'pan') {
      panStartRef.current = { x: e.clientX, y: e.clientY, panX, panY };
      beginDrawing();
      return;
    }
    if (currentTool === 'zoom') {
      zoomBy(e.shiftKey ? 0.8 : 1.25);
      return;
    }
    if (currentTool === 'transform') return;
    if (currentLayer.locked || currentLayer.type === 'group' || currentLayer.type === 'reference') return;
    if (currentLayer.type === 'vector' && !VECTOR_LAYER_TOOLS.includes(currentTool)) {
      toast('Esta capa es vectorial: usa formas, texto, pluma o «Seleccionar objeto». Para pintar píxeles, rasteriza la capa.', { icon: 'ℹ️', id: 'vector-layer-paint' });
      return;
    }

    const pos = getPos(e);
    if (!pos) return;
    const canvasEl = getActiveCanvas(currentLayer);
    if (!canvasEl) return;

    // Alt+click temporarily samples color from the active layer instead of painting — the
    // same reflex Photoshop/Krita/Clip Studio support, so switching to the Eyedropper tool
    // and back isn't needed just to grab a color mid-stroke. Returns before beginDrawing(),
    // so the following pointermove/up (still holding the mouse down) never paints either.
    if (e.altKey && (currentTool === 'brush' || currentTool === 'eraser' || currentTool === 'paintbucket' || currentTool === 'warp' || currentTool === 'smudge')) {
      const color = sampleEyedropperColor(canvasEl, pos.x, pos.y);
      const hex = rgbaToHex(color);
      setPrimaryColor(hex);
      addRecentColor(hex);
      return;
    }

    beginDrawing();

    switch (currentTool) {
      case 'brush': {
        // A mouse (or a pen without a pressure sensor) reports a constant 0.5 while a button
        // is held — only a real stylus varies this — but `applyBrushStamp` only lets it affect
        // anything when the brush's own dynamics opt in, so this is harmless either way.
        const posP = { ...pos, pressure: e.pressure, tilt: stylusTilt(e) };
        // Shift+click straight line (Photoshop/Krita/Clip Studio convention): strokes a
        // straight segment from wherever the last stroke ended to this new click, instead of
        // starting a fresh dot — lets an artist lay down clean straight edges without switching
        // to a shape tool. Handled as a single complete action (pushHistory + endDrawing right
        // away), same as the other one-shot tools below, rather than an open drag.
        if (e.shiftKey && lastStrokeEndRef.current) {
          const from = lastStrokeEndRef.current;
          strokeSessionRef.current = needsStrokeBuffer(currentBrush) ? new StrokeSession(canvasEl, currentBrush) : null;
          paintBrushSegment(canvasEl, [from, posP], currentLayer);
          strokeSessionRef.current = null;
          lastStrokeEndRef.current = pos;
          layerService.syncLinkedInstances(layers, currentLayer.id);
          pushHistory('Línea recta');
          endDrawing();
          break;
        }
        strokeDistRef.current = 0;
        strokePtsRef.current = [posP];
        strokeBaseRef.current = null;
        if (currentBrush.taperEnd) {
          const base = document.createElement('canvas');
          base.width = canvasEl.width;
          base.height = canvasEl.height;
          base.getContext('2d')!.drawImage(canvasEl, 0, 0);
          strokeBaseRef.current = base;
        }
        if (currentBrush.taperStart) posP.scale = taperRamp(0, currentBrush.taperStart);
        lastPointRef.current = posP;
        strokeSessionRef.current = needsStrokeBuffer(currentBrush) ? new StrokeSession(canvasEl, currentBrush) : null;
        paintBrushSegment(canvasEl, [posP], currentLayer);
        break;
      }
      case 'vectorSelect': {
        if (currentLayer.type !== 'vector') break;
        const hit = hitTestVector(currentLayer.vectorObjects ?? [], pos.x, pos.y);
        useVectorLayerStore.getState().select(hit?.id ?? null);
        vectorDragRef.current = hit ? { id: hit.id, last: pos, moved: false } : null;
        break;
      }
      case 'line':
      case 'curve': {
        const draft = lineDraftRef.current;
        if (draft?.bend) {
          // Second click of a curve: the bend chosen while hovering becomes final.
          commitLineDraft({ ...draft, c: draft.c ?? { x: (draft.a.x + draft.b.x) / 2, y: (draft.a.y + draft.b.y) / 2 } });
          endDrawing();
          break;
        }
        const a = snapPos(pos);
        setLineDraft({ a, b: a, c: null, bend: false });
        break;
      }
      case 'eraser': {
        if (e.shiftKey && lastStrokeEndRef.current) {
          const from = lastStrokeEndRef.current;
          withClip(canvasEl.getContext('2d')!, selection, () => {
            strokeWithSymmetry((pts) => eraseStroke(canvasEl, pts, eraserSize), [from, pos]);
          });
          lastStrokeEndRef.current = pos;
          layerService.syncLinkedInstances(layers, currentLayer.id);
          pushHistory('Línea recta (borrador)');
          endDrawing();
          break;
        }
        lastPointRef.current = pos;
        withClip(canvasEl.getContext('2d')!, selection, () => {
          strokeWithSymmetry((pts) => eraseStroke(canvasEl, pts, eraserSize), [pos]);
        });
        break;
      }
      case 'warp': {
        lastPointRef.current = pos;
        applyLiquifyDab(canvasEl, pos.x, pos.y, warpRadius, warpStrength / 100, warpMode, 0, 0);
        break;
      }
      case 'smudge': {
        const sm = useSmudgeStore.getState();
        lastPointRef.current = pos;
        smudgeRef.current = beginSmudge(canvasEl, pos.x, pos.y, { size: sm.size, strength: sm.strength, paintLoad: sm.paintLoad, color: primaryColor });
        break;
      }
      case 'paintbucket': {
        const fo = useFillOptionsStore.getState();
        const fill = fo.smart
          ? () =>
              smartFill(
                canvasEl,
                fo.sampleAllLayers ? layerService.flattenLayers(layers, project.width, project.height) : canvasEl,
                pos.x,
                pos.y,
                hexToRgba(primaryColor),
                { tolerance: fo.tolerance, gapClose: fo.gapClose, grow: fo.grow },
                selection ?? undefined,
                currentLayer.lockAlpha
              )
          : () => floodFill(canvasEl, pos.x, pos.y, hexToRgba(primaryColor), 32, selection ?? undefined, currentLayer.lockAlpha);
        if (selectionMask) {
          applyMaskedOperation(canvasEl, selectionMask, fill);
        } else {
          fill();
        }
        pushHistory('Bote de pintura');
        endDrawing();
        break;
      }
      case 'gradient': {
        // Drag defines the gradient's axis (primary color at the start, secondary at the
        // end) — baked on release in handlePointerUp, once the drag distance is known, same
        // "draft while dragging, commit on pointer-up" flow as the shape tools.
        gradientStartRef.current = pos;
        setGradientPreview({ start: pos, end: pos });
        break;
      }
      case 'eyedropper': {
        const color = sampleEyedropperColor(canvasEl, pos.x, pos.y);
        const hex = rgbaToHex(color);
        setPrimaryColor(hex);
        addRecentColor(hex);
        endDrawing();
        break;
      }
      case 'text': {
        setTextInput(pos);
        endDrawing();
        break;
      }
      case 'selection': {
        selectionStartRef.current = pos;
        setSelection({ x: pos.x, y: pos.y, w: 0, h: 0 });
        break;
      }
      case 'lasso': {
        lassoPointsRef.current = [pos];
        setLassoPreview([pos]);
        break;
      }
      case 'magicWand': {
        const mask = magicWandMask(canvasEl, pos.x, pos.y, magicWandTolerance);
        setSelectionMask(mask);
        endDrawing();
        break;
      }
      case 'pen': {
        if (penPath?.closed) break; // finished, waiting on Aplicar/Cancelar
        if (penPath && penPath.points.length > 2 && distance(pos, penPath.points[0].anchor) < CLOSE_THRESHOLD_PX / zoom) {
          finishPenPath(true);
          break;
        }
        const newPoint = { anchor: pos, controlIn: pos, controlOut: pos };
        setPenPath((prev) => (prev ? { ...prev, points: [...prev.points, newPoint] } : { points: [newPoint], closed: false }));
        penDraggingRef.current = true;
        break;
      }
      case 'shapeRect':
      case 'shapeEllipse':
      case 'shapePolygon':
      case 'shapeStar': {
        // Clicking elsewhere while a draft is pending starts a fresh one, same as re-dragging a
        // rectangle selection replaces the previous one — drag its handles instead to refine it.
        const snappedStart = snapPos(pos);
        shapeDragStartRef.current = snappedStart;
        isNewShapeDragRef.current = true;
        startShapeDraft(SHAPE_TOOL_KIND[currentTool]!, snappedStart.x, snappedStart.y);
        break;
      }
      case 'vectorText': {
        if (textDraft) break; // a draft is already pending — resize it via its handles, or Enter/Escape first
        setVectorTextInputPos(pos);
        endDrawing();
        break;
      }
    }
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (currentTool === 'pen') {
      const pos = getPos(e);
      if (!pos) return;
      setPenPreviewPoint(pos);
      if (penDraggingRef.current && penPath && !penPath.closed) {
        setPenPath((prev) => {
          if (!prev || prev.points.length === 0) return prev;
          const points = [...prev.points];
          const last = { ...points[points.length - 1] };
          last.controlOut = pos;
          const dx = pos.x - last.anchor.x;
          const dy = pos.y - last.anchor.y;
          last.controlIn = { x: last.anchor.x - dx, y: last.anchor.y - dy };
          points[points.length - 1] = last;
          return { ...prev, points };
        });
      }
      return;
    }

    if ((currentTool === 'line' || currentTool === 'curve') && lineDraftRef.current) {
      const pos = getPos(e);
      const d = lineDraftRef.current;
      if (pos) {
        if (d.bend) setLineDraft({ ...d, c: pos });
        else if (isDrawingRef.current) setLineDraft({ ...d, b: e.shiftKey ? snapAngle(d.a, pos) : snapPos(pos) });
      }
      return;
    }

    if (!isDrawingRef.current) return;

    if (panStartRef.current) {
      // Set regardless of currentTool by handlePointerDown — via the 'pan' tool, space-held,
      // or a middle-mouse drag — so the same drag math applies no matter which triggered it.
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      setPan(panStartRef.current.panX + dx, panStartRef.current.panY + dy);
      return;
    }

    if (!currentLayer || currentLayer.locked || currentLayer.type === 'group' || currentLayer.type === 'reference') return;
    const pos = getPos(e);
    if (!pos) return;
    const canvasEl = getActiveCanvas(currentLayer);
    if (!canvasEl) return;

    if (currentTool === 'vectorSelect' && vectorDragRef.current && currentLayer.type === 'vector') {
      const drag = vectorDragRef.current;
      const dx = pos.x - drag.last.x;
      const dy = pos.y - drag.last.y;
      if (dx !== 0 || dy !== 0) {
        setVectorObjects(currentLayer.id, (currentLayer.vectorObjects ?? []).map((o) => (o.id === drag.id ? translateObject(o, dx, dy) : o)), null);
        vectorDragRef.current = { ...drag, last: pos, moved: true };
      }
      return;
    }

    if (currentTool === 'brush' && lastPointRef.current) {
      const smoothedPos: Point = { ...applySmoothing(lastPointRef.current, pos, currentBrush.smoothing ?? 0), pressure: e.pressure, tilt: stylusTilt(e) };
      strokeDistRef.current += Math.hypot(smoothedPos.x - lastPointRef.current.x, smoothedPos.y - lastPointRef.current.y);
      if (currentBrush.taperStart) smoothedPos.scale = taperRamp(strokeDistRef.current, currentBrush.taperStart);
      paintBrushSegment(canvasEl, [lastPointRef.current!, smoothedPos], currentLayer);
      strokePtsRef.current.push(smoothedPos);
      lastPointRef.current = smoothedPos;
    } else if (currentTool === 'eraser' && lastPointRef.current) {
      const smoothedPos = applySmoothing(lastPointRef.current, pos, currentBrush.smoothing ?? 0);
      withClip(canvasEl.getContext('2d')!, selection, () => {
        strokeWithSymmetry((pts) => eraseStroke(canvasEl, pts, eraserSize), [lastPointRef.current!, smoothedPos]);
      });
      lastPointRef.current = smoothedPos;
    } else if (currentTool === 'smudge' && lastPointRef.current && smudgeRef.current) {
      const sm = useSmudgeStore.getState();
      withClip(canvasEl.getContext('2d')!, selection, () => {
        smudgeSegment(canvasEl, smudgeRef.current!, lastPointRef.current!, pos, { size: sm.size, strength: sm.strength, paintLoad: sm.paintLoad, color: primaryColor });
      });
      lastPointRef.current = pos;
    } else if (currentTool === 'warp' && lastPointRef.current) {
      const dragDx = pos.x - lastPointRef.current.x;
      const dragDy = pos.y - lastPointRef.current.y;
      applyLiquifyDab(canvasEl, pos.x, pos.y, warpRadius, warpStrength / 100, warpMode, dragDx, dragDy);
      lastPointRef.current = pos;
    } else if (currentTool === 'selection' && selectionStartRef.current) {
      const start = selectionStartRef.current;
      setSelection({
        x: Math.min(start.x, pos.x),
        y: Math.min(start.y, pos.y),
        w: Math.abs(pos.x - start.x),
        h: Math.abs(pos.y - start.y),
      });
    } else if (currentTool === 'lasso' && lassoPointsRef.current.length > 0) {
      lassoPointsRef.current = [...lassoPointsRef.current, pos];
      setLassoPreview(lassoPointsRef.current);
    } else if (SHAPE_TOOL_KIND[currentTool] && isNewShapeDragRef.current && shapeDragStartRef.current) {
      const start = shapeDragStartRef.current;
      const snappedPos = snapPos(pos);
      let dx = snappedPos.x - start.x;
      let dy = snappedPos.y - start.y;
      if (e.shiftKey) {
        const side = Math.max(Math.abs(dx), Math.abs(dy));
        dx = (dx < 0 ? -1 : 1) * side;
        dy = (dy < 0 ? -1 : 1) * side;
      }
      updateShapeDraft({
        x: Math.min(start.x, start.x + dx),
        y: Math.min(start.y, start.y + dy),
        w: Math.abs(dx),
        h: Math.abs(dy),
      });
    } else if (currentTool === 'gradient' && gradientStartRef.current) {
      const start = gradientStartRef.current;
      let end = pos;
      // Shift snaps the axis to 45° steps — matches the shape tools' shift convention, useful
      // for clean horizontal/vertical/diagonal gradients.
      if (e.shiftKey) {
        const dist = Math.hypot(pos.x - start.x, pos.y - start.y);
        const angle = Math.round(Math.atan2(pos.y - start.y, pos.x - start.x) / (Math.PI / 4)) * (Math.PI / 4);
        end = { x: start.x + Math.cos(angle) * dist, y: start.y + Math.sin(angle) * dist };
      }
      setGradientPreview({ start, end });
    }
  }

  /** The end of a freehand stroke is only known on release: put the layer back and redraw the whole
   * stroke with its last `taperEnd` px narrowing to a point. */
  function applyEndTaper() {
    const base = strokeBaseRef.current;
    const pts = strokePtsRef.current;
    strokeBaseRef.current = null;
    if (!base || pts.length < 2 || !currentLayer || !currentBrush.taperEnd) return;
    const canvasEl = getActiveCanvas(currentLayer);
    if (!canvasEl) return;
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
    const total = cum[cum.length - 1];
    if (total < 2) return;
    const len = Math.min(currentBrush.taperEnd, total);
    const tapered = pts.map((p, i) => ({ ...p, scale: (p.scale ?? 1) * taperRamp(total - cum[i], len) }));
    const ctx = canvasEl.getContext('2d')!;
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
    ctx.drawImage(base, 0, 0);
    ctx.restore();
    strokeSessionRef.current = needsStrokeBuffer(currentBrush) ? new StrokeSession(canvasEl, currentBrush) : null;
    paintBrushSegment(canvasEl, tapered, currentLayer);
    strokeSessionRef.current = null;
  }

  function handlePointerUp() {
    strokeSessionRef.current = null;
    if (isDrawingRef.current && currentTool === 'brush') applyEndTaper();
    if (vectorDragRef.current?.moved) pushHistory('Mover objeto vectorial');
    vectorDragRef.current = null;
    if ((currentTool === 'line' || currentTool === 'curve') && lineDraftRef.current && !lineDraftRef.current.bend && isDrawingRef.current) {
      const d = lineDraftRef.current;
      if (currentTool === 'curve' && Math.hypot(d.b.x - d.a.x, d.b.y - d.a.y) >= 1) {
        // Keep the draft open: the next move bends it, the next click commits it.
        setLineDraft({ ...d, c: { x: (d.a.x + d.b.x) / 2, y: (d.a.y + d.b.y) / 2 }, bend: true });
      } else {
        commitLineDraft(d);
      }
    }
    if (isDrawingRef.current && (currentTool === 'brush' || currentTool === 'eraser') && currentLayer) {
      layerService.syncLinkedInstances(layers, currentLayer.id);
      pushHistory(currentTool === 'brush' ? 'Trazo de pincel' : 'Borrador');
      // Anchors the next Shift+click straight line to wherever this (freehand) stroke ended.
      if (lastPointRef.current) lastStrokeEndRef.current = lastPointRef.current;
    }
    if (isDrawingRef.current && currentTool === 'smudge' && currentLayer) {
      smudgeRef.current = null;
      layerService.syncLinkedInstances(layers, currentLayer.id);
      pushHistory('Mezclador de color');
    }
    if (isDrawingRef.current && currentTool === 'warp' && currentLayer) {
      layerService.syncLinkedInstances(layers, currentLayer.id);
      pushHistory('Deformar (warp)');
    }
    if (currentTool === 'selection' && selectionStartRef.current && selection && selection.w < 2 && selection.h < 2) {
      setSelection(null);
    }
    if (currentTool === 'lasso' && lassoPointsRef.current.length > 2 && currentLayer) {
      const canvasEl = getActiveCanvas(currentLayer);
      if (canvasEl) {
        const mask = polygonToMask(lassoPointsRef.current, canvasEl.width, canvasEl.height);
        setSelectionMask(mask);
      }
    }
    if (currentTool === 'lasso') {
      lassoPointsRef.current = [];
      setLassoPreview([]);
    }
    if (isNewShapeDragRef.current) {
      isNewShapeDragRef.current = false;
      shapeDragStartRef.current = null;
      // A click without dragging creates a default-sized shape instead of a zero-size one.
      const draft = useShapeStore.getState().shapeDraft;
      if (draft && draft.w < 2 && draft.h < 2) {
        updateShapeDraft({ x: draft.x - 30, y: draft.y - 30, w: 60, h: 60 });
      }
    }
    if (gradientStartRef.current && gradientPreview && currentLayer && !currentLayer.locked) {
      const { start, end } = gradientPreview;
      // A near-zero-length drag (an accidental click) bakes nothing rather than a degenerate
      // gradient — canvas leaves createLinearGradient(p, p) undefined/browser-specific.
      if (Math.hypot(end.x - start.x, end.y - start.y) >= 1) {
        const canvasEl = getActiveCanvas(currentLayer);
        if (canvasEl) {
          const ctx = canvasEl.getContext('2d')!;
          const paint = () => {
            const gradient =
              gradientToolMode === 'radial'
                ? ctx.createRadialGradient(start.x, start.y, 0, start.x, start.y, Math.hypot(end.x - start.x, end.y - start.y))
                : ctx.createLinearGradient(start.x, start.y, end.x, end.y);
            gradient.addColorStop(0, primaryColor);
            gradient.addColorStop(1, secondaryColor);
            ctx.fillStyle = gradient;
            if (selection) ctx.fillRect(selection.x, selection.y, selection.w, selection.h);
            else ctx.fillRect(0, 0, canvasEl.width, canvasEl.height);
          };
          withAlphaLock(ctx, currentLayer.lockAlpha, () => {
            if (selection && selectionMask) {
              applyMaskedOperation(canvasEl, selectionMask, paint);
            } else {
              paint();
            }
          });
          layerService.syncLinkedInstances(layers, currentLayer.id);
          pushHistory('Degradado');
        }
      }
    }
    gradientStartRef.current = null;
    setGradientPreview(null);
    penDraggingRef.current = false;
    lastPointRef.current = null;
    panStartRef.current = null;
    selectionStartRef.current = null;
    endDrawing();
  }

  function commitText(value: string) {
    if (value.trim() && currentLayer?.type === 'vector' && textInput) {
      addVectorObject(
        {
          id: newVectorId(),
          kind: 'text',
          text: value,
          x: textInput.x,
          y: textInput.y,
          angle: 0,
          scale: 1,
          font: textStyle.font,
          fontSize: textStyle.size,
          weight: textStyle.weight,
          effect: textEffect,
          fill: { enabled: true, color: primaryColor, opacity: 1 },
          stroke: { enabled: false, color: primaryColor, width: 1, cap: 'round', join: 'round', dashed: false, opacity: 1 },
        },
        'Texto'
      );
      setTextInput(null);
      return;
    }
    if (value.trim() && currentLayer && textInput) {
      const canvasEl = getActiveCanvas(currentLayer);
      if (canvasEl) {
        withAlphaLock(canvasEl.getContext('2d')!, currentLayer.lockAlpha, () => {
          drawStyledText(
            canvasEl,
            value,
            textInput.x,
            textInput.y,
            { ...textStyle, color: primaryColor },
            textEffect
          );
        });
        pushHistory('Texto');
      }
    }
    setTextInput(null);
  }

  function getProjectPoint(clientX: number, clientY: number): Point {
    const rect = stageRef.current!.getBoundingClientRect();
    return screenToProjectPoint(clientX, clientY, rect, zoom, canvasRotation, project!.width, project!.height, viewFlippedH);
  }

  function cssBlend(mode: GlobalCompositeOperation): React.CSSProperties['mixBlendMode'] {
    return mode === 'source-over' ? 'normal' : (mode as React.CSSProperties['mixBlendMode']);
  }

  /**
   * Renders one layer node, recursing into group children. Groups use `isolation: isolate`
   * so their children's blend modes only mix with each other, then the group as a whole
   * blends with layers below it via its own opacity/blendMode — matching how `flattenLayers`
   * composites groups for export.
   */
  function renderLayerNode(layer: Layer): React.ReactNode {
    if (layer.type === 'group') {
      const children = layers.filter((l) => l.parent === layer.id).reverse();
      return (
        <div
          key={layer.id}
          style={{
            position: 'absolute',
            inset: 0,
            opacity: layer.opacity,
            mixBlendMode: cssBlend(layer.blendMode),
            isolation: 'isolate',
            display: layer.visible ? 'block' : 'none',
            pointerEvents: 'none',
          }}
        >
          {children.map(renderLayerNode)}
        </div>
      );
    }

    const isEditingThisMask = maskEditLayerId === layer.id;
    const maskUrl = layer.hasMask || layer.clipTo ? maskDataUrls[layer.id] : undefined;

    if (layer.type === 'adjustment') {
      // The baked bitmap already has this layer's own opacity and mask lerped in
      // (see renderLayerPreview), so the DOM node itself needs no CSS opacity/mask/blend.
      return (
        <canvas
          key={layer.id}
          ref={(el) => {
            if (el) adjustmentCanvasRefs.current[layer.id] = el;
          }}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            display: layer.visible ? 'block' : 'none',
            pointerEvents: 'none',
          }}
        />
      );
    }

    if (layer.type === 'fill') {
      return (
        <canvas
          key={layer.id}
          ref={(el) => {
            if (el) fillCanvasRefs.current[layer.id] = el;
          }}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            opacity: layer.opacity,
            mixBlendMode: cssBlend(layer.blendMode),
            display: layer.visible ? 'block' : 'none',
            pointerEvents: 'none',
            WebkitMaskImage: maskUrl ? `url(${maskUrl})` : undefined,
            maskImage: maskUrl ? `url(${maskUrl})` : undefined,
            WebkitMaskSize: '100% 100%',
            maskSize: '100% 100%',
            maskMode: 'luminance',
            WebkitMaskSourceType: 'luminance',
          } as React.CSSProperties}
        />
      );
    }

    return (
      <Fragment key={layer.id}>
        <canvas
          ref={(el) => {
            if (el) effectsBehindCanvasRefs.current[layer.id] = el;
          }}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            opacity: layer.opacity,
            display: layer.visible && !isEditingThisMask ? 'block' : 'none',
            pointerEvents: 'none',
          }}
        />
        <canvas
          ref={(el) => {
            if (el) canvasRefs.current[layer.id] = el;
          }}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            opacity: layer.opacity,
            mixBlendMode: cssBlend(layer.blendMode),
            display: layer.visible && !isEditingThisMask ? 'block' : 'none',
            pointerEvents: 'none',
            imageRendering: project!.type === 'pixelart' ? 'pixelated' : 'auto',
            WebkitMaskImage: maskUrl ? `url(${maskUrl})` : undefined,
            maskImage: maskUrl ? `url(${maskUrl})` : undefined,
            WebkitMaskSize: '100% 100%',
            maskSize: '100% 100%',
            // Our mask is a painted grayscale canvas (always fully opaque) — force luminance
            // mode so brightness clips visibility instead of the (constant) alpha channel.
            maskMode: 'luminance',
            WebkitMaskSourceType: 'luminance',
          } as React.CSSProperties}
        />
        <canvas
          ref={(el) => {
            if (el) effectsFrontCanvasRefs.current[layer.id] = el;
          }}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            opacity: layer.opacity,
            display: layer.visible && !isEditingThisMask ? 'block' : 'none',
            pointerEvents: 'none',
          }}
        />
        {isEditingThisMask && (
          <canvas
            ref={(el) => {
              if (el) maskCanvasRefs.current[layer.id] = el;
            }}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              display: layer.visible ? 'block' : 'none',
              pointerEvents: 'none',
              imageRendering: project!.type === 'pixelart' ? 'pixelated' : 'auto',
            }}
          />
        )}
      </Fragment>
    );
  }

  if (!project) return null;

  const topLevelLayers = layers.filter((l) => !l.parent).reverse();
  const brushCursorActive = !isSpacePanning && (currentTool === 'brush' || currentTool === 'line' || currentTool === 'curve' || currentTool === 'eraser' || currentTool === 'warp' || currentTool === 'smudge');
  const brushCursorDiameter = currentTool === 'warp' ? warpRadius * 2 * zoom : currentTool === 'smudge' ? useSmudgeStore.getState().size * zoom : currentBrush.size * zoom;
  const brushCursorSquare = currentTool === 'brush' && project.type === 'pixelart';

  return (
    <div
      ref={viewportRef}
      className="flex-1 relative overflow-auto flex items-center justify-center checkerboard"
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      {/* Rulers assume an unrotated, unmirrored stage (ticks along straight screen edges) —
          hidden while rotated or flipped rather than shown misaligned; reappear automatically
          once rotation resets to 0 and the view-mirror is off. */}
      {project.settings.rulerVisible && canvasRotation === 0 && !viewFlippedH && (
        <RulerBars
          viewportRef={viewportRef}
          stageRef={stageRef}
          zoom={zoom}
          panX={panX}
          panY={panY}
          canvasWidth={project.width}
          canvasHeight={project.height}
          onCreateGuide={(type, pos) => addGuide(type, type === 'vertical' ? pos : 0, type === 'horizontal' ? pos : 0)}
        />
      )}
      <div
        ref={stageRef}
        onPointerDown={handlePointerDown}
        style={{
          width: project.width,
          height: project.height,
          // The viewport is a flex row; without this, a project WIDER than it (the common
          // case for any canvas bigger than the visible area) gets silently flex-shrunk below
          // its stated width while height stays untouched — a non-uniform squish, since
          // `align-items:center` on the cross axis never resizes an item the way flex-shrink
          // does on the main axis. `overflow-auto` is what's supposed to handle the overflow.
          flexShrink: 0,
          // Rotation and the view-mirror both pivot around the canvas's own center (via the
          // translate/.../translate trio) rather than transformOrigin '0 0' — keeps the existing
          // top-left-anchored zoom pivot untouched when both are at their identity values. The
          // mirror is applied INSIDE the rotation (mirror happens first, in local space) —
          // screenToProjectPoint's inverse mapping mirrors that exact order in reverse.
          transform: `translate(${panX}px, ${panY}px) scale(${zoom}) translate(${project.width / 2}px, ${project.height / 2}px) rotate(${canvasRotation}deg) scale(${viewFlippedH ? -1 : 1}, 1) translate(${-project.width / 2}px, ${-project.height / 2}px)`,
          transformOrigin: '0 0',
          position: 'relative',
          boxShadow: '0 0 0 1px rgba(255,255,255,0.15), 0 8px 24px rgba(0,0,0,0.5)',
          background: project.settings.transparentBg ? undefined : (project.settings.backgroundColor ?? '#ffffff'),
          cursor:
            isSpacePanning || currentTool === 'pan'
              ? 'grab'
              : currentTool === 'zoom'
                ? 'zoom-in'
                : currentTool === 'transform' || currentTool === 'pen'
                  ? 'default'
                  : currentTool === 'brush' || currentTool === 'line' || currentTool === 'curve' || currentTool === 'eraser' || currentTool === 'warp' || currentTool === 'smudge'
                    ? 'none' // the size-accurate BrushCursor ring replaces the native pointer here
                    : 'crosshair',
        }}
        className={project.settings.transparentBg ? 'checkerboard' : ''}
      >
        {onionSkinLayers.back.map((layer, i) => (
          <img
            key={`onion-back-${i}`}
            src={layer.url}
            alt=""
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: layer.opacity, pointerEvents: 'none' }}
          />
        ))}
        {onionSkinLayers.forward.map((layer, i) => (
          <img
            key={`onion-forward-${i}`}
            src={layer.url}
            alt=""
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: layer.opacity, pointerEvents: 'none' }}
          />
        ))}

        {topLevelLayers.map(renderLayerNode)}

        <PixelArtOverlay
          visible={project.settings.gridVisible}
          gridSize={project.settings.gridSize}
          canvasWidth={project.width}
          canvasHeight={project.height}
          zoom={zoom}
        />
        <GridOverlay canvasWidth={project.width} canvasHeight={project.height} zoom={zoom} />
        <PerspectiveGridOverlay canvasWidth={project.width} canvasHeight={project.height} zoom={zoom} getProjectPoint={getProjectPoint} />
        <SymmetryOverlay canvasWidth={project.width} canvasHeight={project.height} zoom={zoom} getProjectPoint={getProjectPoint} />
        <StudyGuidesOverlay canvasWidth={project.width} canvasHeight={project.height} zoom={zoom} getProjectPoint={getProjectPoint} />
        <FigureOverlay canvasWidth={project.width} canvasHeight={project.height} zoom={zoom} getProjectPoint={getProjectPoint} />
        <GuideLines canvasWidth={project.width} canvasHeight={project.height} zoom={zoom} getProjectPoint={getProjectPoint} />
        <MeshWarpOverlay canvasWidth={project.width} canvasHeight={project.height} zoom={zoom} getProjectPoint={getProjectPoint} />
        <GestureDetector targetRef={stageRef} onZoomBy={zoomBy} />

        {selection && !selectionMask && (
          <div
            style={{
              position: 'absolute',
              left: selection.x,
              top: selection.y,
              width: selection.w,
              height: selection.h,
              border: '1px dashed #5b8cff',
              background: 'rgba(91,140,255,0.12)',
              pointerEvents: 'none',
            }}
          />
        )}

        {selectionMaskPreviewUrl && project && (
          <img
            src={selectionMaskPreviewUrl}
            alt=""
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
          />
        )}

        {lassoPreview.length > 1 && (
          <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
            <polyline
              points={lassoPreview.map((p) => `${p.x},${p.y}`).join(' ')}
              fill="rgba(91,140,255,0.15)"
              stroke="#5b8cff"
              strokeWidth={1 / zoom}
              strokeDasharray={`${4 / zoom} ${4 / zoom}`}
            />
          </svg>
        )}

        {currentLayer?.type === 'vector' && selectedVectorId && (() => {
          const obj = (currentLayer.vectorObjects ?? []).find((o) => o.id === selectedVectorId);
          if (!obj) return null;
          const b = objectBounds(obj);
          return (
            <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
              <rect x={b.x} y={b.y} width={b.w} height={b.h} fill="none" stroke="#5b8cff" strokeWidth={1.5 / zoom} strokeDasharray={`${5 / zoom} ${4 / zoom}`} />
            </svg>
          );
        })()}

        {lineDraft && (
          <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
            {(() => {
              const { a, b, c } = lineDraft;
              const d = c ? `M ${a.x} ${a.y} Q ${c.x} ${c.y} ${b.x} ${b.y}` : `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
              return (
                <>
                  <path d={d} fill="none" stroke={primaryColor} strokeOpacity={0.3} strokeWidth={currentBrush.size} strokeLinecap="round" />
                  <path d={d} fill="none" stroke="#5b8cff" strokeWidth={1.5 / zoom} />
                  {c && <line x1={c.x} y1={c.y} x2={(a.x + b.x) / 2} y2={(a.y + b.y) / 2} stroke="#5b8cff" strokeWidth={1 / zoom} strokeDasharray={`${4 / zoom} ${4 / zoom}`} />}
                  <circle cx={a.x} cy={a.y} r={4 / zoom} fill="#fff" stroke="#5b8cff" strokeWidth={1 / zoom} />
                  <circle cx={b.x} cy={b.y} r={4 / zoom} fill="#fff" stroke="#5b8cff" strokeWidth={1 / zoom} />
                  {c && <circle cx={c.x} cy={c.y} r={4 / zoom} fill="#5b8cff" stroke="#fff" strokeWidth={1 / zoom} />}
                </>
              );
            })()}
          </svg>
        )}

        {gradientPreview && (
          <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
            {gradientToolMode === 'radial' ? (
              <circle
                cx={gradientPreview.start.x}
                cy={gradientPreview.start.y}
                r={Math.hypot(gradientPreview.end.x - gradientPreview.start.x, gradientPreview.end.y - gradientPreview.start.y)}
                fill="none"
                stroke="#5b8cff"
                strokeWidth={1.5 / zoom}
              />
            ) : (
              <line
                x1={gradientPreview.start.x}
                y1={gradientPreview.start.y}
                x2={gradientPreview.end.x}
                y2={gradientPreview.end.y}
                stroke="#5b8cff"
                strokeWidth={1.5 / zoom}
              />
            )}
            <circle cx={gradientPreview.start.x} cy={gradientPreview.start.y} r={4 / zoom} fill={primaryColor} stroke="#fff" strokeWidth={1 / zoom} />
            <circle cx={gradientPreview.end.x} cy={gradientPreview.end.y} r={4 / zoom} fill={secondaryColor} stroke="#fff" strokeWidth={1 / zoom} />
          </svg>
        )}

        {currentTool === 'transform' && transform && !perspectiveWarpMode && (
          <TransformBox
            transform={transform}
            zoom={zoom}
            getProjectPoint={getProjectPoint}
            onChange={setTransform}
            snapFn={snapPos}
            pivot={pivotOverride}
            onPivotChange={setPivotOverride}
          />
        )}
        {currentTool === 'transform' && perspectiveWarpMode && freeCorners && (
          <TransformBox
            transform={transform ?? { x: 0, y: 0, w: 0, h: 0, angle: 0 }}
            zoom={zoom}
            getProjectPoint={getProjectPoint}
            onChange={() => {}}
            perspectiveMode
            freeCorners={freeCorners}
            onFreeCornersChange={setFreeCorners}
          />
        )}

        {currentTool === 'pen' && penPath && (
          <PenOverlay path={penPath} previewPoint={penPreviewPoint} zoom={zoom} />
        )}

        {shapePreviewUrl && (
          <img
            src={shapePreviewUrl}
            alt=""
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
          />
        )}
        {SHAPE_TOOL_KIND[currentTool] && shapeDraft && (
          <TransformBox transform={shapeDraft} zoom={zoom} getProjectPoint={getProjectPoint} onChange={updateShapeDraft} />
        )}
        {pendingSlotA && (
          <div
            className="absolute top-1 left-1 text-[10px] bg-accent text-white px-1.5 py-0.5 rounded pointer-events-none"
            style={{ transform: `scale(${1 / zoom})`, transformOrigin: 'top left' }}
          >
            Forma A guardada
          </div>
        )}

        {vectorTextPreviewUrl && (
          <img
            src={vectorTextPreviewUrl}
            alt=""
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
          />
        )}
        {currentTool === 'vectorText' && textDraft && (
          <TransformBox transform={textDraft} zoom={zoom} getProjectPoint={getProjectPoint} onChange={updateTextDraft} />
        )}
        {vectorTextInputPos && (
          <textarea
            ref={vectorTextAreaRef}
            className="absolute bg-transparent border border-accent outline-none text-black p-1 min-w-[120px]"
            style={{ left: vectorTextInputPos.x, top: vectorTextInputPos.y, fontSize: 24 }}
            onBlur={(e) => {
              const value = e.target.value;
              const pos = vectorTextInputPos;
              setVectorTextInputPos(null);
              if (value.trim() && pos) buildTextDraft(value, pos.x, pos.y);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setVectorTextInputPos(null);
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                (e.target as HTMLTextAreaElement).blur();
              }
            }}
          />
        )}

        {textInput && (
          <textarea
            ref={textAreaRef}
            className="absolute bg-transparent border border-accent outline-none text-black p-1 min-w-[120px]"
            style={{
              left: textInput.x,
              top: textInput.y,
              color: primaryColor,
              fontSize: textStyle.size,
              fontFamily: textStyle.font,
              fontWeight: textStyle.weight,
              textAlign: textStyle.align,
            }}
            onBlur={(e) => {
              if (textToolbarRef.current?.contains(e.relatedTarget as Node)) return;
              commitText(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setTextInput(null);
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                commitText((e.target as HTMLTextAreaElement).value);
              }
            }}
          />
        )}
      </div>

      <BrushCursor containerRef={viewportRef} active={brushCursorActive} diameterPx={brushCursorDiameter} square={brushCursorSquare} />

      {currentTool === 'transform' && transform && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-panel border border-border rounded-full shadow-lg flex items-center gap-2 px-3 py-1.5 text-xs">
          <button
            onClick={() => setPerspectiveWarpMode((v) => !v)}
            title="Arrastrar las 4 esquinas libremente para deformar en perspectiva"
            className={`rounded-full px-2.5 py-1 ${perspectiveWarpMode ? 'bg-accent text-white' : 'text-textDim hover:text-text'}`}
          >
            Modo perspectiva
          </button>
          <span className="text-textDim">Enter para aplicar · Esc para cancelar</span>
          <button onClick={commitTransform} className="bg-accent text-white rounded-full px-2.5 py-1">
            Aplicar
          </button>
          <button onClick={cancelTransform} className="text-textDim hover:text-text px-2 py-1">
            Cancelar
          </button>
        </div>
      )}

      {textInput && (
        <div
          ref={textToolbarRef}
          onMouseDown={(e) => {
            // Buttons don't need to keep real focus to work, so block their click from
            // stealing it from the textarea — but the size <input> and font <select> DO need
            // real focus to be usable (typing a value / opening the dropdown), so let those
            // through; the textarea's onBlur guard (via textToolbarRef) keeps the text open
            // when focus lands on either of them anyway.
            const tag = (e.target as HTMLElement).tagName;
            if (tag !== 'INPUT' && tag !== 'SELECT') e.preventDefault();
          }}
          className="absolute top-3 left-1/2 -translate-x-1/2 bg-panel border border-border rounded-full shadow-lg flex items-center gap-1.5 px-3 py-1.5 text-xs"
        >
          <select
            value={textStyle.font}
            onChange={(e) => setTextStyle((s) => ({ ...s, font: e.target.value }))}
            title="Fuente"
            className="bg-panelLight border border-border rounded text-xs px-1.5 py-0.5 max-w-[90px]"
          >
            {TEXT_FONT_OPTIONS.map((font) => (
              <option key={font} value={font} style={{ fontFamily: font }}>
                {font}
              </option>
            ))}
          </select>
          <input
            type="number"
            min={4}
            max={300}
            value={textStyle.size}
            onChange={(e) => setTextStyle((s) => ({ ...s, size: Math.max(4, Number(e.target.value) || s.size) }))}
            title="Tamaño"
            className="w-12 bg-panelLight border border-border rounded text-xs px-1 py-0.5"
          />
          <button
            onClick={() => setTextStyle((s) => ({ ...s, weight: s.weight === 'bold' ? 'normal' : 'bold' }))}
            title="Negrita"
            className={`p-1 rounded ${textStyle.weight === 'bold' ? 'bg-accent text-white' : 'text-textDim hover:text-text'}`}
          >
            <Bold size={13} />
          </button>
          <div className="w-px h-4 bg-border" />
          {(
            [
              ['left', AlignLeft],
              ['center', AlignCenter],
              ['right', AlignRight],
            ] as const
          ).map(([align, Icon]) => (
            <button
              key={align}
              onClick={() => setTextStyle((s) => ({ ...s, align }))}
              title={`Alinear ${align === 'left' ? 'izquierda' : align === 'center' ? 'centro' : 'derecha'}`}
              className={`p-1 rounded ${textStyle.align === align ? 'bg-accent text-white' : 'text-textDim hover:text-text'}`}
            >
              <Icon size={13} />
            </button>
          ))}
          <div className="w-px h-4 bg-border" />
          <select
            value={textEffect}
            onChange={(e) => setTextEffect(e.target.value as TextEffect)}
            title="Estilo"
            className="bg-panelLight border border-border rounded text-xs px-1.5 py-0.5"
          >
            {(Object.keys(TEXT_EFFECT_LABELS) as TextEffect[]).map((effect) => (
              <option key={effect} value={effect}>
                {TEXT_EFFECT_LABELS[effect]}
              </option>
            ))}
          </select>
          <span className="text-textDim whitespace-nowrap">Enter · Esc</span>
        </div>
      )}

      {currentTool === 'pen' && penPath && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-panel border border-border rounded-full shadow-lg flex items-center gap-2 px-3 py-1.5 text-xs">
          <span className="text-textDim">
            {penPath.closed ? 'Trazado cerrado' : 'Clic para agregar puntos · Enter para terminar · Esc para cancelar'}
          </span>
          <label className="flex items-center gap-1 text-textDim">
            <input type="checkbox" checked={penTextMode} onChange={(e) => setPenTextMode(e.target.checked)} />
            Texto en trazo
          </label>
          {penTextMode ? (
            <>
              <input
                type="text"
                value={penText}
                onChange={(e) => setPenText(e.target.value)}
                placeholder="Texto…"
                className="bg-panelLight border border-border rounded px-1.5 py-0.5 text-xs w-28"
              />
              <input
                type="number"
                value={penTextSize}
                min={8}
                max={200}
                title="Tamaño"
                onChange={(e) => setPenTextSize(Math.max(8, Number(e.target.value)))}
                className="bg-panelLight border border-border rounded px-1 py-0.5 text-xs w-12"
              />
            </>
          ) : (
            <label className="flex items-center gap-1 text-textDim">
              <input type="checkbox" checked={penFillEnabled} disabled={!penPath.closed} onChange={(e) => setPenFillEnabled(e.target.checked)} />
              Rellenar
            </label>
          )}
          <button onClick={commitPenPath} className="bg-accent text-white rounded-full px-2.5 py-1">
            Aplicar
          </button>
          <button onClick={cancelPenPath} className="text-textDim hover:text-text px-2 py-1">
            Cancelar
          </button>
        </div>
      )}
    </div>
  );
}
