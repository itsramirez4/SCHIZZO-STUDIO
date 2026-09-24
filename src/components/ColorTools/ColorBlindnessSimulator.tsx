import { useTranslation } from 'react-i18next';
import { ColorBlindnessType, COLOR_BLINDNESS_LABELS } from '@/types/colorTools';
import { simulateColor, areDistinguishable } from '@/services/colorBlindness.service';
import { hexToRgbaColor, rgbaColorToHex } from '@/services/colorSpace.service';
import { useTools } from '@/hooks/useTools';

const TYPES = Object.keys(COLOR_BLINDNESS_LABELS) as ColorBlindnessType[];

export default function ColorBlindnessSimulator() {
  const { t } = useTranslation('panelsColor');
  const { primaryColor, secondaryColor } = useTools();
  const primary = hexToRgbaColor(primaryColor);
  const secondary = hexToRgbaColor(secondaryColor);

  return (
    <div className="space-y-4">
      <p className="text-[10px] text-textDim">
        {t('colorBlindnessSimulator.intro')}
      </p>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <div className="text-[10px] text-textDim mb-1">{t('colorBlindnessSimulator.primary')}</div>
          <div className="h-10 rounded border border-border" style={{ background: primaryColor }} />
        </div>
        <div>
          <div className="text-[10px] text-textDim mb-1">{t('colorBlindnessSimulator.secondary')}</div>
          <div className="h-10 rounded border border-border" style={{ background: secondaryColor }} />
        </div>
      </div>

      <div className="space-y-2">
        {TYPES.map((type) => {
          const simPrimary = simulateColor(primary, type);
          const simSecondary = simulateColor(secondary, type);
          const distinguishable = areDistinguishable(primary, secondary, type);
          return (
            <div key={type} className="border border-border rounded p-2">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] text-text">{COLOR_BLINDNESS_LABELS[type]}</span>
                <span className={`text-[10px] ${distinguishable ? 'text-green-400' : 'text-amber-400'}`}>
                  {distinguishable ? t('colorBlindnessSimulator.distinguishable') : t('colorBlindnessSimulator.notDistinguishable')}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="h-8 rounded border border-border" style={{ background: rgbaColorToHex(simPrimary) }} title={rgbaColorToHex(simPrimary)} />
                <div className="h-8 rounded border border-border" style={{ background: rgbaColorToHex(simSecondary) }} title={rgbaColorToHex(simSecondary)} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
