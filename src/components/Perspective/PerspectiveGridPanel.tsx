import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useAppStore } from '@/store/appStore';
import { usePerspectiveStore } from '@/store/perspectiveStore';
import { PerspectiveGridType, VanishingPoint } from '@/types/perspective';
import { Lock, Unlock, Eye, EyeOff, Trash2 } from 'lucide-react';

const GRID_TYPES: { id: PerspectiveGridType; label: string }[] = [
  { id: 'onePoint', label: '1 punto' },
  { id: 'twoPoint', label: '2 puntos' },
  { id: 'threePoint', label: '3 puntos' },
];

export default function PerspectiveGridPanel() {
  const project = useAppStore((s) => s.project);
  const grid = usePerspectiveStore((s) => s.grid);
  const setGridType = usePerspectiveStore((s) => s.setGridType);
  const toggleGridEnabled = usePerspectiveStore((s) => s.toggleGridEnabled);
  const updateGridSettings = usePerspectiveStore((s) => s.updateGridSettings);
  const moveVanishingPoint = usePerspectiveStore((s) => s.moveVanishingPoint);
  const toggleVanishingPointLocked = usePerspectiveStore((s) => s.toggleVanishingPointLocked);
  const toggleVanishingPointVisible = usePerspectiveStore((s) => s.toggleVanishingPointVisible);
  const presets = usePerspectiveStore((s) => s.presets);
  const loadPresets = usePerspectiveStore((s) => s.loadPresets);
  const saveCurrentAsPreset = usePerspectiveStore((s) => s.saveCurrentAsPreset);
  const applyPreset = usePerspectiveStore((s) => s.applyPreset);
  const deletePreset = usePerspectiveStore((s) => s.deletePreset);

  const [newPresetName, setNewPresetName] = useState('');

  useEffect(() => {
    loadPresets();
  }, [loadPresets]);

  if (!project) return null;
  const points = Object.values(grid.points).filter((p): p is VanishingPoint => !!p);

  function handleSavePreset() {
    const name = newPresetName.trim();
    if (!name || !project) return;
    saveCurrentAsPreset(name, project.width, project.height);
    setNewPresetName('');
    toast.success('Preset guardado');
  }

  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 text-[11px]">
        <input type="checkbox" checked={grid.enabled} onChange={toggleGridEnabled} />
        Mostrar grilla de perspectiva
      </label>

      <div className="grid grid-cols-3 gap-1">
        {GRID_TYPES.map((t) => (
          <button
            key={t.id}
            onClick={() => setGridType(t.id, project.width, project.height)}
            className={`text-[10px] py-1.5 rounded ${grid.type === t.id ? 'bg-accent text-white' : 'bg-panelLight text-textDim hover:text-text'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="space-y-1.5">
        <h4 className="text-[10px] font-semibold text-textDim">Puntos de fuga</h4>
        {points.map((vp) => (
          <div key={vp.id} className="flex items-center gap-1.5 text-[10px] bg-panel rounded px-1.5 py-1">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: vp.color }} />
            <span className="flex-1 truncate">{vp.label}</span>
            <input
              type="number"
              value={Math.round(vp.x)}
              onChange={(e) => moveVanishingPoint(vp.id, Number(e.target.value), vp.y)}
              className="w-14 bg-panelLight border border-border rounded px-1 py-0.5"
            />
            <input
              type="number"
              value={Math.round(vp.y)}
              onChange={(e) => moveVanishingPoint(vp.id, vp.x, Number(e.target.value))}
              className="w-14 bg-panelLight border border-border rounded px-1 py-0.5"
            />
            <button onClick={() => toggleVanishingPointVisible(vp.id)} className="text-textDim hover:text-text" title={vp.visible ? 'Ocultar' : 'Mostrar'}>
              {vp.visible ? <Eye size={11} /> : <EyeOff size={11} />}
            </button>
            <button onClick={() => toggleVanishingPointLocked(vp.id)} className="text-textDim hover:text-text" title={vp.locked ? 'Desbloquear' : 'Bloquear'}>
              {vp.locked ? <Lock size={11} /> : <Unlock size={11} />}
            </button>
          </div>
        ))}
        <p className="text-[9px] text-textDim">También podés arrastrar los puntos directamente en el lienzo.</p>
      </div>

      <div className="space-y-1.5">
        <label className="flex items-center gap-2 text-[9px] text-textDim">
          <span className="w-16">Color</span>
          <input type="color" value={grid.color} onChange={(e) => updateGridSettings({ color: e.target.value })} className="flex-1 h-6 bg-panelLight border border-border rounded" />
        </label>
        <label className="flex items-center gap-2 text-[9px] text-textDim">
          <span className="w-16">Opacidad</span>
          <input
            type="range"
            min={0.1}
            max={1}
            step={0.05}
            value={grid.opacity}
            onChange={(e) => updateGridSettings({ opacity: Number(e.target.value) })}
            className="flex-1"
          />
        </label>
        <label className="flex items-center gap-2 text-[9px] text-textDim">
          <span className="w-16">Divisiones</span>
          <input
            type="range"
            min={2}
            max={32}
            step={1}
            value={grid.divisions}
            onChange={(e) => updateGridSettings({ divisions: Number(e.target.value) })}
            className="flex-1"
          />
          <span className="w-6 text-right">{grid.divisions}</span>
        </label>
      </div>

      <div className="border-t border-border pt-2 space-y-1.5">
        <h4 className="text-[10px] font-semibold text-textDim">Presets</h4>
        <p className="text-[9px] text-textDim">
          Se guardan de forma global (no con el proyecto) — reutilizalos en cualquier dibujo. Cada punto se guarda
          como proporción del lienzo, así se adapta a lienzos de otro tamaño.
        </p>
        {presets.length === 0 ? (
          <p className="text-[9px] text-textDim">Sin presets todavía.</p>
        ) : (
          <div className="space-y-1">
            {presets.map((preset) => (
              <div key={preset.id} className="flex items-center gap-1.5 text-[10px] bg-panel rounded px-1.5 py-1">
                <span className="flex-1 truncate">{preset.name}</span>
                <button
                  onClick={() => {
                    applyPreset(preset.id, project.width, project.height);
                    toast.success(`Preset "${preset.name}" aplicado`);
                  }}
                  className="text-[9px] bg-panelLight rounded px-2 py-0.5"
                >
                  Aplicar
                </button>
                <button onClick={() => deletePreset(preset.id)} className="text-textDim hover:text-red-400" title="Eliminar">
                  <Trash2 size={11} />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-1.5">
          <input
            type="text"
            value={newPresetName}
            onChange={(e) => setNewPresetName(e.target.value)}
            placeholder="Nombre del preset"
            className="flex-1 bg-panel border border-border rounded text-[10px] px-1.5 py-1"
          />
          <button onClick={handleSavePreset} disabled={!newPresetName.trim()} className="text-[10px] bg-panelLight rounded px-2 disabled:opacity-40">
            Guardar actual
          </button>
        </div>
      </div>
    </div>
  );
}
