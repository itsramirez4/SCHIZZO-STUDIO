import { useTools } from '@/hooks/useTools';
import { useBrush } from '@/hooks/useBrush';
import { useAppStore } from '@/store/appStore';
import { useWarpToolStore } from '@/store/warpToolStore';
import { LiquifyMode } from '@/services/warpTool.service';

const WARP_MODE_LABELS: Record<LiquifyMode, string> = {
  push: 'Empujar',
  twirl: 'Remolino',
  pinch: 'Pellizcar',
  expand: 'Expandir',
  turbulence: 'Turbulencia',
  smooth: 'Suavizar',
};

export default function ToolOptions() {
  const { currentTool } = useTools();
  const { currentBrush, updateCurrentBrush } = useBrush();
  const magicWandTolerance = useAppStore((s) => s.magicWandTolerance);
  const setMagicWandTolerance = useAppStore((s) => s.setMagicWandTolerance);
  const eyedropperSampleSize = useAppStore((s) => s.eyedropperSampleSize);
  const setEyedropperSampleSize = useAppStore((s) => s.setEyedropperSampleSize);
  const eyedropperSampleAllLayers = useAppStore((s) => s.eyedropperSampleAllLayers);
  const setEyedropperSampleAllLayers = useAppStore((s) => s.setEyedropperSampleAllLayers);
  const gradientToolMode = useAppStore((s) => s.gradientToolMode);
  const setGradientToolMode = useAppStore((s) => s.setGradientToolMode);
  const warpRadius = useWarpToolStore((s) => s.radius);
  const warpStrength = useWarpToolStore((s) => s.strength);
  const warpMode = useWarpToolStore((s) => s.mode);
  const setWarpRadius = useWarpToolStore((s) => s.setRadius);
  const setWarpStrength = useWarpToolStore((s) => s.setStrength);
  const setWarpMode = useWarpToolStore((s) => s.setMode);

  if (currentTool === 'warp') {
    return (
      <div className="p-2 border-t border-border space-y-2">
        <select
          value={warpMode}
          onChange={(e) => setWarpMode(e.target.value as LiquifyMode)}
          className="w-full bg-panel border border-border rounded text-[10px] px-1.5 py-1"
        >
          {(Object.keys(WARP_MODE_LABELS) as LiquifyMode[]).map((m) => (
            <option key={m} value={m}>{WARP_MODE_LABELS[m]}</option>
          ))}
        </select>
        <div>
          <div className="flex justify-between text-xs text-textDim mb-1">
            <span>Tamaño de pincel</span>
            <span>{warpRadius}px</span>
          </div>
          <input type="range" min={5} max={300} value={warpRadius} onChange={(e) => setWarpRadius(Number(e.target.value))} className="w-full" />
        </div>
        <div>
          <div className="flex justify-between text-xs text-textDim mb-1">
            <span>Fuerza</span>
            <span>{warpStrength}%</span>
          </div>
          <input type="range" min={1} max={100} value={warpStrength} onChange={(e) => setWarpStrength(Number(e.target.value))} className="w-full" />
        </div>
        <p className="text-[10px] text-textDim">Pintá sobre el lienzo para deformar los píxeles en vivo — "Empujar" arrastra en la dirección del trazo.</p>
      </div>
    );
  }

  if (currentTool === 'magicWand') {
    return (
      <div className="p-2 border-t border-border space-y-2">
        <div>
          <div className="flex justify-between text-xs text-textDim mb-1">
            <span>Tolerancia</span>
            <span>{magicWandTolerance}</span>
          </div>
          <input
            type="range"
            min={0}
            max={255}
            value={magicWandTolerance}
            onChange={(e) => setMagicWandTolerance(Number(e.target.value))}
            className="w-full"
          />
        </div>
        <p className="text-[10px] text-textDim">Hacé clic en el lienzo para seleccionar el área conectada de color similar.</p>
      </div>
    );
  }

  if (currentTool === 'gradient') {
    return (
      <div className="p-2 border-t border-border space-y-2">
        <div className="flex gap-1">
          <button
            onClick={() => setGradientToolMode('linear')}
            className={`flex-1 text-[10px] rounded py-1 ${gradientToolMode === 'linear' ? 'bg-accent text-white' : 'bg-panel text-textDim hover:text-text'}`}
          >
            Lineal
          </button>
          <button
            onClick={() => setGradientToolMode('radial')}
            className={`flex-1 text-[10px] rounded py-1 ${gradientToolMode === 'radial' ? 'bg-accent text-white' : 'bg-panel text-textDim hover:text-text'}`}
          >
            Radial
          </button>
        </div>
        <p className="text-[10px] text-textDim">
          {gradientToolMode === 'radial'
            ? 'Arrastrá desde el centro hacia afuera — color primario en el centro, secundario en el borde.'
            : 'Arrastrá sobre el lienzo para definir el eje del degradado — color primario en el inicio, secundario en el final. Mantené Shift para ajustar a 45°.'}
        </p>
      </div>
    );
  }

  if (currentTool === 'eyedropper') {
    return (
      <div className="p-2 border-t border-border space-y-2">
        <div>
          <div className="text-xs text-textDim mb-1">Tamaño de muestra</div>
          <div className="flex gap-1">
            {([1, 3, 5] as const).map((size) => (
              <button
                key={size}
                onClick={() => setEyedropperSampleSize(size)}
                className={`flex-1 text-[10px] rounded py-1 ${eyedropperSampleSize === size ? 'bg-accent text-white' : 'bg-panel text-textDim hover:text-text'}`}
              >
                {size === 1 ? '1 píxel' : `${size}×${size}`}
              </button>
            ))}
          </div>
        </div>
        <p className="text-[10px] text-textDim">Un promedio del área evita tomar un color "raro" en bordes con anti-aliasing o texturas.</p>
        <div>
          <div className="text-xs text-textDim mb-1">Muestrear</div>
          <div className="flex gap-1">
            <button
              onClick={() => setEyedropperSampleAllLayers(false)}
              className={`flex-1 text-[10px] rounded py-1 ${!eyedropperSampleAllLayers ? 'bg-accent text-white' : 'bg-panel text-textDim hover:text-text'}`}
            >
              Capa actual
            </button>
            <button
              onClick={() => setEyedropperSampleAllLayers(true)}
              className={`flex-1 text-[10px] rounded py-1 ${eyedropperSampleAllLayers ? 'bg-accent text-white' : 'bg-panel text-textDim hover:text-text'}`}
            >
              Todas las capas
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (currentTool === 'lasso') {
    return (
      <div className="p-2 border-t border-border">
        <p className="text-[10px] text-textDim">Arrastrá para dibujar el contorno de la selección — se cierra solo al soltar.</p>
      </div>
    );
  }

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
      <div>
        <div className="flex justify-between text-xs text-textDim mb-1">
          <span>Suavizado</span>
          <span>{Math.round((currentBrush.smoothing ?? 0) * 100)}%</span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          value={(currentBrush.smoothing ?? 0) * 100}
          onChange={(e) => updateCurrentBrush({ smoothing: Number(e.target.value) / 100 })}
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
