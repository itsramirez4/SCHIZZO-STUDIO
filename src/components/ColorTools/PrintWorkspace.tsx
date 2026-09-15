import { useState } from 'react';
import { useTools } from '@/hooks/useTools';
import { hexToRgbaColor, rgbToLab, cmykToRgb, rgbaColorToHex } from '@/services/colorSpace.service';
import { rgbToCmykAdvanced, getTotalInk, validateSeparation, DEFAULT_CMYK_WORKFLOW_SETTINGS, BlackGeneration } from '@/services/cmykWorkflow.service';
import { deltaE76, deltaE2000, describeDeltaE, DELTA_E_LABELS } from '@/services/colorAccuracy.service';

const BLACK_GEN_LABELS: Record<BlackGeneration, string> = {
  light: 'Ligera',
  medium: 'Media',
  heavy: 'Fuerte',
  maximum: 'Máxima',
};

/** A generic CMYK/ink workflow, not real ICC-based prepress — see softProof.service.ts's
 * module note for why real device profiles are out of scope here. This is the swatch-based
 * companion to the whole-layer "Vista previa de impresión" filter in the Filters panel, same
 * split as the Daltonismo tab (swatches here) vs the Daltonismo filter (whole layer) already
 * established in this panel. */
export default function PrintWorkspace() {
  const { primaryColor } = useTools();
  const [totalInkLimit, setTotalInkLimit] = useState(DEFAULT_CMYK_WORKFLOW_SETTINGS.totalInkLimit);
  const [blackGeneration, setBlackGeneration] = useState<BlackGeneration>(DEFAULT_CMYK_WORKFLOW_SETTINGS.blackGeneration);
  const [useGCR, setUseGCR] = useState(DEFAULT_CMYK_WORKFLOW_SETTINGS.useGCR);

  const settings = { totalInkLimit, blackGeneration, useGCR };
  const rgb = hexToRgbaColor(primaryColor);
  const cmyk = rgbToCmykAdvanced(rgb, settings);
  const totalInk = getTotalInk(cmyk);
  const warnings = validateSeparation(cmyk, settings);

  const roundTrip = cmykToRgb(cmyk);
  const roundTripHex = rgbaColorToHex(roundTrip);
  const labOriginal = rgbToLab(rgb);
  const labRoundTrip = rgbToLab(roundTrip);
  const de76 = deltaE76(labOriginal, labRoundTrip);
  const de2000 = deltaE2000(labOriginal, labRoundTrip);
  const severity = describeDeltaE(de2000);

  return (
    <div className="space-y-3">
      <div className="border border-border rounded p-2 space-y-1.5">
        <div className="text-[10px] text-textDim uppercase tracking-wide">Ajustes de tinta</div>
        <div className="flex items-center gap-1.5 text-[10px] text-textDim">
          <span className="w-24 shrink-0">Límite de tinta</span>
          <input type="range" min={200} max={400} value={totalInkLimit} onChange={(e) => setTotalInkLimit(Number(e.target.value))} className="flex-1" />
          <span className="w-10 text-right">{totalInkLimit}%</span>
        </div>
        <label className="flex items-center gap-1.5 text-[10px] text-textDim">
          <input type="checkbox" checked={useGCR} onChange={(e) => setUseGCR(e.target.checked)} />
          Reemplazo de componente gris (GCR)
        </label>
        {useGCR && (
          <select
            value={blackGeneration}
            onChange={(e) => setBlackGeneration(e.target.value as BlackGeneration)}
            className="w-full bg-panel border border-border rounded text-[10px] px-1.5 py-1"
          >
            {(Object.keys(BLACK_GEN_LABELS) as BlackGeneration[]).map((k) => (
              <option key={k} value={k}>
                Generación de negro: {BLACK_GEN_LABELS[k]}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="border border-border rounded p-2 space-y-1.5">
        <div className="text-[10px] text-textDim uppercase tracking-wide">Separación del color primario</div>
        <div className="grid grid-cols-4 gap-1.5 text-center">
          {(['c', 'm', 'y', 'k'] as const).map((ch) => (
            <div key={ch} className="bg-panel border border-border rounded py-1.5">
              <div className="text-[9px] text-textDim uppercase">{ch}</div>
              <div className="text-xs font-mono">{cmyk[ch]}%</div>
            </div>
          ))}
        </div>
        <div className="text-[10px] text-textDim">Tinta total: {Math.round(totalInk)}%</div>
        {warnings.map((w, i) => (
          <p key={i} className="text-[9px] text-amber-400">
            ⚠ {w}
          </p>
        ))}
      </div>

      <div className="border border-border rounded p-2 space-y-1.5">
        <div className="text-[10px] text-textDim uppercase tracking-wide">Diferencia de color (ida y vuelta por CMYK)</div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className="text-[9px] text-textDim mb-1">Original</div>
            <div className="h-10 rounded border border-border" style={{ background: primaryColor }} title={primaryColor} />
          </div>
          <div>
            <div className="text-[9px] text-textDim mb-1">Tras CMYK → RGB</div>
            <div className="h-10 rounded border border-border" style={{ background: roundTripHex }} title={roundTripHex} />
          </div>
        </div>
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-textDim">ΔE76</span>
          <span className="font-mono">{de76.toFixed(2)}</span>
        </div>
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-textDim">ΔE2000</span>
          <span className="font-mono">
            {de2000.toFixed(2)} — {DELTA_E_LABELS[severity]}
          </span>
        </div>
      </div>
    </div>
  );
}
