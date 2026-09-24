import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/store/appStore';
import { useTools } from '@/hooks/useTools';
import { useLayers } from '@/hooks/useLayers';

/** Shown whenever a selection-related tool is active (to offer Color Range as a way to start a
 * selection) or whenever any selection already exists (to offer the modifiers) — kept out of
 * the way otherwise, since the toolbox already stacks several conditional panels. */
export default function SelectionModifiers() {
  const { t } = useTranslation('panelsPaint');
  const { currentTool, primaryColor } = useTools();
  const { currentLayer } = useLayers();
  const selection = useAppStore((s) => s.selection);
  const invertSelection = useAppStore((s) => s.invertSelection);
  const featherSelection = useAppStore((s) => s.featherSelection);
  const expandSelection = useAppStore((s) => s.expandSelection);
  const contractSelection = useAppStore((s) => s.contractSelection);
  const selectColorRange = useAppStore((s) => s.selectColorRange);

  const [amount, setAmount] = useState(4);
  const [colorTolerance, setColorTolerance] = useState(32);

  const relevantTool = currentTool === 'selection' || currentTool === 'lasso' || currentTool === 'magicWand';
  if (!relevantTool && !selection) return null;

  return (
    <div className="p-2 border-t border-border space-y-2">
      <div className="text-[10px] text-textDim uppercase tracking-wide">{t('selectionModifiers.colorRange')}</div>
      <div className="flex items-center gap-2">
        <input
          type="range"
          min={0}
          max={255}
          value={colorTolerance}
          onChange={(e) => setColorTolerance(Number(e.target.value))}
          className="flex-1"
        />
        <span className="text-[10px] text-textDim w-8 text-right">{colorTolerance}</span>
      </div>
      <button
        onClick={() => selectColorRange(primaryColor, colorTolerance)}
        disabled={!currentLayer}
        className="w-full text-[11px] bg-panelLight rounded py-1.5 disabled:opacity-40"
        title={t('selectionModifiers.selectPrimaryTitle')}
      >
        {t('selectionModifiers.selectPrimary')}
      </button>

      {selection && (
        <>
          <hr className="border-border" />
          <div className="text-[10px] text-textDim uppercase tracking-wide">{t('selectionModifiers.modifySelection')}</div>
          <div className="grid grid-cols-2 gap-1">
            <button onClick={invertSelection} className="text-[11px] bg-panelLight rounded py-1">
              {t('selectionModifiers.invert')}
            </button>
            <button onClick={() => featherSelection(amount)} className="text-[11px] bg-panelLight rounded py-1">
              {t('selectionModifiers.feather')}
            </button>
            <button onClick={() => expandSelection(amount)} className="text-[11px] bg-panelLight rounded py-1">
              {t('selectionModifiers.expand')}
            </button>
            <button onClick={() => contractSelection(amount)} className="text-[11px] bg-panelLight rounded py-1">
              {t('selectionModifiers.contract')}
            </button>
          </div>
          <label className="flex items-center gap-2 text-[10px] text-textDim">
            {t('selectionModifiers.amount')}
            <input
              type="number"
              min={1}
              max={100}
              value={amount}
              onChange={(e) => setAmount(Math.max(1, Number(e.target.value)))}
              className="w-14 bg-panel border border-border rounded px-1 py-0.5"
            />
          </label>
        </>
      )}
    </div>
  );
}
