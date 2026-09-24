import { useTranslation } from 'react-i18next';
import { Layer, FillType } from '@/types';
import { useLayers } from '@/hooks/useLayers';
import { PATTERN_PRESETS, getPatternTile } from '@/services/pattern.service';

const FILL_TYPE_IDS: FillType[] = ['solid', 'gradient', 'pattern'];

export default function FillEditor({ layer }: { layer: Layer }) {
  const { t } = useTranslation('panelsPaint');
  const { setFillType, setFillProps, commitFillProps } = useLayers();
  const fillType = layer.fillType ?? 'solid';

  return (
    <div className="space-y-1.5">
      <div className="flex gap-1">
        {FILL_TYPE_IDS.map((id) => (
          <button
            key={id}
            onClick={() => setFillType(layer.id, id)}
            className={`flex-1 text-[10px] rounded py-1 border ${
              fillType === id ? 'bg-accent text-white border-accent' : 'bg-panel border-border text-textDim hover:text-text'
            }`}
          >
            {t(`fillEditor.fillTypes.${id}`)}
          </button>
        ))}
      </div>

      {fillType === 'solid' && (
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-textDim w-14">{t('fillEditor.color')}</span>
          <input
            type="color"
            title={t('fillEditor.fillColorTitle')}
            value={layer.fillColor ?? '#808080'}
            onChange={(e) => {
              setFillProps(layer.id, { fillColor: e.target.value });
              commitFillProps();
            }}
            className="w-8 h-6 bg-transparent border border-border rounded cursor-pointer"
          />
        </div>
      )}

      {fillType === 'gradient' && (
        <div className="space-y-1.5">
          <div className="flex gap-1">
            {(['linear', 'radial'] as const).map((kind) => (
              <button
                key={kind}
                onClick={() => {
                  setFillProps(layer.id, { gradient: { ...(layer.gradient ?? { color1: '#000000', color2: '#ffffff', angle: 0, kind }), kind } });
                  commitFillProps();
                }}
                className={`flex-1 text-[10px] rounded py-1 border ${
                  layer.gradient?.kind === kind ? 'bg-accent text-white border-accent' : 'bg-panel border-border text-textDim hover:text-text'
                }`}
              >
                {kind === 'linear' ? t('fillEditor.linear') : t('fillEditor.radial')}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-textDim w-14">{t('fillEditor.color1')}</span>
            <input
              type="color"
              title={t('fillEditor.color1Title')}
              value={layer.gradient?.color1 ?? '#000000'}
              onChange={(e) => {
                setFillProps(layer.id, { gradient: { ...(layer.gradient ?? { kind: 'linear', color2: '#ffffff', angle: 0 }), color1: e.target.value } as Layer['gradient'] });
                commitFillProps();
              }}
              className="w-8 h-6 bg-transparent border border-border rounded cursor-pointer"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-textDim w-14">{t('fillEditor.color2')}</span>
            <input
              type="color"
              title={t('fillEditor.color2Title')}
              value={layer.gradient?.color2 ?? '#ffffff'}
              onChange={(e) => {
                setFillProps(layer.id, { gradient: { ...(layer.gradient ?? { kind: 'linear', color1: '#000000', angle: 0 }), color2: e.target.value } as Layer['gradient'] });
                commitFillProps();
              }}
              className="w-8 h-6 bg-transparent border border-border rounded cursor-pointer"
            />
          </div>
          {layer.gradient?.kind !== 'radial' && (
            <div>
              <div className="flex justify-between text-[10px] text-textDim mb-0.5">
                <span>{t('fillEditor.angle')}</span>
                <span>{layer.gradient?.angle ?? 0}°</span>
              </div>
              <input
                type="range"
                title={t('fillEditor.angle')}
                min={0}
                max={359}
                value={layer.gradient?.angle ?? 0}
                onChange={(e) =>
                  setFillProps(layer.id, {
                    gradient: { ...(layer.gradient ?? { kind: 'linear', color1: '#000000', color2: '#ffffff' }), angle: Number(e.target.value) } as Layer['gradient'],
                  })
                }
                onPointerUp={commitFillProps}
                onKeyUp={commitFillProps}
                className="w-full"
              />
            </div>
          )}
        </div>
      )}

      {fillType === 'pattern' && (
        <div className="space-y-1.5">
          <div className="grid grid-cols-4 gap-1">
            {PATTERN_PRESETS.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  setFillProps(layer.id, { patternId: p.id });
                  commitFillProps();
                }}
                title={p.name}
                className={`aspect-square rounded border overflow-hidden ${
                  (layer.patternId ?? 'lines-diagonal') === p.id ? 'border-accent' : 'border-border'
                }`}
                style={{
                  backgroundImage: `url(${getPatternTile(p.id, layer.patternColor ?? '#000000').toDataURL()})`,
                  backgroundSize: '10px 10px',
                }}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-textDim w-14">{t('fillEditor.color')}</span>
            <input
              type="color"
              value={layer.patternColor ?? '#000000'}
              onChange={(e) => {
                setFillProps(layer.id, { patternColor: e.target.value });
                commitFillProps();
              }}
              className="w-8 h-6 bg-transparent border border-border rounded cursor-pointer"
            />
          </div>
        </div>
      )}
    </div>
  );
}
