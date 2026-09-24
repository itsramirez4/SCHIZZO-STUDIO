/**
 * Lets `npm run check` (scripts/check.cjs) inspect and drive the app. It only exists when the page
 * sets `localStorage['schizzo:check'] = '1'`, which the check script does and nothing else does.
 * Every module below is dynamically imported (not a top-level import) so none of this — including
 * the AI assistant's service layer and, through poseFit/mannequin, three.js — ever lands in the
 * real startup bundle for the 100% of launches where this hook never activates.
 */
export async function installCheckHook() {
  try {
    if (localStorage.getItem('schizzo:check') !== '1') return;
  } catch {
    return;
  }
  const [
    { useAppStore, historyManager },
    { useUIStore },
    { useAiStore },
    layerService,
    filterService,
    comicService,
    canvasService,
    animationService,
    geometryFiltersService,
    cleanupService,
    compositionService,
    layerSeparationService,
    paletteSuggestService,
    poseFitService,
    referencePromptService,
    relightService,
    textToPoseService,
  ] = await Promise.all([
    import('@/store/appStore'),
    import('@/store/uiStore'),
    import('@/store/aiStore'),
    import('@/services/layer.service'),
    import('@/services/filter.service'),
    import('@/services/comic.service'),
    import('@/services/canvas.service'),
    import('@/services/animation.service'),
    import('@/services/geometryFilters.service'),
    import('@/services/ai/cleanup.service'),
    import('@/services/ai/composition.service'),
    import('@/services/ai/layerSeparation.service'),
    import('@/services/ai/paletteSuggest.service'),
    import('@/services/ai/poseFit.service'),
    import('@/services/ai/referencePrompt.service'),
    import('@/services/ai/relight.service'),
    import('@/services/ai/textToPose.service'),
  ]);
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
