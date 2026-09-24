import { useTranslation } from 'react-i18next';
import { useTools } from '@/hooks/useTools';
import { useShapeStore } from '@/store/shapeStore';
import { useVectorTextStore } from '@/store/vectorTextStore';
import { BooleanOp, ShapeKind } from '@/types/vectorShapes';

const SHAPE_TOOL_KIND: Partial<Record<string, ShapeKind>> = {
  shapeRect: 'rectangle',
  shapeEllipse: 'ellipse',
  shapePolygon: 'polygon',
  shapeStar: 'star',
};

const BOOLEAN_OPS: BooleanOp[] = ['union', 'subtract', 'intersect', 'exclude'];

/** Shape/text params + stroke/fill editor + commit actions — shown while a shape or vector-text
 * tool is active, or while a draft/saved slot is still pending after switching away. Vector text
 * reuses this same stroke/fill editor (both are "draft then bake" vector content) instead of a
 * duplicate one. */
export default function ShapeToolOptions() {
  const { t } = useTranslation('panelsPaint');
  const { currentTool } = useTools();
  const shapeDraft = useShapeStore((s) => s.shapeDraft);
  const pendingSlotA = useShapeStore((s) => s.pendingSlotA);
  const cornerRadius = useShapeStore((s) => s.cornerRadius);
  const sides = useShapeStore((s) => s.sides);
  const innerRadiusRatio = useShapeStore((s) => s.innerRadiusRatio);
  const stroke = useShapeStore((s) => s.stroke);
  const fill = useShapeStore((s) => s.fill);
  const setCornerRadius = useShapeStore((s) => s.setCornerRadius);
  const setSides = useShapeStore((s) => s.setSides);
  const setInnerRadiusRatio = useShapeStore((s) => s.setInnerRadiusRatio);
  const setStroke = useShapeStore((s) => s.setStroke);
  const setFill = useShapeStore((s) => s.setFill);
  const commitDraft = useShapeStore((s) => s.commitDraft);
  const saveDraftAsSlotA = useShapeStore((s) => s.saveDraftAsSlotA);
  const performBoolean = useShapeStore((s) => s.performBoolean);
  const performDivide = useShapeStore((s) => s.performDivide);
  const cancelAll = useShapeStore((s) => s.cancelAll);

  const isTextTool = currentTool === 'vectorText';
  const textDraft = useVectorTextStore((s) => s.textDraft);
  const textFontSize = useVectorTextStore((s) => s.fontSize);
  const setTextFontSize = useVectorTextStore((s) => s.setFontSize);
  const commitTextDraft = useVectorTextStore((s) => s.commitDraft);
  const cancelTextDraft = useVectorTextStore((s) => s.cancel);

  const kind = shapeDraft?.kind ?? SHAPE_TOOL_KIND[currentTool];
  if (!kind && !pendingSlotA && !isTextTool && !textDraft) return null;

  return (
    <div className="p-2 border-t border-border space-y-2">
      {isTextTool || textDraft ? (
        <>
          <div className="text-[10px] text-textDim uppercase tracking-wide">{t('shapeToolOptions.vectorText')}</div>
          <label className="flex items-center gap-2 text-[10px] text-textDim">
            {t('shapeToolOptions.size')}
            <input
              type="range"
              min={8}
              max={300}
              value={textFontSize}
              onChange={(e) => setTextFontSize(Number(e.target.value))}
              className="flex-1"
            />
            <span className="w-9 text-right">{textFontSize}px</span>
          </label>
          {!textDraft && <p className="text-[10px] text-textDim">{t('shapeToolOptions.textHint')}</p>}
        </>
      ) : (
        <>
          <div className="text-[10px] text-textDim uppercase tracking-wide">{t('shapeToolOptions.shape')}</div>

          {kind === 'rectangle' && (
            <label className="flex items-center gap-2 text-[10px] text-textDim">
              {t('shapeToolOptions.cornerRadius')}
              <input
                type="range"
                min={0}
                max={100}
                value={cornerRadius}
                onChange={(e) => setCornerRadius(Number(e.target.value))}
                className="flex-1"
              />
              <span className="w-7 text-right">{cornerRadius}</span>
            </label>
          )}

          {(kind === 'polygon' || kind === 'star') && (
            <label className="flex items-center gap-2 text-[10px] text-textDim">
              {kind === 'star' ? t('shapeToolOptions.points') : t('shapeToolOptions.sides')}
              <input
                type="range"
                min={3}
                max={16}
                value={sides}
                onChange={(e) => setSides(Number(e.target.value))}
                className="flex-1"
              />
              <span className="w-7 text-right">{sides}</span>
            </label>
          )}

          {kind === 'star' && (
            <label className="flex items-center gap-2 text-[10px] text-textDim">
              {t('shapeToolOptions.innerRadius')}
              <input
                type="range"
                min={5}
                max={95}
                value={Math.round(innerRadiusRatio * 100)}
                onChange={(e) => setInnerRadiusRatio(Number(e.target.value) / 100)}
                className="flex-1"
              />
              <span className="w-7 text-right">{Math.round(innerRadiusRatio * 100)}%</span>
            </label>
          )}
        </>
      )}

      <hr className="border-border" />
      <div className="text-[10px] text-textDim uppercase tracking-wide">{t('shapeToolOptions.strokeHeading')}</div>
      <div className="flex items-center gap-2">
        <input type="checkbox" title={t('shapeToolOptions.enableStrokeTitle')} checked={stroke.enabled} onChange={(e) => setStroke({ enabled: e.target.checked })} />
        <input
          type="color"
          value={stroke.color}
          onChange={(e) => setStroke({ color: e.target.value })}
          className="w-7 h-6 rounded border border-border bg-transparent"
          title={t('shapeToolOptions.strokeColorTitle')}
        />
        <input
          type="number"
          min={0}
          max={100}
          value={stroke.width}
          onChange={(e) => setStroke({ width: Math.max(0, Number(e.target.value)) })}
          className="w-12 bg-panel border border-border rounded px-1 py-0.5 text-[11px]"
          title={t('shapeToolOptions.strokeWidthTitle')}
        />
        <label className="flex items-center gap-1 text-[10px] text-textDim">
          <input type="checkbox" checked={stroke.dashed} onChange={(e) => setStroke({ dashed: e.target.checked })} />
          {t('shapeToolOptions.dashed')}
        </label>
      </div>

      <div className="text-[10px] text-textDim uppercase tracking-wide">{t('shapeToolOptions.fillHeading')}</div>
      <div className="flex items-center gap-2">
        <input type="checkbox" title={t('shapeToolOptions.enableFillTitle')} checked={fill.enabled} onChange={(e) => setFill({ enabled: e.target.checked })} />
        <input
          type="color"
          value={fill.color}
          onChange={(e) => setFill({ color: e.target.value })}
          className="w-7 h-6 rounded border border-border bg-transparent"
          title={t('shapeToolOptions.fillColorTitle')}
        />
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(fill.opacity * 100)}
          onChange={(e) => setFill({ opacity: Number(e.target.value) / 100 })}
          className="flex-1"
          title={t('shapeToolOptions.opacityTitle')}
        />
      </div>

      <hr className="border-border" />

      {isTextTool || textDraft ? (
        <div className="grid grid-cols-2 gap-1">
          <button
            onClick={commitTextDraft}
            disabled={!textDraft}
            className="text-[11px] bg-accent text-white rounded py-1 disabled:opacity-40"
            title={t('shapeToolOptions.confirmTitle')}
          >
            {t('shapeToolOptions.confirm')}
          </button>
          <button onClick={cancelTextDraft} disabled={!textDraft} className="text-[11px] bg-panelLight rounded py-1 disabled:opacity-40" title={t('shapeToolOptions.cancelTitle')}>
            {t('common:cancel')}
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-1">
            <button
              onClick={commitDraft}
              disabled={!shapeDraft}
              className="text-[11px] bg-accent text-white rounded py-1 disabled:opacity-40"
              title={t('shapeToolOptions.confirmTitle')}
            >
              {t('shapeToolOptions.confirm')}
            </button>
            <button
              onClick={saveDraftAsSlotA}
              disabled={!shapeDraft}
              className="text-[11px] bg-panelLight rounded py-1 disabled:opacity-40"
              title={t('shapeToolOptions.saveAsShapeATitle')}
            >
              {t('shapeToolOptions.saveAsShapeA')}
            </button>
          </div>

          {pendingSlotA && (
            <>
              <div className="text-[10px] text-textDim">
                {t('shapeToolOptions.shapeASaved')}
              </div>
              <div className="grid grid-cols-2 gap-1">
                {BOOLEAN_OPS.map((op) => (
                  <button
                    key={op}
                    onClick={() => performBoolean(op)}
                    disabled={!shapeDraft}
                    className="text-[11px] bg-panelLight rounded py-1 disabled:opacity-40"
                  >
                    {t(`shapeToolOptions.booleanOps.${op}`)}
                  </button>
                ))}
              </div>
              <button
                onClick={performDivide}
                disabled={!shapeDraft}
                className="w-full text-[11px] bg-panelLight rounded py-1 disabled:opacity-40"
                title={t('shapeToolOptions.divideTitle')}
              >
                {t('shapeToolOptions.divide')}
              </button>
            </>
          )}

          {(shapeDraft || pendingSlotA) && (
            <button onClick={cancelAll} className="w-full text-[11px] bg-panelLight rounded py-1" title={t('shapeToolOptions.cancelTitle')}>
              {t('common:cancel')}
            </button>
          )}
        </>
      )}
    </div>
  );
}
