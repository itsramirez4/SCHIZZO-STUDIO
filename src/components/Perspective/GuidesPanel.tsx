import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/store/appStore';
import { usePerspectiveStore } from '@/store/perspectiveStore';
import { Lock, Unlock, Eye, EyeOff, Trash2 } from 'lucide-react';
import { SnapTarget } from '@/types/perspective';

const SNAP_TARGETS: SnapTarget[] = ['guides', 'perspectiveGrid', 'canvas', 'pixelGrid'];

export default function GuidesPanel() {
  const { t } = useTranslation('panelsProduction');
  const project = useAppStore((s) => s.project);
  const toggleRulerVisible = useAppStore((s) => s.toggleRulerVisible);
  const guides = usePerspectiveStore((s) => s.guides);
  const addGuide = usePerspectiveStore((s) => s.addGuide);
  const removeGuide = usePerspectiveStore((s) => s.removeGuide);
  const moveGuide = usePerspectiveStore((s) => s.moveGuide);
  const toggleGuideLocked = usePerspectiveStore((s) => s.toggleGuideLocked);
  const toggleGuideVisible = usePerspectiveStore((s) => s.toggleGuideVisible);
  const clearGuides = usePerspectiveStore((s) => s.clearGuides);
  const snap = usePerspectiveStore((s) => s.snap);
  const updateSnapSettings = usePerspectiveStore((s) => s.updateSnapSettings);
  const toggleSnapTarget = usePerspectiveStore((s) => s.toggleSnapTarget);

  if (!project) return null;

  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 text-[11px]">
        <input type="checkbox" checked={project.settings.rulerVisible} onChange={toggleRulerVisible} />
        {t('perspective.guides.showRulers')}
      </label>
      <p className="text-[9px] text-textDim">{t('perspective.guides.rulerHint')}</p>

      <div className="flex gap-1.5">
        <button onClick={() => addGuide('vertical', project.width / 2, 0)} className="flex-1 text-[10px] bg-panelLight rounded py-1">
          {t('perspective.guides.addVertical')}
        </button>
        <button onClick={() => addGuide('horizontal', 0, project.height / 2)} className="flex-1 text-[10px] bg-panelLight rounded py-1">
          {t('perspective.guides.addHorizontal')}
        </button>
      </div>
      <button onClick={() => addGuide('diagonal', project.width / 2, project.height / 2, 45)} className="w-full text-[10px] bg-panelLight rounded py-1">
        {t('perspective.guides.addDiagonal')}
      </button>

      <div className="space-y-1">
        {guides.length === 0 ? (
          <p className="text-[9px] text-textDim">{t('perspective.guides.empty')}</p>
        ) : (
          guides.map((g) => (
            <div key={g.id} className="flex items-center gap-1.5 text-[10px] bg-panel rounded px-1.5 py-1">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: g.color }} />
              <span className="w-14 shrink-0 text-textDim">
                {g.type === 'vertical' ? t('perspective.guides.typeVertical') : g.type === 'horizontal' ? t('perspective.guides.typeHorizontal') : t('perspective.guides.typeDiagonal')}
              </span>
              {g.type !== 'horizontal' && (
                <input
                  type="number"
                  value={Math.round(g.x ?? 0)}
                  onChange={(e) => moveGuide(g.id, Number(e.target.value), undefined)}
                  className="w-14 bg-panelLight border border-border rounded px-1 py-0.5"
                />
              )}
              {g.type !== 'vertical' && (
                <input
                  type="number"
                  value={Math.round(g.y ?? 0)}
                  onChange={(e) => moveGuide(g.id, undefined, Number(e.target.value))}
                  className="w-14 bg-panelLight border border-border rounded px-1 py-0.5"
                />
              )}
              <button onClick={() => toggleGuideVisible(g.id)} className="text-textDim hover:text-text ml-auto" title={g.visible ? t('perspective.guides.hide') : t('perspective.guides.show')}>
                {g.visible ? <Eye size={11} /> : <EyeOff size={11} />}
              </button>
              <button onClick={() => toggleGuideLocked(g.id)} className="text-textDim hover:text-text" title={g.locked ? t('perspective.guides.unlock') : t('perspective.guides.lock')}>
                {g.locked ? <Lock size={11} /> : <Unlock size={11} />}
              </button>
              <button onClick={() => removeGuide(g.id)} className="text-textDim hover:text-red-400" title={t('perspective.guides.delete')}>
                <Trash2 size={11} />
              </button>
            </div>
          ))
        )}
        {guides.length > 0 && (
          <button onClick={clearGuides} className="w-full text-[9px] text-textDim hover:text-text">
            {t('perspective.guides.deleteAll')}
          </button>
        )}
      </div>

      <div className="border-t border-border pt-2 space-y-1.5">
        <label className="flex items-center gap-2 text-[11px]">
          <input type="checkbox" checked={snap.enabled} onChange={(e) => updateSnapSettings({ enabled: e.target.checked })} />
          {t('perspective.guides.snapToggle')}
        </label>
        <p className="text-[9px] text-textDim">
          {t('perspective.guides.snapHint')}
        </p>
        {SNAP_TARGETS.map((target) => (
          <label key={target} className="flex items-center gap-2 text-[10px]">
            <input type="checkbox" checked={snap.targets.includes(target)} onChange={() => toggleSnapTarget(target)} disabled={!snap.enabled} />
            {t(`perspective.guides.snapTargets.${target}`)}
          </label>
        ))}
        <label className="flex items-center gap-2 text-[9px] text-textDim">
          <span className="w-16">{t('perspective.guides.tolerance')}</span>
          <input
            type="range"
            min={2}
            max={30}
            step={1}
            value={snap.tolerance}
            onChange={(e) => updateSnapSettings({ tolerance: Number(e.target.value) })}
            className="flex-1"
          />
          <span className="w-8 text-right">{snap.tolerance}px</span>
        </label>
      </div>
    </div>
  );
}
