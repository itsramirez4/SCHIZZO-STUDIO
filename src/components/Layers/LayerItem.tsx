import { useState } from 'react';
import {
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Copy,
  Trash2,
  ChevronUp,
  ChevronDown,
  ChevronRight,
  Folder,
  FolderOpen,
  Contrast,
  Droplet,
  X,
  FlipHorizontal,
  FlipVertical,
  SlidersHorizontal,
  PaintBucket,
  Image as ImageIcon,
  Sparkles,
  Scissors,
  Link2,
  Grid2x2,
} from 'lucide-react';
import { Layer } from '@/types';
import { BLEND_MODES } from '@/utils/constants';
import { useLayers } from '@/hooks/useLayers';
import { useAppStore } from '@/store/appStore';
import * as layerService from '@/services/layer.service';
import { flipHorizontal, flipVertical } from '@/services/canvas.service';
import AdjustmentEditor from './AdjustmentEditor';
import FillEditor from './FillEditor';
import LayerEffectsEditor from './LayerEffectsEditor';
import { hasAnyEnabledEffect } from '@/services/layerEffects.service';

interface Props {
  layer: Layer;
  depth: number;
  groups: Layer[];
  isActive: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMove: (direction: 'up' | 'down') => void;
  isExpanded: boolean;
  onToggleExpand?: () => void;
  isDragOver: boolean;
  onDragStart: () => void;
  onDragOverRow: () => void;
  onDragLeaveRow: () => void;
  onDropRow: () => void;
  onDragEndRow: () => void;
}

export default function LayerItem({
  layer,
  depth,
  groups,
  isActive,
  canMoveUp,
  canMoveDown,
  onMove,
  isExpanded,
  onToggleExpand,
  isDragOver,
  onDragStart,
  onDragOverRow,
  onDragLeaveRow,
  onDropRow,
  onDragEndRow,
}: Props) {
  const {
    selectLayer,
    renameLayer,
    setLayerOpacity,
    commitLayerOpacity,
    setLayerBlendMode,
    setLayerVisibility,
    setLayerLocked,
    duplicateLayer,
    deleteLayer,
  } = useLayers();
  const setLayerParent = useAppStore((s) => s.setLayerParent);
  const setLayerAlphaLock = useAppStore((s) => s.setLayerAlphaLock);
  const pushHistory = useAppStore((s) => s.pushHistory);
  const invertLayerColors = useAppStore((s) => s.invertLayerColors);
  const desaturateLayerColors = useAppStore((s) => s.desaturateLayerColors);
  const isolatedLayerId = useAppStore((s) => s.isolatedLayerId);
  const toggleIsolateLayer = useAppStore((s) => s.toggleIsolateLayer);
  const addMaskToLayer = useAppStore((s) => s.addMaskToLayer);
  const removeMaskFromLayer = useAppStore((s) => s.removeMaskFromLayer);
  const featherLayerMask = useAppStore((s) => s.featherLayerMask);
  const invertLayerMask = useAppStore((s) => s.invertLayerMask);
  const maskEditLayerId = useAppStore((s) => s.maskEditLayerId);
  const setMaskEditLayerId = useAppStore((s) => s.setMaskEditLayerId);
  const setLayerClipTo = useAppStore((s) => s.setLayerClipTo);
  const createLinkedInstance = useAppStore((s) => s.createLinkedInstance);
  const selectedLayerIds = useAppStore((s) => s.selectedLayerIds);
  const toggleLayerSelection = useAppStore((s) => s.toggleLayerSelection);
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(layer.name);
  const [showEffects, setShowEffects] = useState(false);

  const isGroup = layer.type === 'group';
  const isEditingMask = maskEditLayerId === layer.id;
  const otherGroups = groups.filter((g) => g.id !== layer.id);
  const isMultiSelected = selectedLayerIds.includes(layer.id);

  return (
    <div
      onClick={(e) => {
        if (e.shiftKey || e.ctrlKey || e.metaKey) {
          toggleLayerSelection(layer.id, true);
        } else {
          selectLayer(layer.id);
        }
      }}
      draggable={!editingName}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move';
        onDragStart();
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        onDragOverRow();
      }}
      onDragLeave={onDragLeaveRow}
      onDrop={(e) => {
        e.preventDefault();
        onDropRow();
      }}
      onDragEnd={onDragEndRow}
      style={{ paddingLeft: 8 + depth * 14 }}
      className={`p-2 pr-2 border-b cursor-move ${isDragOver ? 'border-accent bg-accent/10' : 'border-border'} ${
        isMultiSelected ? 'bg-accent/20' : isActive ? 'bg-panelLight' : 'hover:bg-panelLight/50'
      }`}
    >
      <div className="flex items-center gap-1">
        {isGroup ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand?.();
            }}
            className="text-textDim hover:text-text"
          >
            {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          </button>
        ) : (
          <span className="w-[13px]" />
        )}

        <button
          onClick={(e) => {
            e.stopPropagation();
            if (e.altKey) toggleIsolateLayer(layer.id);
            else setLayerVisibility(layer.id, !layer.visible);
          }}
          title={isolatedLayerId === layer.id ? 'Aislada — Alt+clic para restaurar las demás' : 'Alt+clic para aislar (ver solo esta capa)'}
          className={isolatedLayerId === layer.id ? 'text-accent' : 'text-textDim hover:text-text'}
        >
          {layer.visible ? <Eye size={14} /> : <EyeOff size={14} />}
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setLayerLocked(layer.id, !layer.locked);
          }}
          className="text-textDim hover:text-text"
        >
          {layer.locked ? <Lock size={14} /> : <Unlock size={14} />}
        </button>
        {layer.type === 'raster' && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setLayerAlphaLock(layer.id, !layer.lockAlpha);
            }}
            title={layer.lockAlpha ? 'Transparencia bloqueada — pintar solo sobre píxeles existentes' : 'Bloquear transparencia'}
            className={`hover:text-text ${layer.lockAlpha ? 'text-accent' : 'text-textDim'}`}
          >
            <Grid2x2 size={13} />
          </button>
        )}

        {isGroup && (isExpanded ? <FolderOpen size={13} className="text-textDim" /> : <Folder size={13} className="text-textDim" />)}
        {layer.type === 'adjustment' && <SlidersHorizontal size={12} className="text-textDim shrink-0" />}
        {layer.type === 'fill' && <PaintBucket size={12} className="text-textDim shrink-0" />}
        {layer.type === 'reference' && <ImageIcon size={12} className="text-textDim shrink-0" />}

        {editingName ? (
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => {
              setEditingName(false);
              renameLayer(layer.id, name.trim() || layer.name);
            }}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 bg-panel border border-accent rounded px-1 text-xs min-w-0"
          />
        ) : (
          <span
            onDoubleClick={(e) => {
              e.stopPropagation();
              setEditingName(true);
            }}
            className="flex-1 text-xs truncate"
          >
            {layer.name}
          </span>
        )}

        {!isGroup && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (layer.hasMask) {
                setMaskEditLayerId(isEditingMask ? null : layer.id);
                if (!isActive) selectLayer(layer.id);
              } else {
                addMaskToLayer(layer.id);
              }
            }}
            title={layer.hasMask ? 'Editar máscara' : 'Añadir máscara'}
            className={`hover:text-text ${isEditingMask ? 'text-accent' : layer.hasMask ? 'text-text' : 'text-textDim'}`}
          >
            <Contrast size={13} />
          </button>
        )}
        {!isGroup && layer.hasMask && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              removeMaskFromLayer(layer.id);
            }}
            title="Quitar máscara"
            className="text-textDim hover:text-red-400"
          >
            <X size={12} />
          </button>
        )}
        {(layer.type === 'raster' || layer.type === 'fill') && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowEffects((v) => !v);
              if (!isActive) selectLayer(layer.id);
            }}
            title="Efectos de capa"
            className={`hover:text-text ${hasAnyEnabledEffect(layer.effects) ? 'text-accent' : 'text-textDim'}`}
          >
            <Sparkles size={13} />
          </button>
        )}
        {!isGroup && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setLayerClipTo(layer.id, !layer.clipTo);
            }}
            title={layer.clipTo ? 'Quitar recorte a la capa de abajo' : 'Recortar a la capa de abajo'}
            className={`hover:text-text ${layer.clipTo ? 'text-accent' : 'text-textDim'}`}
          >
            <Scissors size={13} />
          </button>
        )}
        {layer.type === 'raster' && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              createLinkedInstance(layer.id);
            }}
            title="Crear instancia vinculada (comparte contenido, estilo independiente)"
            className="text-textDim hover:text-text"
          >
            <Link2 size={13} />
          </button>
        )}

        <div className="flex flex-col">
          <button disabled={!canMoveUp} onClick={(e) => { e.stopPropagation(); onMove('up'); }} className="text-textDim hover:text-text disabled:opacity-20">
            <ChevronUp size={12} />
          </button>
          <button disabled={!canMoveDown} onClick={(e) => { e.stopPropagation(); onMove('down'); }} className="text-textDim hover:text-text disabled:opacity-20">
            <ChevronDown size={12} />
          </button>
        </div>
        <button onClick={(e) => { e.stopPropagation(); duplicateLayer(layer.id); }} className="text-textDim hover:text-text" title="Duplicar">
          <Copy size={13} />
        </button>
        <button onClick={(e) => { e.stopPropagation(); deleteLayer(layer.id); }} className="text-textDim hover:text-red-400" title="Eliminar">
          <Trash2 size={13} />
        </button>
      </div>

      {isActive && (
        <div className="mt-2 space-y-1" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-textDim w-14">Opacidad</span>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(layer.opacity * 100)}
              onChange={(e) => setLayerOpacity(layer.id, Number(e.target.value) / 100)}
              onPointerUp={commitLayerOpacity}
              onKeyUp={commitLayerOpacity}
              className="flex-1"
            />
          </div>
          <select
            value={layer.blendMode}
            onChange={(e) => setLayerBlendMode(layer.id, e.target.value as GlobalCompositeOperation)}
            className="w-full bg-panel border border-border rounded text-[10px] px-1 py-0.5"
          >
            {BLEND_MODES.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
          {(layer.type === 'raster' || layer.type === 'reference') && (
            <div className="flex gap-1">
              <button
                onClick={() => {
                  const canvas = layerService.getLayerCanvas(layer.id);
                  if (!canvas || layer.locked) return;
                  flipHorizontal(canvas);
                  pushHistory('Voltear horizontal');
                }}
                title="Voltear horizontal"
                className="flex-1 flex items-center justify-center py-1 rounded bg-panel border border-border text-textDim hover:text-text"
              >
                <FlipHorizontal size={13} />
              </button>
              <button
                onClick={() => {
                  const canvas = layerService.getLayerCanvas(layer.id);
                  if (!canvas || layer.locked) return;
                  flipVertical(canvas);
                  pushHistory('Voltear vertical');
                }}
                title="Voltear vertical"
                className="flex-1 flex items-center justify-center py-1 rounded bg-panel border border-border text-textDim hover:text-text"
              >
                <FlipVertical size={13} />
              </button>
              <button
                onClick={() => invertLayerColors(layer.id)}
                title="Invertir colores (Ctrl+I) — destructivo; para un ajuste no destructivo, usá una capa de ajuste"
                className="flex-1 flex items-center justify-center py-1 rounded bg-panel border border-border text-textDim hover:text-text"
              >
                <Contrast size={13} />
              </button>
              <button
                onClick={() => desaturateLayerColors(layer.id)}
                title="Desaturar (Ctrl+Shift+U) — destructivo; para un ajuste no destructivo, usá una capa de ajuste"
                className="flex-1 flex items-center justify-center py-1 rounded bg-panel border border-border text-textDim hover:text-text"
              >
                <Droplet size={13} />
              </button>
            </div>
          )}
          {layer.type === 'adjustment' && <AdjustmentEditor layer={layer} />}
          {layer.type === 'fill' && <FillEditor layer={layer} />}
          {!isGroup && layer.hasMask && (
            <div className="flex gap-1">
              <button
                onClick={() => featherLayerMask(layer.id, 4)}
                title="Difuminar bordes de la máscara"
                className="flex-1 text-[9px] py-1 rounded bg-panel border border-border text-textDim hover:text-text"
              >
                Difuminar máscara
              </button>
              <button
                onClick={() => invertLayerMask(layer.id)}
                title="Invertir la máscara"
                className="flex-1 text-[9px] py-1 rounded bg-panel border border-border text-textDim hover:text-text"
              >
                Invertir máscara
              </button>
            </div>
          )}
          {showEffects && (layer.type === 'raster' || layer.type === 'fill') && <LayerEffectsEditor layer={layer} />}
          {!isGroup && otherGroups.length > 0 && (
            <select
              value={layer.parent ?? ''}
              onChange={(e) => setLayerParent(layer.id, e.target.value || null)}
              className="w-full bg-panel border border-border rounded text-[10px] px-1 py-0.5"
            >
              <option value="">Sin grupo</option>
              {otherGroups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          )}
        </div>
      )}
    </div>
  );
}
