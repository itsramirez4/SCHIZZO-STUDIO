import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useTools } from '@/hooks/useTools';
import { mixLight, mixPigments } from '@/services/pigmentMix.service';

/** Two-colour pigment mixer with a "how paint behaves" ramp next to the digital (light) blend. */
export default function PigmentMixer() {
  const { t } = useTranslation('panelsColor');
  const { primaryColor, secondaryColor, setPrimaryColor } = useTools();
  const [a, setA] = useState(primaryColor);
  const [b, setB] = useState(secondaryColor);
  const [ratio, setRatio] = useState(50);

  const ramp = useMemo(() => Array.from({ length: 9 }, (_, i) => mixPigments([{ hex: a, weight: 8 - i }, { hex: b, weight: i }])), [a, b]);
  const mixed = useMemo(() => mixPigments([{ hex: a, weight: 100 - ratio }, { hex: b, weight: ratio }]), [a, b, ratio]);
  const light = mixLight(a, b, ratio / 100);

  return (
    <div className="space-y-3">
      <p className="text-[10px] text-textDim">
        {t('pigmentMixer.intro')}
      </p>
      <div className="flex items-center gap-2">
        <input type="color" value={a} onChange={(e) => setA(e.target.value)} className="w-9 h-7 bg-transparent" title={t('pigmentMixer.colorA')} />
        <input type="range" min={0} max={100} value={ratio} onChange={(e) => setRatio(Number(e.target.value))} className="flex-1" />
        <input type="color" value={b} onChange={(e) => setB(e.target.value)} className="w-9 h-7 bg-transparent" title={t('pigmentMixer.colorB')} />
      </div>
      <div className="text-[10px] text-textDim text-center">{t('pigmentMixer.ratioDisplay', { a: 100 - ratio, b: ratio })}</div>

      <div className="flex gap-2">
        <div className="flex-1">
          <div className="h-12 rounded border border-border" style={{ background: mixed }} />
          <div className="text-[10px] text-center mt-1">{t('pigmentMixer.pigmentResult', { hex: mixed })}</div>
        </div>
        <div className="flex-1">
          <div className="h-12 rounded border border-border" style={{ background: light }} />
          <div className="text-[10px] text-center mt-1 text-textDim">{t('pigmentMixer.lightResult', { hex: light })}</div>
        </div>
      </div>

      <div>
        <div className="text-[10px] text-textDim mb-1">{t('pigmentMixer.rampTitle')}</div>
        <div className="flex h-8 rounded overflow-hidden border border-border">
          {ramp.map((c, i) => (
            <button
              key={i}
              title={t('pigmentMixer.useAsMainColor', { hex: c })}
              onClick={() => {
                setPrimaryColor(c);
                toast.success(t('pigmentMixer.mainColorToast', { hex: c }));
              }}
              className="flex-1"
              style={{ background: c }}
            />
          ))}
        </div>
      </div>

      <button
        onClick={() => {
          setPrimaryColor(mixed);
          toast.success(t('pigmentMixer.mixApplied'));
        }}
        className="w-full bg-accent text-white text-[11px] rounded py-1.5"
      >
        {t('pigmentMixer.useMixAsMain')}
      </button>
    </div>
  );
}
