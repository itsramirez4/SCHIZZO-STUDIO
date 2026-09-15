import { useEffect, useState } from 'react';
import { Save, Trash2 } from 'lucide-react';
import { useFilterPresetsStore } from '@/store/filterPresetsStore';

interface Props {
  filterId: string;
  currentParams: Record<string, number | string>;
  onApply: (params: Record<string, number | string>) => void;
}

/** Save/load/delete controls for one filter's parameters — dropped into a FilterGroup wherever
 * a filter is worth reusing settings for. One shared component instead of repeating this per
 * filter, even though each of the ~17 filters that use it still needs its own `currentParams`/
 * `onApply` wiring (each has different sliders feeding different apply-function signatures). */
export default function FilterPresetControls({ filterId, currentParams, onApply }: Props) {
  const presets = useFilterPresetsStore((s) => s.presets.filter((p) => p.filterId === filterId));
  const loadPresets = useFilterPresetsStore((s) => s.loadPresets);
  const savePreset = useFilterPresetsStore((s) => s.savePreset);
  const deletePreset = useFilterPresetsStore((s) => s.deletePreset);
  const [name, setName] = useState('');
  const [selectedId, setSelectedId] = useState('');

  useEffect(() => {
    loadPresets();
  }, [loadPresets]);

  return (
    <div className="flex items-center gap-1 pt-0.5">
      <select
        value={selectedId}
        onChange={(e) => {
          setSelectedId(e.target.value);
          const preset = presets.find((p) => p.id === e.target.value);
          if (preset) onApply(preset.params);
        }}
        className="flex-1 bg-panel border border-border rounded text-[9px] px-1 py-0.5 min-w-0"
      >
        <option value="">{presets.length ? 'Presets…' : 'Sin presets guardados'}</option>
        {presets.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      {selectedId && (
        <button
          onClick={() => {
            deletePreset(selectedId);
            setSelectedId('');
          }}
          title="Eliminar preset"
          className="text-textDim hover:text-red-400 shrink-0"
        >
          <Trash2 size={11} />
        </button>
      )}
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Nombre"
        className="w-14 bg-panel border border-border rounded text-[9px] px-1 py-0.5 min-w-0"
      />
      <button
        onClick={() => {
          const trimmed = name.trim();
          if (!trimmed) return;
          savePreset(filterId, trimmed, currentParams);
          setName('');
        }}
        disabled={!name.trim()}
        title="Guardar preset con los valores actuales"
        className="text-textDim hover:text-text disabled:opacity-30 shrink-0"
      >
        <Save size={11} />
      </button>
    </div>
  );
}
