import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Layer } from '@/types';
import { useAppStore } from '@/store/appStore';
import {
  BevelSettings,
  ColorOverlaySettings,
  DropShadowSettings,
  EFFECT_LABELS,
  EffectType,
  GlowSettings,
  GradientOverlaySettings,
  DEFAULT_DROP_SHADOW,
  DEFAULT_GLOW,
  DEFAULT_BEVEL,
  DEFAULT_COLOR_OVERLAY,
  DEFAULT_GRADIENT_OVERLAY,
  DEFAULT_STROKE,
  StrokeSettings,
} from '@/types/layerEffects';

const EFFECT_TYPES = Object.keys(EFFECT_LABELS) as EffectType[];
const DEFAULTS: Record<EffectType, any> = {
  dropShadow: DEFAULT_DROP_SHADOW,
  innerShadow: DEFAULT_DROP_SHADOW,
  outerGlow: DEFAULT_GLOW,
  innerGlow: DEFAULT_GLOW,
  bevel: DEFAULT_BEVEL,
  colorOverlay: DEFAULT_COLOR_OVERLAY,
  gradientOverlay: DEFAULT_GRADIENT_OVERLAY,
  stroke: DEFAULT_STROKE,
};

interface Props {
  layer: Layer;
}

export default function LayerEffectsEditor({ layer }: Props) {
  const setLayerEffects = useAppStore((s) => s.setLayerEffects);
  const commitLayerEffects = useAppStore((s) => s.commitLayerEffects);
  const [openType, setOpenType] = useState<EffectType | null>(null);

  function updateLive(type: EffectType, patch: Record<string, unknown>) {
    const current = (layer.effects as any)?.[type] ?? DEFAULTS[type];
    setLayerEffects(layer.id, { ...layer.effects, [type]: { ...current, ...patch } });
  }

  function toggleEnabled(type: EffectType) {
    const current = (layer.effects as any)?.[type];
    updateLive(type, { enabled: current ? !current.enabled : true });
    commitLayerEffects();
  }

  return (
    <div className="space-y-1">
      {EFFECT_TYPES.map((type) => {
        const settings = (layer.effects as any)?.[type];
        const isOpen = openType === type;
        return (
          <div key={type} className="bg-panel rounded">
            <div className="flex items-center gap-1.5 px-1.5 py-1">
              <input type="checkbox" checked={!!settings?.enabled} onChange={() => toggleEnabled(type)} />
              <button
                onClick={() => setOpenType(isOpen ? null : type)}
                className="flex-1 flex items-center gap-1 text-[10px] text-left"
              >
                {isOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                {EFFECT_LABELS[type]}
              </button>
            </div>
            {isOpen && (
              <div className="px-1.5 pb-1.5">
                {type === 'dropShadow' && (
                  <ShadowFields settings={settings ?? DEFAULT_DROP_SHADOW} onChange={(p) => updateLive(type, p)} onCommit={commitLayerEffects} />
                )}
                {type === 'innerShadow' && (
                  <ShadowFields settings={settings ?? DEFAULT_DROP_SHADOW} onChange={(p) => updateLive(type, p)} onCommit={commitLayerEffects} />
                )}
                {(type === 'outerGlow' || type === 'innerGlow') && (
                  <GlowFields settings={settings ?? DEFAULT_GLOW} onChange={(p) => updateLive(type, p)} onCommit={commitLayerEffects} />
                )}
                {type === 'bevel' && (
                  <BevelFields settings={settings ?? DEFAULT_BEVEL} onChange={(p) => updateLive(type, p)} onCommit={commitLayerEffects} />
                )}
                {type === 'colorOverlay' && (
                  <ColorOverlayFields settings={settings ?? DEFAULT_COLOR_OVERLAY} onChange={(p) => updateLive(type, p)} onCommit={commitLayerEffects} />
                )}
                {type === 'gradientOverlay' && (
                  <GradientOverlayFields settings={settings ?? DEFAULT_GRADIENT_OVERLAY} onChange={(p) => updateLive(type, p)} onCommit={commitLayerEffects} />
                )}
                {type === 'stroke' && (
                  <StrokeFields settings={settings ?? DEFAULT_STROKE} onChange={(p) => updateLive(type, p)} onCommit={commitLayerEffects} />
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex items-center gap-2 text-[9px] text-textDim">
      <span className="w-16 shrink-0">{label}</span>
      {children}
    </label>
  );
}

function ShadowFields({ settings, onChange, onCommit }: { settings: DropShadowSettings; onChange: (p: Partial<DropShadowSettings>) => void; onCommit: () => void }) {
  const { t } = useTranslation('panelsPaint');
  return (
    <div className="space-y-1">
      <Row label={t('layerEffectsEditor.labels.angle')}>
        <input type="range" min={0} max={360} value={settings.angle} onChange={(e) => onChange({ angle: Number(e.target.value) })} onPointerUp={onCommit} className="flex-1" />
      </Row>
      <Row label={t('layerEffectsEditor.labels.distance')}>
        <input type="range" min={0} max={100} value={settings.distance} onChange={(e) => onChange({ distance: Number(e.target.value) })} onPointerUp={onCommit} className="flex-1" />
      </Row>
      <Row label={t('layerEffectsEditor.labels.spread')}>
        <input type="range" min={0} max={100} value={settings.spread} onChange={(e) => onChange({ spread: Number(e.target.value) })} onPointerUp={onCommit} className="flex-1" />
      </Row>
      <Row label={t('layerEffectsEditor.labels.blur')}>
        <input type="range" min={0} max={100} value={settings.size} onChange={(e) => onChange({ size: Number(e.target.value) })} onPointerUp={onCommit} className="flex-1" />
      </Row>
      <Row label={t('layerEffectsEditor.labels.opacity')}>
        <input type="range" min={0} max={100} value={Math.round(settings.opacity * 100)} onChange={(e) => onChange({ opacity: Number(e.target.value) / 100 })} onPointerUp={onCommit} className="flex-1" />
      </Row>
      <Row label={t('layerEffectsEditor.labels.color')}>
        <input type="color" value={settings.color} onChange={(e) => { onChange({ color: e.target.value }); onCommit(); }} className="flex-1 h-5 bg-panelLight border border-border rounded" />
      </Row>
    </div>
  );
}

function GlowFields({ settings, onChange, onCommit }: { settings: GlowSettings; onChange: (p: Partial<GlowSettings>) => void; onCommit: () => void }) {
  const { t } = useTranslation('panelsPaint');
  return (
    <div className="space-y-1">
      <Row label={t('layerEffectsEditor.labels.spread')}>
        <input type="range" min={0} max={100} value={settings.spread} onChange={(e) => onChange({ spread: Number(e.target.value) })} onPointerUp={onCommit} className="flex-1" />
      </Row>
      <Row label={t('layerEffectsEditor.labels.blur')}>
        <input type="range" min={0} max={100} value={settings.size} onChange={(e) => onChange({ size: Number(e.target.value) })} onPointerUp={onCommit} className="flex-1" />
      </Row>
      <Row label={t('layerEffectsEditor.labels.opacity')}>
        <input type="range" min={0} max={100} value={Math.round(settings.opacity * 100)} onChange={(e) => onChange({ opacity: Number(e.target.value) / 100 })} onPointerUp={onCommit} className="flex-1" />
      </Row>
      <Row label={t('layerEffectsEditor.labels.color')}>
        <input type="color" value={settings.color} onChange={(e) => { onChange({ color: e.target.value }); onCommit(); }} className="flex-1 h-5 bg-panelLight border border-border rounded" />
      </Row>
    </div>
  );
}

const BEVEL_STYLES: BevelSettings['style'][] = ['outer', 'inner', 'emboss', 'pillow', 'stroke'];

function BevelFields({ settings, onChange, onCommit }: { settings: BevelSettings; onChange: (p: Partial<BevelSettings>) => void; onCommit: () => void }) {
  const { t } = useTranslation('panelsPaint');
  return (
    <div className="space-y-1">
      <Row label={t('layerEffectsEditor.labels.style')}>
        <select value={settings.style} onChange={(e) => { onChange({ style: e.target.value as BevelSettings['style'] }); onCommit(); }} className="flex-1 bg-panelLight border border-border rounded text-[9px] px-1 py-0.5">
          {BEVEL_STYLES.map((s) => (
            <option key={s} value={s}>{t(`layerEffectsEditor.bevelStyles.${s}`)}</option>
          ))}
        </select>
      </Row>
      <Row label={t('layerEffectsEditor.labels.size')}>
        <input type="range" min={1} max={60} value={settings.size} onChange={(e) => onChange({ size: Number(e.target.value) })} onPointerUp={onCommit} className="flex-1" />
      </Row>
      <Row label={t('layerEffectsEditor.labels.softness')}>
        <input type="range" min={0} max={30} value={settings.softness} onChange={(e) => onChange({ softness: Number(e.target.value) })} onPointerUp={onCommit} className="flex-1" />
      </Row>
      <Row label={t('layerEffectsEditor.labels.depth')}>
        <input type="range" min={0} max={100} value={settings.depth} onChange={(e) => onChange({ depth: Number(e.target.value) })} onPointerUp={onCommit} className="flex-1" />
      </Row>
      <Row label={t('layerEffectsEditor.labels.angle')}>
        <input type="range" min={0} max={360} value={settings.angle} onChange={(e) => onChange({ angle: Number(e.target.value) })} onPointerUp={onCommit} className="flex-1" />
      </Row>
      <Row label={t('layerEffectsEditor.labels.altitude')}>
        <input type="range" min={0} max={90} value={settings.altitude} onChange={(e) => onChange({ altitude: Number(e.target.value) })} onPointerUp={onCommit} className="flex-1" />
      </Row>
      <Row label={t('layerEffectsEditor.labels.highlight')}>
        <input type="color" value={settings.highlightColor} onChange={(e) => { onChange({ highlightColor: e.target.value }); onCommit(); }} className="flex-1 h-5 bg-panelLight border border-border rounded" />
      </Row>
      <Row label={t('layerEffectsEditor.labels.shadowColor')}>
        <input type="color" value={settings.shadowColor} onChange={(e) => { onChange({ shadowColor: e.target.value }); onCommit(); }} className="flex-1 h-5 bg-panelLight border border-border rounded" />
      </Row>
    </div>
  );
}

function ColorOverlayFields({ settings, onChange, onCommit }: { settings: ColorOverlaySettings; onChange: (p: Partial<ColorOverlaySettings>) => void; onCommit: () => void }) {
  const { t } = useTranslation('panelsPaint');
  return (
    <div className="space-y-1">
      <Row label={t('layerEffectsEditor.labels.color')}>
        <input type="color" value={settings.color} onChange={(e) => { onChange({ color: e.target.value }); onCommit(); }} className="flex-1 h-5 bg-panelLight border border-border rounded" />
      </Row>
      <Row label={t('layerEffectsEditor.labels.opacity')}>
        <input type="range" min={0} max={100} value={Math.round(settings.opacity * 100)} onChange={(e) => onChange({ opacity: Number(e.target.value) / 100 })} onPointerUp={onCommit} className="flex-1" />
      </Row>
    </div>
  );
}

function GradientOverlayFields({ settings, onChange, onCommit }: { settings: GradientOverlaySettings; onChange: (p: Partial<GradientOverlaySettings>) => void; onCommit: () => void }) {
  const { t } = useTranslation('panelsPaint');
  return (
    <div className="space-y-1">
      <Row label={t('layerEffectsEditor.labels.color1')}>
        <input type="color" value={settings.color1} onChange={(e) => { onChange({ color1: e.target.value }); onCommit(); }} className="flex-1 h-5 bg-panelLight border border-border rounded" />
      </Row>
      <Row label={t('layerEffectsEditor.labels.color2')}>
        <input type="color" value={settings.color2} onChange={(e) => { onChange({ color2: e.target.value }); onCommit(); }} className="flex-1 h-5 bg-panelLight border border-border rounded" />
      </Row>
      <Row label={t('layerEffectsEditor.labels.angle')}>
        <input type="range" min={0} max={360} value={settings.angle} onChange={(e) => onChange({ angle: Number(e.target.value) })} onPointerUp={onCommit} className="flex-1" />
      </Row>
      <Row label={t('layerEffectsEditor.labels.opacity')}>
        <input type="range" min={0} max={100} value={Math.round(settings.opacity * 100)} onChange={(e) => onChange({ opacity: Number(e.target.value) / 100 })} onPointerUp={onCommit} className="flex-1" />
      </Row>
    </div>
  );
}

const STROKE_POSITIONS: StrokeSettings['position'][] = ['outside', 'inside', 'center'];

function StrokeFields({ settings, onChange, onCommit }: { settings: StrokeSettings; onChange: (p: Partial<StrokeSettings>) => void; onCommit: () => void }) {
  const { t } = useTranslation('panelsPaint');
  return (
    <div className="space-y-1">
      <Row label={t('layerEffectsEditor.labels.size')}>
        <input type="range" min={1} max={60} value={settings.size} onChange={(e) => onChange({ size: Number(e.target.value) })} onPointerUp={onCommit} className="flex-1" />
      </Row>
      <Row label={t('layerEffectsEditor.labels.position')}>
        <select value={settings.position} onChange={(e) => { onChange({ position: e.target.value as StrokeSettings['position'] }); onCommit(); }} className="flex-1 bg-panelLight border border-border rounded text-[9px] px-1 py-0.5">
          {STROKE_POSITIONS.map((p) => (
            <option key={p} value={p}>{t(`layerEffectsEditor.strokePositions.${p}`)}</option>
          ))}
        </select>
      </Row>
      <Row label={t('layerEffectsEditor.labels.color')}>
        <input type="color" value={settings.color} onChange={(e) => { onChange({ color: e.target.value }); onCommit(); }} className="flex-1 h-5 bg-panelLight border border-border rounded" />
      </Row>
      <Row label={t('layerEffectsEditor.labels.opacity')}>
        <input type="range" min={0} max={100} value={Math.round(settings.opacity * 100)} onChange={(e) => onChange({ opacity: Number(e.target.value) / 100 })} onPointerUp={onCommit} className="flex-1" />
      </Row>
    </div>
  );
}
