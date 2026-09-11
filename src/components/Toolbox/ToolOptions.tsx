import { useTools } from '@/hooks/useTools';
import { useBrush } from '@/hooks/useBrush';

export default function ToolOptions() {
  const { currentTool } = useTools();
  const { currentBrush, updateCurrentBrush } = useBrush();

  if (!['brush', 'eraser'].includes(currentTool)) return null;

  return (
    <div className="p-2 border-t border-border space-y-2">
      <div>
        <div className="flex justify-between text-xs text-textDim mb-1">
          <span>Tamaño</span>
          <span>{Math.round(currentBrush.size)}px</span>
        </div>
        <input
          type="range"
          min={1}
          max={300}
          value={currentBrush.size}
          onChange={(e) => updateCurrentBrush({ size: Number(e.target.value) })}
          className="w-full"
        />
      </div>
      {currentTool === 'brush' && (
        <>
          <div>
            <div className="flex justify-between text-xs text-textDim mb-1">
              <span>Dureza</span>
              <span>{Math.round(currentBrush.hardness * 100)}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={currentBrush.hardness * 100}
              onChange={(e) => updateCurrentBrush({ hardness: Number(e.target.value) / 100 })}
              className="w-full"
            />
          </div>
          <div>
            <div className="flex justify-between text-xs text-textDim mb-1">
              <span>Opacidad</span>
              <span>{Math.round(currentBrush.opacity * 100)}%</span>
            </div>
            <input
              type="range"
              min={1}
              max={100}
              value={currentBrush.opacity * 100}
              onChange={(e) => updateCurrentBrush({ opacity: Number(e.target.value) / 100 })}
              className="w-full"
            />
          </div>
        </>
      )}
    </div>
  );
}
