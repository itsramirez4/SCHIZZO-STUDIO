import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTools } from '@/hooks/useTools';
import { useLayers } from '@/hooks/useLayers';
import { useAppStore } from '@/store/appStore';
import * as layerService from '@/services/layer.service';
import { PATTERN_PRESETS, getPatternTile, fillWithPattern } from '@/services/pattern.service';

export default function PatternFill() {
  const { t } = useTranslation('panelsPaint');
  const { currentTool, primaryColor } = useTools();
  const { currentLayer } = useLayers();
  const selection = useAppStore((s) => s.selection);
  const pushHistory = useAppStore((s) => s.pushHistory);
  const [selectedId, setSelectedId] = useState(PATTERN_PRESETS[0].id);

  if (currentTool !== 'paintbucket') return null;

  function apply() {
    if (!currentLayer || currentLayer.locked) return;
    const canvas = layerService.getLayerCanvas(currentLayer.id);
    if (!canvas) return;
    fillWithPattern(canvas, selectedId, primaryColor, selection ?? undefined);
    pushHistory(t('patternFill.fillHistory'));
  }

  return (
    <div className="p-2 border-t border-border space-y-1.5">
      <div className="text-xs text-textDim">{t('patternFill.patterns')}</div>
      <div className="grid grid-cols-4 gap-1">
        {PATTERN_PRESETS.map((p) => (
          <button
            key={p.id}
            onClick={() => setSelectedId(p.id)}
            title={p.name}
            className={`aspect-square rounded border overflow-hidden ${
              selectedId === p.id ? 'border-accent' : 'border-border'
            }`}
            style={{
              backgroundImage: `url(${getPatternTile(p.id, primaryColor).toDataURL()})`,
              backgroundSize: '10px 10px',
            }}
          />
        ))}
      </div>
      <button
        onClick={apply}
        disabled={!currentLayer}
        className="w-full bg-accent text-white text-xs rounded py-1.5 disabled:opacity-40"
      >
        {selection ? t('patternFill.fillSelection') : t('patternFill.fillLayer')}
      </button>
    </div>
  );
}
