import { Trash2 } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { useStudyGuidesStore } from '@/store/studyGuidesStore';
import { useGridOverlayStore } from '@/store/gridOverlayStore';
import { useUIStore } from '@/store/uiStore';
import { GUIDE_COUNT_LABEL, STUDY_GUIDE_LABELS, StudyGuideKind } from '@/services/studyGuides.service';
import { GRID_TYPE_LABELS, GridOverlayType } from '@/services/gridOverlay.service';

const KINDS = Object.keys(STUDY_GUIDE_LABELS) as StudyGuideKind[];

function Slider({ label, value, min, max, step = 1, onChange }: { label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void }) {
  return (
    <label className="flex items-center gap-1.5 text-[10px] text-textDim">
      <span className="w-14 shrink-0">{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="flex-1" />
      <span className="w-9 text-right">{value}</span>
    </label>
  );
}

export default function GuidesTab() {
  const project = useAppStore((s) => s.project);
  const guides = useStudyGuidesStore((s) => s.guides);
  const selectedId = useStudyGuidesStore((s) => s.selectedId);
  const measure = useStudyGuidesStore((s) => s.measure);
  const addGuide = useStudyGuidesStore((s) => s.addGuide);
  const updateGuide = useStudyGuidesStore((s) => s.updateGuide);
  const removeGuide = useStudyGuidesStore((s) => s.removeGuide);
  const selectGuide = useStudyGuidesStore((s) => s.selectGuide);
  const setMeasureEnabled = useStudyGuidesStore((s) => s.setMeasureEnabled);
  const grid = useGridOverlayStore();
  const togglePerspective = useUIStore((s) => s.togglePerspectivePanel);
  const showPerspective = useUIStore((s) => s.showPerspectivePanel);
  const selected = guides.find((g) => g.id === selectedId) ?? null;

  if (!project) return <p className="text-[11px] text-textDim">Abre un proyecto para usar las guías.</p>;

  return (
    <div className="space-y-4">
      <section className="space-y-2">
        <h3 className="text-[11px] font-medium">Guías de construcción</h3>
        <p className="text-[10px] text-textDim">Se dibujan encima del lienzo sin tocar tus capas. Arrastra el círculo de cada guía para moverla.</p>
        <div className="grid grid-cols-1 gap-1">
          {KINDS.map((k) => (
            <button key={k} onClick={() => addGuide(k, project.width, project.height)} className="text-left bg-panelLight hover:bg-border text-[11px] rounded px-2 py-1.5">
              + {STUDY_GUIDE_LABELS[k]}
            </button>
          ))}
        </div>

        {guides.length > 0 && (
          <div className="space-y-1">
            {guides.map((g) => (
              <div key={g.id} className={`flex items-center gap-1 rounded border px-1.5 py-1 ${g.id === selectedId ? 'border-accent' : 'border-border'}`}>
                <button onClick={() => selectGuide(g.id)} className="flex-1 text-left text-[10px] truncate">
                  {STUDY_GUIDE_LABELS[g.kind]}
                </button>
                <button onClick={() => removeGuide(g.id)} title="Quitar guía" className="text-textDim hover:text-red-400">
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        {selected && (
          <div className="space-y-1 border border-border rounded p-2">
            <Slider label="Tamaño" value={Math.round(selected.size)} min={40} max={Math.round(Math.max(project.width, project.height) * 1.5)} onChange={(v) => updateGuide(selected.id, { size: v })} />
            <Slider label="Giro °" value={Math.round(selected.rotation)} min={-180} max={180} onChange={(v) => updateGuide(selected.id, { rotation: v })} />
            <Slider label="Opacidad" value={Math.round(selected.opacity * 100)} min={10} max={100} onChange={(v) => updateGuide(selected.id, { opacity: v / 100 })} />
            {selected.kind === 'ellipse' && <Slider label="Ratio" value={Math.round(selected.ratio * 100)} min={5} max={100} onChange={(v) => updateGuide(selected.id, { ratio: v / 100 })} />}
            {GUIDE_COUNT_LABEL[selected.kind] && (
              <Slider label={GUIDE_COUNT_LABEL[selected.kind]!.label} value={selected.heads} min={GUIDE_COUNT_LABEL[selected.kind]!.min} max={GUIDE_COUNT_LABEL[selected.kind]!.max} step={GUIDE_COUNT_LABEL[selected.kind]!.step} onChange={(v) => updateGuide(selected.id, { heads: v })} />
            )}
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1 text-[10px] text-textDim">
                <input type="checkbox" checked={selected.flipH} onChange={(e) => updateGuide(selected.id, { flipH: e.target.checked })} /> Voltear
              </label>
              <label className="flex items-center gap-1 text-[10px] text-textDim ml-auto">
                Color <input type="color" value={selected.color} onChange={(e) => updateGuide(selected.id, { color: e.target.value })} className="w-7 h-5 bg-transparent" />
              </label>
            </div>
          </div>
        )}
      </section>

      <section className="space-y-2 border-t border-border pt-3">
        <h3 className="text-[11px] font-medium">Regla de medida</h3>
        <label className="flex items-center gap-2 text-[11px]">
          <input type="checkbox" checked={measure.enabled} onChange={(e) => setMeasureEnabled(e.target.checked, project.width, project.height)} /> Mostrar regla (distancia y ángulo)
        </label>
        <p className="text-[10px] text-textDim">Arrastra los dos puntos. Con una guía de figura activa, también indica la distancia en cabezas.</p>
      </section>

      <section className="space-y-2 border-t border-border pt-3">
        <h3 className="text-[11px] font-medium">Composición y cuadrículas</h3>
        <label className="flex items-center gap-2 text-[11px]">
          <input type="checkbox" checked={grid.enabled} onChange={grid.toggleEnabled} /> Mostrar guía
        </label>
        <select value={grid.type} onChange={(e) => grid.setType(e.target.value as GridOverlayType)} className="w-full bg-panel border border-border rounded text-[11px] px-1.5 py-1">
          {(Object.keys(GRID_TYPE_LABELS) as GridOverlayType[]).map((t) => (
            <option key={t} value={t}>
              {GRID_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
        <button onClick={togglePerspective} className="w-full bg-panelLight text-[11px] rounded py-1.5">
          {showPerspective ? 'Cerrar' : 'Abrir'} perspectiva (1, 2 y 3 puntos), simetría y guías
        </button>
      </section>
    </div>
  );
}
