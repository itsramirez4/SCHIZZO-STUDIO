import { useState } from 'react';
import { useLayers } from '@/hooks/useLayers';
import { useFilterPreview } from '@/hooks/useFilterPreview';
import { simulateCmykRoundTrip, highlightOutOfGamut, applyPaperTint } from '@/services/softProof.service';
import { DEFAULT_CMYK_WORKFLOW_SETTINGS } from '@/services/cmykWorkflow.service';

const KEY = 'printpreview';

/** Whole-layer companion to the "Imprenta" tab in Herramientas de color (which works on
 * swatches) — same split as the existing Daltonismo tab/filter pair. Shows either the full
 * CMYK round-trip look, or a gamut-warning overlay (Photoshop-style: image mostly unchanged,
 * only the pixels that shift a lot in CMYK get flagged), plus an optional paper tint. */
export default function PrintPreviewFilter() {
  const { currentLayer } = useLayers();
  const { preview, commit, cancel, isPreviewing } = useFilterPreview();
  const [paperColor, setPaperColor] = useState('#fbf9f2');
  const [showGamutWarning, setShowGamutWarning] = useState(false);
  const [gamutResult, setGamutResult] = useState<{ percent: number } | null>(null);

  // Takes explicit overrides rather than reading `paperColor`/`showGamutWarning` straight from
  // state: a checkbox/color-input onChange that calls setState() then run() in the same tick
  // would otherwise capture the *pre-update* value — setState doesn't apply synchronously —
  // so toggling gamut-warning on, for instance, would silently keep showing the old mode.
  function run(overrides?: { paperColor?: string; showGamutWarning?: boolean }) {
    const effectivePaper = overrides?.paperColor ?? paperColor;
    const effectiveGamutWarning = overrides?.showGamutWarning ?? showGamutWarning;
    preview(KEY, (canvas) => {
      if (effectiveGamutWarning) {
        const result = highlightOutOfGamut(canvas, DEFAULT_CMYK_WORKFLOW_SETTINGS);
        setGamutResult({ percent: result.percent });
      } else {
        simulateCmykRoundTrip(canvas, DEFAULT_CMYK_WORKFLOW_SETTINGS);
        setGamutResult(null);
      }
      applyPaperTint(canvas, effectivePaper);
    });
  }

  function apply() {
    if (!currentLayer) return;
    if (!isPreviewing(KEY)) run();
    commit('Vista previa de impresión');
  }

  return (
    <div className="space-y-2 mt-4 pt-3 border-t border-border">
      <div className="text-xs text-textDim uppercase tracking-wide font-medium">
        Vista previa de impresión {isPreviewing(KEY) && <span className="text-accent normal-case">· vista previa</span>}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-textDim">Color de papel</span>
        <input
          type="color"
          value={paperColor}
          onChange={(e) => {
            setPaperColor(e.target.value);
            run({ paperColor: e.target.value });
          }}
          className="w-7 h-7 bg-transparent border border-border rounded cursor-pointer"
        />
      </div>
      <label className="flex items-center gap-1.5 text-[10px] text-textDim">
        <input
          type="checkbox"
          checked={showGamutWarning}
          onChange={(e) => {
            setShowGamutWarning(e.target.checked);
            run({ showGamutWarning: e.target.checked });
          }}
        />
        Resaltar zonas fuera de gama CMYK
      </label>
      {gamutResult && <p className="text-[9px] text-amber-400">{gamutResult.percent.toFixed(1)}% de los píxeles opacos están fuera de gama.</p>}
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
