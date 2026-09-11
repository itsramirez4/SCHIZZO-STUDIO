import { Fragment, useEffect, useRef, useState } from 'react';
import { useAppStore } from '@/store/appStore';
import { useLayers } from '@/hooks/useLayers';
import { useTools } from '@/hooks/useTools';
import { useBrush } from '@/hooks/useBrush';
import { useCanvas } from '@/hooks/useCanvas';
import { useHistory } from '@/hooks/useHistory';
import * as layerService from '@/services/layer.service';
import { strokeBrush } from '@/services/brush.service';
import { eraseStroke, floodFill, getPixel, withClip } from '@/services/canvas.service';
import { drawStyledText, drawTextAlongPath, DEFAULT_TEXT_OPTIONS, TextEffect, TEXT_EFFECT_LABELS } from '@/services/text.service';
import { getPointerPos } from '@/utils/canvasUtils';
import { hexToRgba, rgbaToHex } from '@/utils/colorUtils';
import { Layer } from '@/types';
import TransformBox, { TransformState } from './TransformBox';
import PixelArtOverlay from './PixelArtOverlay';
import PenOverlay from './PenOverlay';
import { PenPath, distance, drawPathToCanvas } from '@/services/path.service';
import { getFrameLayers } from '@/store/appStore';
import { canvasToDataUrl } from '@/utils/canvasUtils';

interface Point {
  x: number;
  y: number;
}

export default function Canvas2D() {
  const project = useAppStore((s) => s.project);
  const { layers, currentLayerId, currentLayer } = useLayers();
  const { currentTool, primaryColor, secondaryColor, setPrimaryColor } = useTools();
  const { currentBrush } = useBrush();
  const { zoom, panX, panY, setPan, zoomBy, setIsDrawing } = useCanvas();
  const { historyVersion } = useHistory();
  const pushHistory = useAppStore((s) => s.pushHistory);
  const selection = useAppStore((s) => s.selection);
  const setSelection = useAppStore((s) => s.setSelection);
  const clearSelectionArea = useAppStore((s) => s.clearSelectionArea);
  const setCurrentTool = useAppStore((s) => s.setCurrentTool);
  const maskEditLayerId = useAppStore((s) => s.maskEditLayerId);
  const onionSkinEnabled = useAppStore((s) => s.onionSkinEnabled);

  const canvasRefs = useRef<Record<string, HTMLCanvasElement>>({});
  const maskCanvasRefs = useRef<Record<string, HTMLCanvasElement>>({});
  const fillCanvasRefs = useRef<Record<string, HTMLCanvasElement>>({});
  const adjustmentCanvasRefs = useRef<Record<string, HTMLCanvasElement>>({});
  const [maskDataUrls, setMaskDataUrls] = useState<Record<string, string>>({});
  const stageRef = useRef<HTMLDivElement>(null);
  const lastPointRef = useRef<Point | null>(null);
  const panStartRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const selectionStartRef = useRef<Point | null>(null);
  const [textInput, setTextInput] = useState<{ x: number; y: number } | null>(null);
  const [textEffect, setTextEffect] = useState<TextEffect>('normal');
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  const [transform, setTransform] = useState<TransformState | null>(null);
  const originalBoundsRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null);

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
  useEffect(() => {
    const next: Record<string, string> = {};
    layers.forEach((layer) => {
      if (!layer.hasMask) return;
      const maskCanvas = layerService.getMaskCanvas(layer.id);
      if (maskCanvas) next[layer.id] = maskCanvas.toDataURL();
    });
    setMaskDataUrls(next);
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

  // Onion skin: flatten the previous/next frame and show them as faint overlays while
  // animating, so the current frame can be drawn in alignment with its neighbors.
  const [onionSkinUrls, setOnionSkinUrls] = useState<{ prev?: string; next?: string }>({});
  useEffect(() => {
    if (!onionSkinEnabled || !project?.animation) {
      setOnionSkinUrls({});
      return;
    }
    const anim = project.animation;
    const urls: { prev?: string; next?: string } = {};
    if (anim.currentFrameIndex > 0) {
      const prevLayers = getFrameLayers(project, anim.currentFrameIndex - 1);
      urls.prev = canvasToDataUrl(layerService.flattenLayers(prevLayers, project.width, project.height));
    }
    if (anim.currentFrameIndex < anim.frames.length - 1) {
      const nextLayers = getFrameLayers(project, anim.currentFrameIndex + 1);
      urls.next = canvasToDataUrl(layerService.flattenLayers(nextLayers, project.width, project.height));
    }
    setOnionSkinUrls(urls);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onionSkinEnabled, project?.animation?.currentFrameIndex, project?.animation?.frames.length, historyVersion]);

  useEffect(() => {
    if (textInput && textAreaRef.current) textAreaRef.current.focus();
  }, [textInput]);

  // Enter transform mode: seed the box from the active selection, or the whole layer.
  useEffect(() => {
    if (currentTool === 'transform' && currentLayer) {
      const base = selection ?? { x: 0, y: 0, w: currentLayer.width, h: currentLayer.height };
      originalBoundsRef.current = { ...base };
      setTransform({ ...base, angle: 0 });
    } else {
      setTransform(null);
      originalBoundsRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTool, currentLayer?.id]);

  function commitTransform() {
    if (!transform || !currentLayer || !originalBoundsRef.current) return;
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
    ctx.clearRect(ob.x, ob.y, ob.w, ob.h);
    ctx.save();
    ctx.translate(transform.x + transform.w / 2, transform.y + transform.h / 2);
    ctx.rotate(transform.angle);
    ctx.scale(transform.w / srcW, transform.h / srcH);
    ctx.drawImage(temp, -srcW / 2, -srcH / 2);
    ctx.restore();

    pushHistory('Transformar');
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
    const canvasEl = getActiveCanvas(currentLayer);
    if (canvasEl) {
      if (penTextMode && penText.trim()) {
        withClip(canvasEl.getContext('2d')!, selection, () => {
          drawTextAlongPath(canvasEl, penText, penPath, { ...DEFAULT_TEXT_OPTIONS, color: primaryColor, size: penTextSize });
        });
        pushHistory('Texto en trazo');
      } else {
        withClip(canvasEl.getContext('2d')!, selection, () => {
          drawPathToCanvas(canvasEl, penPath, {
            strokeColor: primaryColor,
            strokeWidth: currentBrush.size,
            fillColor: penFillEnabled ? secondaryColor : undefined,
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

  // Enter/Escape apply or cancel the in-progress transform.
  useEffect(() => {
    if (currentTool !== 'transform') return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Enter') {
        e.preventDefault();
        commitTransform();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        cancelTransform();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTool, transform]);

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
      if (currentTool !== 'selection' || !selection) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        clearSelectionArea();
      } else if (e.key === 'Escape') {
        setSelection(null);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [currentTool, selection, clearSelectionArea, setSelection]);

  /** The canvas drawing tools should target: the layer's mask while editing it, else its color canvas. */
  function getActiveCanvas(layer: Layer): HTMLCanvasElement | undefined {
    if (maskEditLayerId === layer.id) return maskCanvasRefs.current[layer.id];
    return canvasRefs.current[layer.id];
  }

  function getPos(e: React.PointerEvent): Point | null {
    const el = currentLayer ? getActiveCanvas(currentLayer) : undefined;
    if (!el) return null;
    return getPointerPos(el, e.clientX, e.clientY);
  }

  function handlePointerDown(e: React.PointerEvent) {
    if (!project || !currentLayer) return;
    try {
      (e.target as Element).setPointerCapture?.(e.pointerId);
    } catch {
      // Some pointer ids can't be captured; drawing still works via the container's move/up handlers.
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

    const pos = getPos(e);
    if (!pos) return;
    const canvasEl = getActiveCanvas(currentLayer);
    if (!canvasEl) return;

    beginDrawing();

    switch (currentTool) {
      case 'brush': {
        lastPointRef.current = pos;
        withClip(canvasEl.getContext('2d')!, selection, () => {
          strokeBrush(canvasEl.getContext('2d')!, [pos], currentBrush, primaryColor);
        });
        break;
      }
      case 'eraser': {
        lastPointRef.current = pos;
        withClip(canvasEl.getContext('2d')!, selection, () => {
          eraseStroke(canvasEl, [pos], eraserSize);
        });
        break;
      }
      case 'paintbucket': {
        floodFill(canvasEl, pos.x, pos.y, hexToRgba(primaryColor), 32, selection ?? undefined);
        pushHistory('Bote de pintura');
        endDrawing();
        break;
      }
      case 'eyedropper': {
        const color = getPixel(canvasEl.getContext('2d')!, pos.x, pos.y);
        setPrimaryColor(rgbaToHex(color));
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

    if (!isDrawingRef.current) return;

    if (currentTool === 'pan' && panStartRef.current) {
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

    if (currentTool === 'brush' && lastPointRef.current) {
      withClip(canvasEl.getContext('2d')!, selection, () => {
        strokeBrush(canvasEl.getContext('2d')!, [lastPointRef.current!, pos], currentBrush, primaryColor);
      });
      lastPointRef.current = pos;
    } else if (currentTool === 'eraser' && lastPointRef.current) {
      withClip(canvasEl.getContext('2d')!, selection, () => {
        eraseStroke(canvasEl, [lastPointRef.current!, pos], eraserSize);
      });
      lastPointRef.current = pos;
    } else if (currentTool === 'selection' && selectionStartRef.current) {
      const start = selectionStartRef.current;
      setSelection({
        x: Math.min(start.x, pos.x),
        y: Math.min(start.y, pos.y),
        w: Math.abs(pos.x - start.x),
        h: Math.abs(pos.y - start.y),
      });
    }
  }

  function handlePointerUp() {
    if (isDrawingRef.current && (currentTool === 'brush' || currentTool === 'eraser')) {
      pushHistory(currentTool === 'brush' ? 'Trazo de pincel' : 'Borrador');
    }
    if (currentTool === 'selection' && selectionStartRef.current && selection && selection.w < 2 && selection.h < 2) {
      setSelection(null);
    }
    penDraggingRef.current = false;
    lastPointRef.current = null;
    panStartRef.current = null;
    selectionStartRef.current = null;
    endDrawing();
  }

  function commitText(value: string) {
    if (value.trim() && currentLayer && textInput) {
      const canvasEl = getActiveCanvas(currentLayer);
      if (canvasEl) {
        drawStyledText(
          canvasEl,
          value,
          textInput.x,
          textInput.y,
          { ...DEFAULT_TEXT_OPTIONS, color: primaryColor },
          textEffect
        );
        pushHistory('Texto');
      }
    }
    setTextInput(null);
  }

  function getProjectPoint(clientX: number, clientY: number): Point {
    const rect = stageRef.current!.getBoundingClientRect();
    return { x: (clientX - rect.left) / zoom, y: (clientY - rect.top) / zoom };
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
    const maskUrl = layer.hasMask ? maskDataUrls[layer.id] : undefined;

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

  return (
    <div
      className="flex-1 relative overflow-auto flex items-center justify-center checkerboard"
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      <div
        ref={stageRef}
        onPointerDown={handlePointerDown}
        style={{
          width: project.width,
          height: project.height,
          transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
          transformOrigin: '0 0',
          position: 'relative',
          boxShadow: '0 0 0 1px rgba(255,255,255,0.15), 0 8px 24px rgba(0,0,0,0.5)',
          background: project.settings.transparentBg ? undefined : '#ffffff',
          cursor:
            currentTool === 'pan'
              ? 'grab'
              : currentTool === 'zoom'
                ? 'zoom-in'
                : currentTool === 'transform' || currentTool === 'pen'
                  ? 'default'
                  : 'crosshair',
        }}
        className={project.settings.transparentBg ? 'checkerboard' : ''}
      >
        {onionSkinUrls.prev && (
          <img
            src={onionSkinUrls.prev}
            alt=""
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.25, pointerEvents: 'none' }}
          />
        )}
        {onionSkinUrls.next && (
          <img
            src={onionSkinUrls.next}
            alt=""
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.15, pointerEvents: 'none' }}
          />
        )}

        {topLevelLayers.map(renderLayerNode)}

        <PixelArtOverlay
          visible={project.settings.gridVisible}
          gridSize={project.settings.gridSize}
          canvasWidth={project.width}
          canvasHeight={project.height}
          zoom={zoom}
        />

        {selection && currentTool === 'selection' && (
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

        {currentTool === 'transform' && transform && (
          <TransformBox transform={transform} zoom={zoom} getProjectPoint={getProjectPoint} onChange={setTransform} />
        )}

        {currentTool === 'pen' && penPath && (
          <PenOverlay path={penPath} previewPoint={penPreviewPoint} zoom={zoom} />
        )}

        {textInput && (
          <textarea
            ref={textAreaRef}
            autoFocus
            className="absolute bg-transparent border border-accent outline-none text-black p-1 min-w-[120px]"
            style={{ left: textInput.x, top: textInput.y, color: primaryColor, fontSize: 24 }}
            onBlur={(e) => commitText(e.target.value)}
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

      {currentTool === 'transform' && transform && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-panel border border-border rounded-full shadow-lg flex items-center gap-2 px-3 py-1.5 text-xs">
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
          onMouseDown={(e) => e.preventDefault()}
          className="absolute top-3 left-1/2 -translate-x-1/2 bg-panel border border-border rounded-full shadow-lg flex items-center gap-2 px-3 py-1.5 text-xs"
        >
          <span className="text-textDim">Estilo</span>
          <select
            value={textEffect}
            onChange={(e) => setTextEffect(e.target.value as TextEffect)}
            className="bg-panelLight border border-border rounded text-xs px-1.5 py-0.5"
          >
            {(Object.keys(TEXT_EFFECT_LABELS) as TextEffect[]).map((effect) => (
              <option key={effect} value={effect}>
                {TEXT_EFFECT_LABELS[effect]}
              </option>
            ))}
          </select>
          <span className="text-textDim">Enter para aplicar · Esc para cancelar</span>
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
