import { v4 as uuid } from 'uuid';
import { Layer, ProjectAnimation } from '@/types';
import { HISTORY_IN_MEMORY } from '@/utils/constants';
import { IdbStore } from '@/utils/idbStore';
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
  /** True while `canvases`/`masks` have been moved to IndexedDB (empty in memory) to free RAM. */
  spilled?: boolean;
}

interface SpilledPixels {
  canvases: Record<string, string>;
  masks: Record<string, string>;
}

/**
 * Linear undo/redo stack with a pointer. Each snapshot captures full layer metadata
 * plus a PNG dataURL per layer, so undo/redo can fully restore the canvas registry.
 * Simple over incremental diffs — correct first, and fine at MVP canvas sizes.
 */
export class HistoryManager {
  private stack: HistorySnapshot[] = [];
  private pointer = -1;
  /** Pixel data of snapshots outside the in-memory window lives here, keyed by snapshot id. */
  private disk: IdbStore | null = typeof indexedDB !== 'undefined' ? new IdbStore('schizzo-undo-history') : null;
  /** In-flight writes, so an undo that reaches a snapshot still being spilled waits for it. */
  private pending = new Map<string, Promise<void>>();

  constructor() {
    // The undo history is per session: drop whatever a previous run left behind.
    this.disk?.clear().catch(() => undefined);
  }

  pushState(action: string, layers: Layer[], animation?: ProjectAnimation) {
    const canvases: Record<string, string> = {};
    const masks: Record<string, string> = {};
    for (const layer of layers) {
      let dataUrl = layerToDataUrl(layer.id);
      // Untouched layers produce an identical PNG: share the previous string instead of holding a copy.
      const prev = this.stack[this.pointer]?.canvases[layer.id];
      if (dataUrl && prev !== undefined && prev === dataUrl) dataUrl = prev;
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

    // Pushing after undoing discards the redo branch — including its spilled data.
    for (const dropped of this.stack.slice(this.pointer + 1)) this.dropFromDisk(dropped);
    this.stack = this.stack.slice(0, this.pointer + 1);
    this.stack.push(snapshot);
    this.pointer = this.stack.length - 1;
    this.spillOld();
  }

  /** Moves the pixel data of snapshots far from the pointer to IndexedDB. */
  private spillOld() {
    if (!this.disk) return;
    const lo = this.pointer - HISTORY_IN_MEMORY;
    const hi = this.pointer + HISTORY_IN_MEMORY;
    this.stack.forEach((snap, i) => {
      if (snap.spilled || (i >= lo && i <= hi)) return;
      const data: SpilledPixels = { canvases: snap.canvases, masks: snap.masks };
      snap.spilled = true;
      snap.canvases = {};
      snap.masks = {};
      const write = this.disk!.set(snap.id, data)
        .then(() => undefined)
        .catch(() => {
          // Could not write (quota?): put the data back so this state stays restorable.
          snap.canvases = data.canvases;
          snap.masks = data.masks;
          snap.spilled = false;
        })
        .finally(() => {
          this.pending.delete(snap.id);
        });
      this.pending.set(snap.id, write);
    });
  }

  private dropFromDisk(snap: HistorySnapshot) {
    if (snap.spilled) this.disk?.delete(snap.id).catch(() => undefined);
  }

  private async restoreFromDisk(snap: HistorySnapshot) {
    if (!snap.spilled) return;
    await this.pending.get(snap.id);
    if (!snap.spilled) return; // the write failed and rolled back
    const data = await this.disk!.get<SpilledPixels>(snap.id);
    if (!data) throw new Error('Un estado antiguo del historial ya no está en disco');
    snap.canvases = data.canvases;
    snap.masks = data.masks;
    snap.spilled = false;
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
    await this.restoreFromDisk(snapshot);
    this.spillOld();
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
    this.pending.clear();
    this.disk?.clear().catch(() => undefined);
  }

  getStack(): HistorySnapshot[] {
    return this.stack;
  }

  getPointer(): number {
    return this.pointer;
  }
}
