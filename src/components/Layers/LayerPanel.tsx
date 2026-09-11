import { useRef, useState, type ReactNode } from 'react';
import { Plus, FolderPlus, Image as ImageIcon } from 'lucide-react';
import { Layer, AdjustmentType, FillType } from '@/types';
import { ADJUSTMENT_LABELS } from '@/services/filter.service';
import { importReferenceImages } from '@/services/importImage';
import { useLayers } from '@/hooks/useLayers';
import { useAppStore } from '@/store/appStore';
import LayerItem from './LayerItem';

const FILL_TYPE_LABELS: Record<FillType, string> = { solid: 'Color sólido', gradient: 'Degradado', pattern: 'Patrón' };

export default function LayerPanel() {
  const { layers, currentLayerId, addLayer, reorderLayers, addAdjustmentLayer, addFillLayer, addReferenceLayer } = useLayers();
  const createGroup = useAppStore((s) => s.createGroup);
  const setLayerParent = useAppStore((s) => s.setLayerParent);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const draggedIdRef = useRef<string | null>(null);

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
        <span className="text-xs font-semibold">Capas</span>
        <div className="flex items-center gap-1">
          <select
            value=""
            onChange={(e) => {
              if (e.target.value) addAdjustmentLayer(e.target.value as AdjustmentType);
              e.target.value = '';
            }}
            title="Nueva capa de ajuste"
            className="bg-panel border border-border rounded text-[10px] text-textDim hover:text-text px-0.5 py-0.5 max-w-[64px]"
          >
            <option value="">+ Ajuste</option>
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
            title="Nueva capa de relleno"
            className="bg-panel border border-border rounded text-[10px] text-textDim hover:text-text px-0.5 py-0.5 max-w-[62px]"
          >
            <option value="">+ Relleno</option>
            {(Object.keys(FILL_TYPE_LABELS) as FillType[]).map((type) => (
              <option key={type} value={type}>
                {FILL_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
          <button
            onClick={() => importReferenceImages(addReferenceLayer)}
            className="text-textDim hover:text-text"
            title="Importar imagen de referencia"
          >
            <ImageIcon size={14} />
          </button>
          <button onClick={() => createGroup()} className="text-textDim hover:text-text" title="Nuevo grupo">
            <FolderPlus size={15} />
          </button>
          <button onClick={() => addLayer()} className="text-textDim hover:text-text" title="Nueva capa">
            <Plus size={16} />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">{siblingsOf(undefined).map((layer) => renderNode(layer, 0))}</div>
    </div>
  );
}
