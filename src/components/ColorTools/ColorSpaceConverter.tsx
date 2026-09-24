import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { hexToRgbaColor, rgbaColorToHex, rgbToHsl, rgbToHsv, rgbToLab, rgbToCmyk, hslToRgb } from '@/services/colorSpace.service';
import { useTools } from '@/hooks/useTools';

export default function ColorSpaceConverter() {
  const { t } = useTranslation('panelsColor');
  const { primaryColor, setPrimaryColor } = useTools();
  const [localHex, setLocalHex] = useState(primaryColor);

  const rgb = hexToRgbaColor(localHex || primaryColor);
  const hsl = rgbToHsl(rgb);
  const hsv = rgbToHsv(rgb);
  const lab = rgbToLab(rgb);
  const cmyk = rgbToCmyk(rgb);

  function commitHex(hex: string) {
    setLocalHex(hex);
    setPrimaryColor(hex);
  }

  function commitHsl(patch: Partial<typeof hsl>) {
    const next = { ...hsl, ...patch };
    commitHex(rgbaColorToHex(hslToRgb(next)));
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <input type="color" value={localHex} onChange={(e) => commitHex(e.target.value)} className="w-10 h-10 bg-transparent border border-border rounded cursor-pointer" />
        <input
          type="text"
          value={localHex}
          onChange={(e) => setLocalHex(e.target.value)}
          onBlur={() => commitHex(localHex)}
          onKeyDown={(e) => e.key === 'Enter' && commitHex(localHex)}
          className="flex-1 bg-panel border border-border rounded px-2 py-1.5 text-xs font-mono"
        />
      </div>

      <div className="space-y-2">
        <div className="text-[10px] text-textDim uppercase tracking-wide">{t('colorSpaceConverter.hslEditable')}</div>
        <SliderRow label="H" value={hsl.h} min={0} max={359} onChange={(v) => commitHsl({ h: v })} />
        <SliderRow label="S" value={hsl.s} min={0} max={100} onChange={(v) => commitHsl({ s: v })} />
        <SliderRow label="L" value={hsl.l} min={0} max={100} onChange={(v) => commitHsl({ l: v })} />
      </div>

      <div className="grid grid-cols-2 gap-2 text-[10px]">
        <ReadoutBox label="RGB" value={`${rgb.r}, ${rgb.g}, ${rgb.b}`} />
        <ReadoutBox label="HSV" value={`${hsv.h}°, ${hsv.s}%, ${hsv.v}%`} />
        <ReadoutBox label="LAB" value={`${lab.l}, ${lab.a}, ${lab.b}`} />
        <ReadoutBox label="CMYK" value={`${cmyk.c}, ${cmyk.m}, ${cmyk.y}, ${cmyk.k}`} />
      </div>
    </div>
  );
}

function SliderRow({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-textDim w-3">{label}</span>
      <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} className="flex-1" />
      <span className="text-[10px] text-textDim w-8 text-right">{value}</span>
    </div>
  );
}

function ReadoutBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-panel border border-border rounded px-2 py-1.5">
      <div className="text-textDim">{label}</div>
      <div className="text-text font-mono">{value}</div>
    </div>
  );
}
