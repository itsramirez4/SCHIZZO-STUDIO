import { useAppStore } from '@/store/appStore';

export function useLayers() {
  const project = useAppStore((s) => s.project);
  const currentLayerId = useAppStore((s) => s.currentLayerId);

  return {
    layers: project?.layers ?? [],
    currentLayerId,
    currentLayer: project?.layers.find((l) => l.id === currentLayerId) ?? null,
    addLayer: useAppStore((s) => s.addLayer),
    addReferenceLayer: useAppStore((s) => s.addReferenceLayer),
    addVectorLayer: useAppStore((s) => s.addVectorLayer),
    deleteLayer: useAppStore((s) => s.deleteLayer),
    duplicateLayer: useAppStore((s) => s.duplicateLayer),
    renameLayer: useAppStore((s) => s.renameLayer),
    setLayerOpacity: useAppStore((s) => s.setLayerOpacity),
    commitLayerOpacity: useAppStore((s) => s.commitLayerOpacity),
    setLayerBlendMode: useAppStore((s) => s.setLayerBlendMode),
    setLayerVisibility: useAppStore((s) => s.setLayerVisibility),
    setLayerLocked: useAppStore((s) => s.setLayerLocked),
    reorderLayers: useAppStore((s) => s.reorderLayers),
    selectLayer: useAppStore((s) => s.selectLayer),
    mergeLayerDown: useAppStore((s) => s.mergeLayerDown),
    addAdjustmentLayer: useAppStore((s) => s.addAdjustmentLayer),
    setAdjustmentParams: useAppStore((s) => s.setAdjustmentParams),
    commitAdjustmentParams: useAppStore((s) => s.commitAdjustmentParams),
    addFillLayer: useAppStore((s) => s.addFillLayer),
    setFillType: useAppStore((s) => s.setFillType),
    setFillProps: useAppStore((s) => s.setFillProps),
    commitFillProps: useAppStore((s) => s.commitFillProps),
  };
}
