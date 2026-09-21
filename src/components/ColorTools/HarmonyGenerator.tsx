import { useState } from 'react';
import { HarmonyType, HARMONY_LABELS } from '@/types/colorTools';
import { hexToRgbaColor, rgbaColorToHex } from '@/services/colorSpace.service';
import { WheelModel, WHEEL_MODEL_LABELS, wheelHarmony } from '@/services/colorWheel.service';
import { useTools } from '@/hooks/useTools';
import { useAssetLibraryStore } from '@/store/assetLibraryStore';
import { useRecentColorsStore } from '@/store/recentColorsStore';
import { createPalette } from '@/services/paletteLibrary.service';
import ColorWheelPicker from './ColorWheelPicker';

const TYPES = Object.keys(HARMONY_LABELS) as HarmonyType[];
const MODEL_KEY = 'schizzo-wheel-model';

function readModel(): WheelModel {
  try {
    return localStorage.getItem(MODEL_KEY) === 'rgb' ? 'rgb' : 'ryb';
  } catch {
    return 'ryb';
  }
}

/** Colour wheel with harmonies: drag the base colour and the harmony (dots joined by a dashed shape)
 * turns with it, on either the screen (RGB) wheel or the painter's (RYB) wheel. */
export default function HarmonyGenerator() {
  const { primaryColor, setPrimaryColor, setSecondaryColor } = useTools();
  const addPalette = useAssetLibraryStore((s) => s.addPalette);
  const addRecentColor = useRecentColorsStore((s) => s.addColor);
  const [type, setType] = useState<HarmonyType>('complementary');
  const [model, setModel] = useState<WheelModel>(readModel);
  const [saved, setSaved] = useState(false);

  const base = hexToRgbaColor(primaryColor);
  const harmony = wheelHarmony(base, type, model);
  const hexColors = harmony.map(rgbaColorToHex);

  function chooseModel(next: WheelModel) {
    setModel(next);
    try {
      localStorage.setItem(MODEL_KEY, next);
    } catch {
      // preference only
    }
  }

  function saveToLibrary() {
    addPalette(createPalette(`${HARMONY_LABELS[type]} (${primaryColor})`, hexColors));
    setSaved(true);
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-1" data-testid="wheel-models">
        {(Object.keys(WHEEL_MODEL_LABELS) as WheelModel[]).map((m) => (
          <button
            key={m}
            onClick={() => chooseModel(m)}
            className={`text-[10px] rounded py-1 border ${model === m ? 'bg-accent text-white border-accent' : 'bg-panel border-border text-textDim hover:text-text'}`}
            title={m === 'ryb' ? 'Rojo–verde, azul–naranja y amarillo–violeta son complementarios, como en la pintura' : 'Los tonos se reparten como en la pantalla (rojo–cian, verde–magenta, azul–amarillo)'}
          >
            {WHEEL_MODEL_LABELS[m]}
          </button>
        ))}
      </div>

      <ColorWheelPicker
        hex={primaryColor}
        onChange={(hex) => {
          setPrimaryColor(hex);
          setSaved(false);
        }}
        onCommitEnd={addRecentColor}
        model={model}
        harmonyColors={harmony}
        onPickHarmony={(hex, secondary) => (secondary ? setSecondaryColor(hex) : setPrimaryColor(hex))}
        size={220}
      />
      <p className="text-[9px] text-textDim">Arrastra sobre la rueda: el ángulo es el tono y la distancia al centro, la saturación. Pulsa un punto de la armonía para usar ese color (Mayús: como secundario).</p>

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
        data-testid="harmony-type"
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
