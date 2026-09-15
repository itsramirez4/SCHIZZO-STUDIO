import { useState } from 'react';
import { Star } from 'lucide-react';
import { useBrush } from '@/hooks/useBrush';
import { useTools } from '@/hooks/useTools';
import { filterAssets } from '@/services/assetSearch.service';
import BrushPreview from '@/components/Brushes/BrushPreview';

/** Reuses the app's real brush library (appStore.brushLibrary) rather than a second, disconnected
 * one — this is purely a browse/search/favorite layer on top of what BrushEditor already manages. */
export default function BrushLibraryTab() {
  const { brushLibrary, setCurrentBrush, updateBrushInLibrary } = useBrush();
  const { primaryColor } = useTools();
  const [search, setSearch] = useState('');
  const [favoriteOnly, setFavoriteOnly] = useState(false);

  const filtered = filterAssets(brushLibrary, { text: search, favoriteOnly });

  return (
    <div className="space-y-2">
      <div className="flex gap-1.5">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar pinceles…"
          className="flex-1 bg-panel border border-border rounded px-2 py-1 text-[11px]"
        />
        <button
          onClick={() => setFavoriteOnly((v) => !v)}
          title="Solo favoritos"
          className={`px-2 rounded border ${favoriteOnly ? 'bg-accent border-accent' : 'border-border'}`}
        >
          <Star size={12} className={favoriteOnly ? 'fill-white text-white' : 'text-textDim'} />
        </button>
      </div>

      {filtered.length === 0 ? (
        <p className="text-[10px] text-textDim text-center py-4">Sin pinceles que coincidan</p>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {filtered.map((brush) => (
            <div key={brush.id} className="border border-border rounded overflow-hidden">
              <button onClick={() => setCurrentBrush(brush)} className="w-full block" title="Usar este pincel">
                <BrushPreview brush={brush} color={primaryColor} width={140} height={44} />
              </button>
              <div className="flex items-center justify-between px-1.5 py-1 gap-1">
                <span className="text-[9px] text-textDim truncate flex-1">{brush.name}</span>
                <button onClick={() => updateBrushInLibrary(brush.id, { favorite: !brush.favorite })} title="Favorito">
                  <Star size={11} className={brush.favorite ? 'fill-amber-400 text-amber-400' : 'text-textDim'} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
