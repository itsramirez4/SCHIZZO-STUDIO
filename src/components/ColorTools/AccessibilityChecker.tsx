import { useMemo, useState } from 'react';
import { generateAccessibilityReport } from '@/services/accessibility.service';
import { hexToRgbaColor, rgbaColorToHex } from '@/services/colorSpace.service';
import { COLOR_BLINDNESS_LABELS, ColorBlindnessType } from '@/types/colorTools';
import { useTools } from '@/hooks/useTools';

const CB_TYPES = Object.keys(COLOR_BLINDNESS_LABELS) as ColorBlindnessType[];

export default function AccessibilityChecker() {
  const { primaryColor, secondaryColor } = useTools();
  const [bg, setBg] = useState(secondaryColor);
  const [fg, setFg] = useState(primaryColor);

  const report = useMemo(() => generateAccessibilityReport(hexToRgbaColor(bg), hexToRgbaColor(fg)), [bg, fg]);

  const levelColor = report.contrast.level === 'AAA' ? 'text-green-400' : report.contrast.level === 'AA' ? 'text-amber-400' : 'text-red-400';

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <ColorField label="Fondo" value={bg} onChange={setBg} />
        <ColorField label="Texto" value={fg} onChange={setFg} />
      </div>

      <div className="rounded border border-border p-3 flex items-center justify-center" style={{ background: bg }}>
        <span style={{ color: fg }} className="text-sm font-medium">
          Texto de muestra Aa
        </span>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs text-textDim">Ratio de contraste</span>
        <span className={`text-sm font-semibold ${levelColor}`}>{report.contrast.ratio}:1 ({report.contrast.level})</span>
      </div>
      <p className="text-[10px] text-textDim">{report.contrast.description}</p>

      <div className="grid grid-cols-2 gap-1.5 text-[10px]">
        <div className="bg-panel border border-border rounded px-2 py-1">
          Texto grande: <span className={report.contrast.largeTextPass ? 'text-green-400' : 'text-red-400'}>{report.contrast.largeTextPass ? 'OK' : 'Falla'}</span>
        </div>
        <div className="bg-panel border border-border rounded px-2 py-1">
          Texto chico: <span className={report.contrast.smallTextPass ? 'text-green-400' : 'text-red-400'}>{report.contrast.smallTextPass ? 'OK' : 'Falla'}</span>
        </div>
      </div>

      <div className="space-y-1">
        <div className="text-[10px] text-textDim uppercase tracking-wide">Daltonismo</div>
        {CB_TYPES.map((type) => (
          <div key={type} className="flex items-center justify-between text-[10px]">
            <span className="text-textDim">{COLOR_BLINDNESS_LABELS[type]}</span>
            <span className={report.colorBlindDistinguishable[type] ? 'text-green-400' : 'text-amber-400'}>
              {report.colorBlindDistinguishable[type] ? 'Se distingue' : 'Poco distinguible'}
            </span>
          </div>
        ))}
      </div>

      {report.recommendations.length > 0 && (
        <ul className="space-y-1">
          {report.recommendations.map((r, i) => (
            <li key={i} className="text-[10px] text-textDim">
              • {r}
            </li>
          ))}
        </ul>
      )}

      {report.alternativeColors.length > 0 && (
        <div>
          <div className="text-[10px] text-textDim mb-1">Alternativas con mejor contraste</div>
          <div className="flex gap-1.5">
            {report.alternativeColors.map((c, i) => {
              const hex = rgbaColorToHex(c);
              return (
                <button key={i} onClick={() => setFg(hex)} className="w-8 h-8 rounded border border-border" style={{ background: hex }} title={hex} />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (hex: string) => void }) {
  return (
    <label className="flex items-center gap-1.5 text-[10px] text-textDim">
      {label}
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="w-7 h-7 bg-transparent border border-border rounded cursor-pointer" />
    </label>
  );
}
