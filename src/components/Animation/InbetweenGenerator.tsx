import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/store/appStore';
import { TweenEasing, TWEEN_EASING_LABELS } from '@/types/animation';

const EASINGS = Object.keys(TWEEN_EASING_LABELS) as TweenEasing[];

export default function InbetweenGenerator() {
  const { t } = useTranslation('panelsProduction');
  const project = useAppStore((s) => s.project);
  const generateInbetweenFrames = useAppStore((s) => s.generateInbetweenFrames);
  const [count, setCount] = useState(2);
  const [easing, setEasing] = useState<TweenEasing>('linear');

  const anim = project?.animation;
  const hasNextFrame = !!anim && anim.currentFrameIndex < anim.frames.length - 1;

  return (
    <div className="border border-border rounded p-2 mb-2 space-y-1.5">
      <div className="text-[10px] text-textDim">
        {t('animation.inbetween.hint')}
      </div>
      <div className="flex items-center gap-1.5">
        <label className="flex items-center gap-1 text-[10px] text-textDim">
          {t('animation.inbetween.count')}
          <input
            type="number"
            min={1}
            max={10}
            value={count}
            onChange={(e) => setCount(Math.max(1, Math.min(10, Number(e.target.value))))}
            className="w-10 bg-panel border border-border rounded px-1 py-0.5"
          />
        </label>
        <select
          value={easing}
          onChange={(e) => setEasing(e.target.value as TweenEasing)}
          className="flex-1 bg-panel border border-border rounded text-[10px] px-1 py-0.5"
        >
          {EASINGS.map((e) => (
            <option key={e} value={e}>
              {TWEEN_EASING_LABELS[e]}
            </option>
          ))}
        </select>
      </div>
      <button
        onClick={() => generateInbetweenFrames(count, easing)}
        disabled={!hasNextFrame}
        title={hasNextFrame ? undefined : t('animation.inbetween.noNextFrameTitle')}
        className="w-full bg-panelLight text-[11px] rounded py-1.5 disabled:opacity-40"
      >
        {t('animation.inbetween.generate')}
      </button>
    </div>
  );
}
