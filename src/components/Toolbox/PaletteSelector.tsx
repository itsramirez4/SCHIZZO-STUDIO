import { useState } from 'react';
import { colorPalettes } from '@/data/colorPalettes';
import { useTools } from '@/hooks/useTools';
import { useRecentColorsStore } from '@/store/recentColorsStore';

export default function PaletteSelector() {
  const { setPrimaryColor } = useTools();
  const addRecentColor = useRecentColorsStore((s) => s.addColor);
  const [activeId, setActiveId] = useState(colorPalettes[0].id);
  const active = colorPalettes.find((p) => p.id === activeId)!;

  return (
    <div className="p-2 border-t border-border">
      <div className="text-xs text-textDim mb-1">Paletas</div>
      <select
        value={activeId}
        onChange={(e) => setActiveId(e.target.value)}
        className="w-full bg-panel border border-border rounded text-[10px] px-1 py-1 mb-1.5"
      >
        {colorPalettes.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <div className="grid grid-cols-6 gap-1">
        {active.colors.map((hex) => (
          <button
            key={hex}
            onClick={() => {
              setPrimaryColor(hex);
              addRecentColor(hex);
            }}
            title={hex}
            style={{ background: hex }}
            className="aspect-square rounded border border-border hover:scale-110 hover:z-10 transition-transform"
          />
        ))}
      </div>
    </div>
  );
}
