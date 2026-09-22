import { useAppStore, historyManager } from '@/store/appStore';
import { useUIStore } from '@/store/uiStore';
import { useAiStore } from '@/store/aiStore';
import * as layerService from '@/services/layer.service';
import * as filterService from '@/services/filter.service';
import * as comicService from '@/services/comic.service';
import * as canvasService from '@/services/canvas.service';
import * as animationService from '@/services/animation.service';

/**
 * Lets `npm run check` (scripts/check.cjs) inspect and drive the app. It only exists when the page
 * sets `localStorage['schizzo:check'] = '1'`, which the check script does and nothing else does.
 */
export function installCheckHook() {
  try {
    if (localStorage.getItem('schizzo:check') !== '1') return;
  } catch {
    return;
  }
  (window as unknown as { __schizzo: unknown }).__schizzo = {
    store: useAppStore,
    ui: useUIStore,
    ai: useAiStore,
    history: historyManager,
    layers: layerService,
    filters: filterService,
    comic: comicService,
    canvas: canvasService,
    animation: animationService,
  };
}
