import { useState } from 'react';
import { HarmonyType, HARMONY_LABELS } from '@/types/colorTools';
import { generateHarmony } from '@/services/colorHarmony.service';
import { hexToRgbaColor, rgbaColorToHex } from '@/services/colorSpace.service';
import { useTools } from '@/hooks/useTools';
import { useAssetLibraryStore } from '@/store/assetLibraryStore';
import { createPalette } from '@/services/paletteLibrary.service';

const TYPES = Object.keys(HARMONY_LABELS) as HarmonyType[];

export default function HarmonyGenerator() {
  const { primaryColor, setPrimaryColor, setSecondaryColor } = useTools();
  const addPalette = useAssetLibraryStore((s) => s.addPalette);
  const [type, setType] = useState<HarmonyType>('complementary');
  const [saved, setSaved] = useState(false);

  const base = hexToRgbaColor(primaryColor);
  const harmony = generateHarmony(base, type);
  const hexColors = harmony.map(rgbaColorToHex);

  function saveToLibrary() {
    addPalette(createPalette(`${HARMONY_LABELS[type]} (${primaryColor})`, hexColors));
    setSaved(true);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-textDim w-16">Base</span>
        <div className="w-8 h-8 rounded border border-border" style={{ background: primaryColor }} />
        <span className="text-[10px] text-textDim font-mono">{primaryColor}</span>
      </div>

      <select
        value={type}
        onChange={(e) => {
          setType(e.target.value as HarmonyType);
          setSaved(false);
        }}
        className="w-full bg-panel border border-border rounded text-[11px] px-1.5 py-1"
      >
        {TYPES.map((t) => (
          <option key={t} value={t}>
            {HARMONY_LABELS[t]}
          </option>
        ))}
      </select>

      <div className="grid grid-cols-2 gap-2">
        {harmony.map((color, i) => {
          const hex = rgbaColorToHex(color);
          return (
            <div key={i} className="border border-border rounded overflow-hidden">
              <button onClick={() => setPrimaryColor(hex)} className="w-full h-14 block" style={{ background: hex }} title="Click: usar como color primario" />
              <div className="flex items-center justify-between px-1.5 py-1">
                <span className="text-[9px] font-mono text-textDim">{hex}</span>
                <button onClick={() => setSecondaryColor(hex)} className="text-[9px] text-textDim hover:text-text" title="Usar como secundario">
                  2°
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <button onClick={saveToLibrary} className="w-full text-[11px] bg-panelLight rounded py-1.5">
        Guardar en biblioteca
      </button>
      {saved && <p className="text-[9px] text-textDim">Guardada.</p>}
    </div>
  );
}
