import { v4 as uuid } from 'uuid';
import { Layer, ProjectAnimation } from '@/types';
import { MAX_HISTORY_STATES } from '@/utils/constants';
import {
  layerToDataUrl,
  loadLayerCanvasFromDataUrl,
  maskToDataUrl,
  loadMaskFromDataUrl,
  removeMask,
} from './layer.service';

export interface HistorySnapshot {
  id: string;
  action: string;
  timestamp: string;
  layers: Layer[];
  canvases: Record<string, string>;
  masks: Record<string, string>;
  /**
   * Frame list/index/fps/loop at push time — undefined if animation wasn't enabled yet.
   * `layers` above is always the active frame's content; this just keeps `animation`'s
   * frame count/order/currentFrameIndex in lockstep with it across undo/redo.
   */
  animation?: ProjectAnimation;
}

/**
 * Linear undo/redo stack with a pointer. Each snapshot captures full layer metadata
 * plus a PNG dataURL per layer, so undo/redo can fully restore the canvas registry.
 * Simple over incremental diffs — correct first, and fine at MVP canvas sizes.
 */
export class HistoryManager {
  private stack: HistorySnapshot[] = [];
  private pointer = -1;

  pushState(action: string, layers: Layer[], animation?: ProjectAnimation) {
    const canvases: Record<string, string> = {};
    const masks: Record<string, string> = {};
    for (const layer of layers) {
      const dataUrl = layerToDataUrl(layer.id);
      if (dataUrl) canvases[layer.id] = dataUrl;
      if (layer.hasMask) {
        const maskUrl = maskToDataUrl(layer.id);
        if (maskUrl) masks[layer.id] = maskUrl;
      }
    }

    const snapshot: HistorySnapshot = {
      id: uuid(),
      action,
      timestamp: new Date().toISOString(),
      layers: layers.map((l) => ({ ...l })),
      canvases,
      masks,
      animation: animation ? { ...animation, frames: animation.frames.map((f) => ({ ...f })) } : undefined,
    };

    this.stack = this.stack.slice(0, this.pointer + 1);
    this.stack.push(snapshot);
    if (this.stack.length > MAX_HISTORY_STATES) {
      this.stack.shift();
    }
    this.pointer = this.stack.length - 1;
  }

  canUndo(): boolean {
    return this.pointer > 0;
  }

  canRedo(): boolean {
    return this.pointer < this.stack.length - 1;
  }

  async undo(): Promise<HistorySnapshot | null> {
    if (!this.canUndo()) return null;
    this.pointer--;
    return this.applyCurrent();
  }

  async redo(): Promise<HistorySnapshot | null> {
    if (!this.canRedo()) return null;
    this.pointer++;
    return this.applyCurrent();
  }

  /** Jumps directly to any entry in the stack (the History panel's click-to-restore). */
  async jumpTo(index: number): Promise<HistorySnapshot | null> {
    if (index < 0 || index >= this.stack.length || index === this.pointer) return null;
    this.pointer = index;
    return this.applyCurrent();
  }

  private async applyCurrent(): Promise<HistorySnapshot> {
    const snapshot = this.stack[this.pointer];
    await Promise.all(
      snapshot.layers.flatMap((layer) => {
        const tasks: Promise<void>[] = [];
        const dataUrl = snapshot.canvases[layer.id];
        if (dataUrl) tasks.push(loadLayerCanvasFromDataUrl(layer.id, dataUrl, layer.width, layer.height));

        const maskUrl = snapshot.masks[layer.id];
        if (layer.hasMask && maskUrl) {
          tasks.push(loadMaskFromDataUrl(layer.id, maskUrl, layer.width, layer.height));
        } else if (!layer.hasMask) {
          removeMask(layer.id);
        }
        return tasks;
      })
    );
    return snapshot;
  }

  clear() {
    this.stack = [];
    this.pointer = -1;
  }

  getStack(): HistorySnapshot[] {
    return this.stack;
  }

  getPointer(): number {
    return this.pointer;
  }
}
