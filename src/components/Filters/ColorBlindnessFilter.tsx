import { useState } from 'react';
import { ColorBlindnessType, COLOR_BLINDNESS_LABELS } from '@/types/colorTools';
import { simulateOnCanvas } from '@/services/colorBlindness.service';
import { useLayers } from '@/hooks/useLayers';
import { useFilterPreview } from '@/hooks/useFilterPreview';

const TYPES = Object.keys(COLOR_BLINDNESS_LABELS) as ColorBlindnessType[];
const KEY = 'colorblindness';

/** Simulates the current layer as seen through colorblind vision — lets an artist check
 * their actual artwork's readability, not just an abstract example color. */
export default function ColorBlindnessFilter() {
  const { currentLayer } = useLayers();
  const { preview, commit, cancel, isPreviewing } = useFilterPreview();
  const [type, setType] = useState<ColorBlindnessType>('deuteranopia');

  function run(t: ColorBlindnessType) {
    preview(KEY, (c) => simulateOnCanvas(c, t));
  }

  function apply() {
    if (!currentLayer) return;
    if (!isPreviewing(KEY)) run(type);
    commit(`Simular ${COLOR_BLINDNESS_LABELS[type]}`);
  }

  return (
    <div className="space-y-2 mt-4 pt-3 border-t border-border">
      <div className="text-xs text-textDim uppercase tracking-wide font-medium">
        Daltonismo {isPreviewing(KEY) && <span className="text-accent normal-case">· vista previa</span>}
      </div>
      <select
        value={type}
        onChange={(e) => {
          const t = e.target.value as ColorBlindnessType;
          setType(t);
          run(t);
        }}
        className="w-full bg-panel border border-border rounded text-[11px] px-1.5 py-1"
      >
        {TYPES.map((t) => (
          <option key={t} value={t}>
            {COLOR_BLINDNESS_LABELS[t]}
          </option>
        ))}
      </select>
      <div className="flex gap-2">
        <button onClick={apply} disabled={!currentLayer} className="flex-1 bg-panelLight text-xs rounded py-1.5 disabled:opacity-40">
          Aplicar
        </button>
        {isPreviewing(KEY) && (
          <button onClick={cancel} className="flex-1 bg-panelLight text-xs rounded py-1.5 text-textDim">
            Cancelar
          </button>
        )}
      </div>
    </div>
  );
}
