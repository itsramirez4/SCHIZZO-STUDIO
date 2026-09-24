import { useRef, useState, type ReactNode } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { Plus, FolderPlus, Image as ImageIcon, Group, GitMerge, Layers, X, Eye, EyeOff, Lock, Unlock, Camera, Trash2, ChevronDown, ChevronRight, Shapes } from 'lucide-react';
import { Layer, AdjustmentType, FillType } from '@/types';
import { ADJUSTMENT_LABELS } from '@/services/filter.service';
import { importReferenceImages } from '@/services/importImage';
import { useLayers } from '@/hooks/useLayers';
import { useAppStore } from '@/store/appStore';
import LayerItem from './LayerItem';

const FILL_TYPE_IDS: FillType[] = ['solid', 'gradient', 'pattern'];

export default function LayerPanel() {
  const { t } = useTranslation('panelsPaint');
  const { layers, currentLayerId, addLayer, reorderLayers, addAdjustmentLayer, addFillLayer, addReferenceLayer, addVectorLayer } = useLayers();
  const createGroup = useAppStore((s) => s.createGroup);
  const setLayerParent = useAppStore((s) => s.setLayerParent);
  const selectedLayerIds = useAppStore((s) => s.selectedLayerIds);
  const clearLayerSelection = useAppStore((s) => s.clearLayerSelection);
  const groupSelectedLayers = useAppStore((s) => s.groupSelectedLayers);
  const mergeVisibleLayers = useAppStore((s) => s.mergeVisibleLayers);
  const flattenImage = useAppStore((s) => s.flattenImage);
  const setSelectedLayersVisibility = useAppStore((s) => s.setSelectedLayersVisibility);
  const setSelectedLayersLocked = useAppStore((s) => s.setSelectedLayersLocked);
  const project = useAppStore((s) => s.project);
  const captureLayerComp = useAppStore((s) => s.captureLayerComp);
  const applyLayerComp = useAppStore((s) => s.applyLayerComp);
  const deleteLayerComp = useAppStore((s) => s.deleteLayerComp);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const draggedIdRef = useRef<string | null>(null);
  const [compsOpen, setCompsOpen] = useState(false);
  const [newCompName, setNewCompName] = useState('');

  const groups = layers.filter((l) => l.type === 'group');

  function siblingsOf(parentId?: string) {
    return layers.filter((l) => l.parent === parentId);
  }

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function moveSibling(layer: Layer, direction: 'up' | 'down') {
    const siblings = siblingsOf(layer.parent);
    const idx = siblings.findIndex((l) => l.id === layer.id);
    const target = direction === 'up' ? siblings[idx - 1] : siblings[idx + 1];
    if (!target) return;
    const fullA = layers.findIndex((l) => l.id === layer.id);
    const fullB = layers.findIndex((l) => l.id === target.id);
    const next = [...layers];
    [next[fullA], next[fullB]] = [next[fullB], next[fullA]];
    reorderLayers(next);
  }

  /** True if `id` sits anywhere inside the subtree rooted at `ancestorId` (or is it). */
  function isInSubtree(ancestorId: string, id: string | undefined): boolean {
    let cursor = id;
    while (cursor) {
      if (cursor === ancestorId) return true;
      cursor = layers.find((l) => l.id === cursor)?.parent;
    }
    return false;
  }

  function handleDrop(targetLayer: Layer) {
    const draggedId = draggedIdRef.current;
    setDragOverId(null);
    draggedIdRef.current = null;
    if (!draggedId || draggedId === targetLayer.id) return;
    const dragged = layers.find((l) => l.id === draggedId);
    if (!dragged) return;
    // Refuse drops that would nest a layer/group inside its own subtree.
    if (isInSubtree(draggedId, targetLayer.id)) return;

    if (targetLayer.type === 'group') {
      setLayerParent(draggedId, targetLayer.id);
      setExpanded((prev) => new Set(prev).add(targetLayer.id));
      return;
    }

    const withoutDragged = layers.filter((l) => l.id !== draggedId);
    const targetIndex = withoutDragged.findIndex((l) => l.id === targetLayer.id);
    const reparented = dragged.parent === targetLayer.parent ? dragged : { ...dragged, parent: targetLayer.parent };
    const next = [...withoutDragged.slice(0, targetIndex), reparented, ...withoutDragged.slice(targetIndex)];
    reorderLayers(next);
  }

  function renderNode(layer: Layer, depth: number): ReactNode {
    const isGroup = layer.type === 'group';
    const siblings = siblingsOf(layer.parent);
    const idx = siblings.findIndex((l) => l.id === layer.id);
    const children = isGroup ? siblingsOf(layer.id) : [];
    const isExpanded = expanded.has(layer.id);

    return (
      <div key={layer.id}>
        <LayerItem
          layer={layer}
          depth={depth}
          groups={groups}
          isActive={layer.id === currentLayerId}
          canMoveUp={idx > 0}
          canMoveDown={idx < siblings.length - 1}
          onMove={(dir) => moveSibling(layer, dir)}
          isExpanded={isExpanded}
          onToggleExpand={isGroup ? () => toggleExpand(layer.id) : undefined}
          isDragOver={dragOverId === layer.id}
          onDragStart={() => {
            draggedIdRef.current = layer.id;
          }}
          onDragOverRow={() => setDragOverId(layer.id)}
          onDragLeaveRow={() => setDragOverId((id) => (id === layer.id ? null : id))}
          onDropRow={() => handleDrop(layer)}
          onDragEndRow={() => {
            draggedIdRef.current = null;
            setDragOverId(null);
          }}
        />
        {isGroup && isExpanded && children.map((child) => renderNode(child, depth + 1))}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-2 border-b border-border">
        <span className="text-xs font-semibold">{t('layerPanel.title')}</span>
        <div className="flex items-center gap-1">
          <select
            value=""
            onChange={(e) => {
              if (e.target.value) addAdjustmentLayer(e.target.value as AdjustmentType);
              e.target.value = '';
            }}
            title={t('layerPanel.newAdjustmentLayerTitle')}
            className="bg-panel border border-border rounded text-[10px] text-textDim hover:text-text px-0.5 py-0.5 max-w-[64px]"
          >
            <option value="">{t('layerPanel.addAdjustment')}</option>
            {(Object.keys(ADJUSTMENT_LABELS) as AdjustmentType[]).map((type) => (
              <option key={type} value={type}>
                {ADJUSTMENT_LABELS[type]}
              </option>
            ))}
          </select>
          <select
            value=""
            onChange={(e) => {
              if (e.target.value) addFillLayer(e.target.value as FillType);
              e.target.value = '';
            }}
            title={t('layerPanel.newFillLayerTitle')}
            className="bg-panel border border-border rounded text-[10px] text-textDim hover:text-text px-0.5 py-0.5 max-w-[62px]"
          >
            <option value="">{t('layerPanel.addFill')}</option>
            {FILL_TYPE_IDS.map((type) => (
              <option key={type} value={type}>
                {t(`layerPanel.fillTypes.${type}`)}
              </option>
            ))}
          </select>
          <button
            onClick={() => importReferenceImages(addReferenceLayer)}
            className="text-textDim hover:text-text"
            title={t('layerPanel.importReferenceTitle')}
          >
            <ImageIcon size={14} />
          </button>
          <button onClick={() => addVectorLayer()} className="text-textDim hover:text-text" title={t('layerPanel.newVectorLayerTitle')}>
            <Shapes size={14} />
          </button>
          <button onClick={() => createGroup()} className="text-textDim hover:text-text" title={t('layerPanel.newGroupTitle')}>
            <FolderPlus size={15} />
          </button>
          <button onClick={mergeVisibleLayers} className="text-textDim hover:text-text" title={t('layerPanel.mergeVisibleTitle')}>
            <GitMerge size={14} />
          </button>
          <button
            onClick={() => {
              if (!flattenImage()) toast(t('layerPanel.nothingToFlattenToast'));
            }}
            className="text-textDim hover:text-text"
            title={t('layerPanel.flattenTitle')}
          >
            <Layers size={14} />
          </button>
          <button onClick={() => addLayer()} className="text-textDim hover:text-text" title={t('layerPanel.newLayerTitle')}>
            <Plus size={16} />
          </button>
        </div>
      </div>
      {selectedLayerIds.length > 0 && (
        <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-border bg-accent/10 text-[10px]">
          <span className="text-textDim">{t('layerPanel.selectedCount', { count: selectedLayerIds.length })}</span>
          <button onClick={() => groupSelectedLayers()} title={t('layerPanel.groupSelectionTitle')} className="text-textDim hover:text-text ml-auto">
            <Group size={13} />
          </button>
          <button onClick={() => setSelectedLayersVisibility(true)} title={t('layerPanel.showAllTitle')} className="text-textDim hover:text-text">
            <Eye size={13} />
          </button>
          <button onClick={() => setSelectedLayersVisibility(false)} title={t('layerPanel.hideAllTitle')} className="text-textDim hover:text-text">
            <EyeOff size={13} />
          </button>
          <button onClick={() => setSelectedLayersLocked(true)} title={t('layerPanel.lockAllTitle')} className="text-textDim hover:text-text">
            <Lock size={13} />
          </button>
          <button onClick={() => setSelectedLayersLocked(false)} title={t('layerPanel.unlockAllTitle')} className="text-textDim hover:text-text">
            <Unlock size={13} />
          </button>
          <button onClick={clearLayerSelection} title={t('layerPanel.deselectTitle')} className="text-textDim hover:text-red-400">
            <X size={13} />
          </button>
        </div>
      )}
      <div className="flex-1 overflow-y-auto">{siblingsOf(undefined).map((layer) => renderNode(layer, 0))}</div>

      <div className="border-t border-border">
        <button
          onClick={() => setCompsOpen((v) => !v)}
          className="w-full flex items-center gap-1.5 px-2 py-1.5 text-[10px] text-textDim hover:text-text"
        >
          {compsOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          {t('layerPanel.scenesToggle')}
        </button>
        {compsOpen && (
          <div className="px-2 pb-2 space-y-1.5">
            <p className="text-[9px] text-textDim">{t('layerPanel.scenesDescription')}</p>
            <div className="flex gap-1">
              <input
                type="text"
                value={newCompName}
                onChange={(e) => setNewCompName(e.target.value)}
                placeholder={t('layerPanel.scenesNamePlaceholder')}
                className="flex-1 bg-panel border border-border rounded text-[10px] px-1.5 py-1"
              />
              <button
                onClick={() => {
                  const name = newCompName.trim();
                  if (!name) return;
                  captureLayerComp(name);
                  setNewCompName('');
                }}
                disabled={!newCompName.trim()}
                title={t('layerPanel.captureTitle')}
                className="text-[10px] bg-panelLight rounded px-2 disabled:opacity-40"
              >
                <Camera size={12} />
              </button>
            </div>
            {(project?.layerComps ?? []).length === 0 ? (
              <p className="text-[9px] text-textDim">{t('layerPanel.noScenesYet')}</p>
            ) : (
              <div className="space-y-1">
                {project!.layerComps!.map((comp) => (
                  <div key={comp.id} className="flex items-center gap-1.5 text-[10px] bg-panel rounded px-1.5 py-1">
                    <span className="flex-1 truncate">{comp.name}</span>
                    <button onClick={() => applyLayerComp(comp.id)} className="text-[9px] bg-panelLight rounded px-2 py-0.5">
                      {t('layerPanel.apply')}
                    </button>
                    <button onClick={() => deleteLayerComp(comp.id)} className="text-textDim hover:text-red-400" title={t('layerPanel.deleteTitle')}>
                      <Trash2 size={11} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
