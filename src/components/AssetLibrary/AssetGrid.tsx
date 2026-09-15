import { Star, Trash2 } from 'lucide-react';
import { ReactNode } from 'react';

interface AssetGridProps<T> {
  items: T[];
  getId: (item: T) => string;
  getName: (item: T) => string;
  getFavorite: (item: T) => boolean;
  renderPreview: (item: T) => ReactNode;
  onSelect?: (item: T) => void;
  onToggleFavorite: (item: T) => void;
  canDelete?: (item: T) => boolean;
  onDelete?: (item: T) => void;
  emptyMessage: string;
}

/** Shared grid layout for Pattern/Gradient/Texture library tabs — avoids repeating the same
 * preview/name/favorite/delete card markup three times. */
export default function AssetGrid<T>({
  items,
  getId,
  getName,
  getFavorite,
  renderPreview,
  onSelect,
  onToggleFavorite,
  canDelete,
  onDelete,
  emptyMessage,
}: AssetGridProps<T>) {
  if (items.length === 0) {
    return <p className="text-[10px] text-textDim text-center py-4">{emptyMessage}</p>;
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      {items.map((item) => {
        const id = getId(item);
        const favorite = getFavorite(item);
        const deletable = canDelete ? canDelete(item) : true;
        return (
          <div key={id} className="border border-border rounded overflow-hidden">
            <button onClick={() => onSelect?.(item)} className="w-full h-14 block bg-panel" title={getName(item)}>
              {renderPreview(item)}
            </button>
            <div className="flex items-center justify-between px-1.5 py-1 gap-1">
              <span className="text-[9px] text-textDim truncate flex-1">{getName(item)}</span>
              <button onClick={() => onToggleFavorite(item)} title="Favorito">
                <Star size={11} className={favorite ? 'fill-amber-400 text-amber-400' : 'text-textDim'} />
              </button>
              {deletable && onDelete && (
                <button onClick={() => onDelete(item)} title="Eliminar">
                  <Trash2 size={11} className="text-textDim hover:text-red-400" />
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
