import { useState } from 'react';
import { MoodTheme, MOOD_LABELS } from '@/types/colorTools';
import { generateMoodPalette } from '@/services/paletteMood.service';
import { useTools } from '@/hooks/useTools';
import { useAssetLibraryStore } from '@/store/assetLibraryStore';
import { createPalette } from '@/services/paletteLibrary.service';

const MOODS = Object.keys(MOOD_LABELS) as MoodTheme[];

/** Generates a palette biased toward a chosen mood's real hue range (see paletteMood.service —
 * "warm" actually lands on reds/oranges, not just a lightness tweak on whatever hue was there). */
export default function MoodPaletteGenerator() {
  const { setPrimaryColor, setSecondaryColor } = useTools();
  const addPalette = useAssetLibraryStore((s) => s.addPalette);
  const [mood, setMood] = useState<MoodTheme>('warm');
  const [count, setCount] = useState(5);
  const [colors, setColors] = useState<string[]>(() => generateMoodPalette('warm', 5));
  const [saveName, setSaveName] = useState('');
  const [saved, setSaved] = useState(false);

  function regenerate(nextMood: MoodTheme, nextCount: number) {
    setColors(generateMoodPalette(nextMood, nextCount));
    setSaved(false);
  }

  function save() {
    const name = saveName.trim() || `${MOOD_LABELS[mood]} (${colors.length})`;
    addPalette(createPalette(name, colors));
    setSaved(true);
    setSaveName('');
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-1">
        {MOODS.map((m) => (
          <button
            key={m}
            onClick={() => {
              setMood(m);
              regenerate(m, count);
            }}
            className={`text-[10px] rounded py-1.5 border ${mood === m ? 'bg-accent text-white border-accent' : 'bg-panel border-border text-textDim hover:bg-panelLight'}`}
          >
            {MOOD_LABELS[m]}
          </button>
        ))}
      </div>

      <label className="flex items-center gap-2 text-[10px] text-textDim">
        Cantidad de colores
        <input
          type="range"
          min={3}
          max={10}
          value={count}
          onChange={(e) => {
            const next = Number(e.target.value);
            setCount(next);
            regenerate(mood, next);
          }}
          className="flex-1"
        />
        <span className="w-5 text-right">{count}</span>
      </label>

      <button onClick={() => regenerate(mood, count)} className="w-full text-[11px] bg-panelLight rounded py-1.5">
        Regenerar
      </button>

      <div className="grid grid-cols-2 gap-1.5">
        {colors.map((hex, i) => (
          <div key={i} className="border border-border rounded overflow-hidden">
            <button onClick={() => setPrimaryColor(hex)} className="w-full h-12 block" style={{ background: hex }} title="Click: usar como color primario" />
            <div className="flex items-center justify-between px-1.5 py-1">
              <span className="text-[9px] font-mono text-textDim">{hex}</span>
              <button onClick={() => setSecondaryColor(hex)} className="text-[9px] text-textDim hover:text-text" title="Usar como secundario">
                2°
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-1.5">
        <input
          type="text"
          value={saveName}
          onChange={(e) => setSaveName(e.target.value)}
          placeholder={`${MOOD_LABELS[mood]} (${colors.length})`}
          className="flex-1 bg-panel border border-border rounded text-[11px] px-1.5 py-1"
        />
        <button onClick={save} className="text-[11px] bg-panelLight rounded px-2.5">
          Guardar
        </button>
      </div>
      {saved && <p className="text-[9px] text-textDim">Guardada en la biblioteca de paletas.</p>}
    </div>
  );
}
