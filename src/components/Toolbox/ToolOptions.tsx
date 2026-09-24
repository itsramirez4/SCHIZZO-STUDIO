import { useTranslation } from 'react-i18next';
import { useTools } from '@/hooks/useTools';
import { useBrush } from '@/hooks/useBrush';
import { useAppStore } from '@/store/appStore';
import { useWarpToolStore } from '@/store/warpToolStore';
import { LiquifyMode } from '@/services/warpTool.service';
import { useFillOptionsStore, useSmudgeStore } from '@/store/fillOptionsStore';

const WARP_MODES: LiquifyMode[] = ['push', 'twirl', 'pinch', 'expand', 'turbulence', 'smooth'];

export default function ToolOptions() {
  const { t } = useTranslation('panelsPaint');
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

  if (currentTool === 'paintbucket') {
    return <FillOptions />;
  }

  if (currentTool === 'smudge') {
    return <SmudgeOptions />;
  }

  if (currentTool === 'warp') {
    return (
      <div className="p-2 border-t border-border space-y-2">
        <select
          value={warpMode}
          onChange={(e) => setWarpMode(e.target.value as LiquifyMode)}
          className="w-full bg-panel border border-border rounded text-[10px] px-1.5 py-1"
        >
          {WARP_MODES.map((m) => (
            <option key={m} value={m}>{t(`toolOptions.warpModes.${m}`)}</option>
          ))}
        </select>
        <div>
          <div className="flex justify-between text-xs text-textDim mb-1">
            <span>{t('toolOptions.brushSize')}</span>
            <span>{warpRadius}px</span>
          </div>
          <input type="range" min={5} max={300} value={warpRadius} onChange={(e) => setWarpRadius(Number(e.target.value))} className="w-full" />
        </div>
        <div>
          <div className="flex justify-between text-xs text-textDim mb-1">
            <span>{t('toolOptions.strength')}</span>
            <span>{warpStrength}%</span>
          </div>
          <input type="range" min={1} max={100} value={warpStrength} onChange={(e) => setWarpStrength(Number(e.target.value))} className="w-full" />
        </div>
        <p className="text-[10px] text-textDim">{t('toolOptions.warpHint')}</p>
      </div>
    );
  }

  if (currentTool === 'magicWand') {
    return (
      <div className="p-2 border-t border-border space-y-2">
        <div>
          <div className="flex justify-between text-xs text-textDim mb-1">
            <span>{t('toolOptions.tolerance')}</span>
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
        <p className="text-[10px] text-textDim">{t('toolOptions.magicWandHint')}</p>
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
            {t('toolOptions.linear')}
          </button>
          <button
            onClick={() => setGradientToolMode('radial')}
            className={`flex-1 text-[10px] rounded py-1 ${gradientToolMode === 'radial' ? 'bg-accent text-white' : 'bg-panel text-textDim hover:text-text'}`}
          >
            {t('toolOptions.radial')}
          </button>
        </div>
        <p className="text-[10px] text-textDim">
          {gradientToolMode === 'radial'
            ? t('toolOptions.gradientHintRadial')
            : t('toolOptions.gradientHintLinear')}
        </p>
      </div>
    );
  }

  if (currentTool === 'eyedropper') {
    return (
      <div className="p-2 border-t border-border space-y-2">
        <div>
          <div className="text-xs text-textDim mb-1">{t('toolOptions.sampleSize')}</div>
          <div className="flex gap-1">
            {([1, 3, 5] as const).map((size) => (
              <button
                key={size}
                onClick={() => setEyedropperSampleSize(size)}
                className={`flex-1 text-[10px] rounded py-1 ${eyedropperSampleSize === size ? 'bg-accent text-white' : 'bg-panel text-textDim hover:text-text'}`}
              >
                {size === 1 ? t('toolOptions.samplePixel') : t('toolOptions.sampleSizeSquare', { size })}
              </button>
            ))}
          </div>
        </div>
        <p className="text-[10px] text-textDim">{t('toolOptions.eyedropperAverageHint')}</p>
        <div>
          <div className="text-xs text-textDim mb-1">{t('toolOptions.sampleFrom')}</div>
          <div className="flex gap-1">
            <button
              onClick={() => setEyedropperSampleAllLayers(false)}
              className={`flex-1 text-[10px] rounded py-1 ${!eyedropperSampleAllLayers ? 'bg-accent text-white' : 'bg-panel text-textDim hover:text-text'}`}
            >
              {t('toolOptions.currentLayer')}
            </button>
            <button
              onClick={() => setEyedropperSampleAllLayers(true)}
              className={`flex-1 text-[10px] rounded py-1 ${eyedropperSampleAllLayers ? 'bg-accent text-white' : 'bg-panel text-textDim hover:text-text'}`}
            >
              {t('toolOptions.allLayers')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (currentTool === 'lasso') {
    return (
      <div className="p-2 border-t border-border">
        <p className="text-[10px] text-textDim">{t('toolOptions.lassoHint')}</p>
      </div>
    );
  }

  if (!['brush', 'eraser', 'line', 'curve'].includes(currentTool)) return null;
  const isBrushLike = currentTool === 'brush' || currentTool === 'line' || currentTool === 'curve';

  return (
    <div className="p-2 border-t border-border space-y-2">
      <div>
        <div className="flex justify-between text-xs text-textDim mb-1">
          <span>{t('toolOptions.size')}</span>
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
          <span>{t('toolOptions.smoothing')}</span>
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
      {isBrushLike && (
        <>
          <OptionSlider label={t('toolOptions.taperStart')} value={currentBrush.taperStart ?? 0} min={0} max={200} unit="px" onChange={(v) => updateCurrentBrush({ taperStart: v })} />
          {currentTool !== 'brush' && (
            <OptionSlider label={t('toolOptions.taperEnd')} value={currentBrush.taperEnd ?? 0} min={0} max={200} unit="px" onChange={(v) => updateCurrentBrush({ taperEnd: v })} />
          )}
        </>
      )}
      {isBrushLike && (
        <>
          <div>
            <div className="flex justify-between text-xs text-textDim mb-1">
              <span>{t('toolOptions.hardness')}</span>
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
              <span>{t('toolOptions.opacity')}</span>
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
          <div>
            <div className="flex justify-between text-xs text-textDim mb-1" title={t('toolOptions.flowTitle')}>
              <span>{t('toolOptions.flow')}</span>
              <span>{currentBrush.flow === undefined ? t('toolOptions.flowClassic') : `${Math.round(currentBrush.flow * 100)}%`}</span>
            </div>
            <input
              type="range"
              min={1}
              max={100}
              value={(currentBrush.flow ?? 1) * 100}
              onChange={(e) => updateCurrentBrush({ flow: Number(e.target.value) / 100 })}
              className="w-full"
            />
          </div>
        </>
      )}
    </div>
  );
}

function OptionSlider({ label, value, min, max, step = 1, unit = '', onChange }: { label: string; value: number; min: number; max: number; step?: number; unit?: string; onChange: (v: number) => void }) {
  return (
    <div>
      <div className="flex justify-between text-xs text-textDim mb-1">
        <span>{label}</span>
        <span>
          {value}
          {unit}
        </span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full" />
    </div>
  );
}

function FillOptions() {
  const { t } = useTranslation('panelsPaint');
  const o = useFillOptionsStore();
  return (
    <div className="p-2 border-t border-border space-y-2">
      <label className="flex items-center gap-2 text-xs">
        <input type="checkbox" checked={o.smart} onChange={(e) => o.set({ smart: e.target.checked })} />
        {t('toolOptions.smartFill')}
      </label>
      {o.smart && (
        <>
          <label className="flex items-center gap-2 text-[11px] text-textDim">
            <input type="checkbox" checked={o.sampleAllLayers} onChange={(e) => o.set({ sampleAllLayers: e.target.checked })} />
            {t('toolOptions.sampleAllLayers')}
          </label>
          <OptionSlider label={t('toolOptions.tolerance')} value={o.tolerance} min={0} max={128} onChange={(v) => o.set({ tolerance: v })} />
          <OptionSlider label={t('toolOptions.closeGaps')} value={o.gapClose} min={0} max={8} unit="px" onChange={(v) => o.set({ gapClose: v })} />
          <OptionSlider label={t('toolOptions.growUnderLine')} value={o.grow} min={0} max={4} unit="px" onChange={(v) => o.set({ grow: v })} />
          <p className="text-[10px] text-textDim">
            {t('toolOptions.fillHint')}
          </p>
        </>
      )}
    </div>
  );
}

function SmudgeOptions() {
  const { t } = useTranslation('panelsPaint');
  const o = useSmudgeStore();
  return (
    <div className="p-2 border-t border-border space-y-2">
      <OptionSlider label={t('toolOptions.size')} value={o.size} min={6} max={200} unit="px" onChange={(v) => o.set({ size: v })} />
      <OptionSlider label={t('toolOptions.dragStrength')} value={Math.round(o.strength * 100)} min={5} max={100} unit="%" onChange={(v) => o.set({ strength: v / 100 })} />
      <OptionSlider label={t('toolOptions.colorLoad')} value={Math.round(o.paintLoad * 100)} min={0} max={60} unit="%" onChange={(v) => o.set({ paintLoad: v / 100 })} />
      <p className="text-[10px] text-textDim">{t('toolOptions.smudgeHint')}</p>
    </div>
  );
}
