import { useAppStore, historyManager } from '@/store/appStore';
import { useUIStore } from '@/store/uiStore';
import { useAiStore } from '@/store/aiStore';
import * as layerService from '@/services/layer.service';
import * as filterService from '@/services/filter.service';
import * as comicService from '@/services/comic.service';
import * as canvasService from '@/services/canvas.service';
import * as animationService from '@/services/animation.service';
import * as geometryFiltersService from '@/services/geometryFilters.service';
import * as cleanupService from '@/services/ai/cleanup.service';
import * as compositionService from '@/services/ai/composition.service';
import * as layerSeparationService from '@/services/ai/layerSeparation.service';
import * as paletteSuggestService from '@/services/ai/paletteSuggest.service';
import * as poseFitService from '@/services/ai/poseFit.service';
import * as referencePromptService from '@/services/ai/referencePrompt.service';
import * as relightService from '@/services/ai/relight.service';
import * as textToPoseService from '@/services/ai/textToPose.service';

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
    geometry: geometryFiltersService,
    aiCleanup: cleanupService,
    aiComposition: compositionService,
    aiLayerSeparation: layerSeparationService,
    aiPalette: paletteSuggestService,
    aiPoseFit: poseFitService,
    aiReferencePrompt: referencePromptService,
    aiRelight: relightService,
    aiTextToPose: textToPoseService,
    // Kept as a dynamic import (not a top-level one) so this hook never pulls TensorFlow.js into
    // the main bundle — pose detection stays lazily loaded exactly like the real "detect" button.
    loadPoseDetect: () => import('@/services/poseDetect.service'),
  };
}
