import { useAppStore } from '@/store/appStore';
import { usePerspectiveStore } from '@/store/perspectiveStore';
import { RULER_HELP, RULER_LABELS, RulerKind } from '@/services/rulerAssist.service';

const KINDS: RulerKind[] = ['off', 'line', 'parallel', 'ellipse', 'perspective'];

/** Drawing rulers: freehand strokes get pulled onto the ruler so the line comes out clean. */
export default function RulerPanel() {
  const project = useAppStore((s) => s.project);
  const ruler = usePerspectiveStore((s) => s.ruler);
  const setRuler = usePerspectiveStore((s) => s.setRuler);
  const resetRuler = usePerspectiveStore((s) => s.resetRuler);
  const gridEnabled = usePerspectiveStore((s) => s.grid.enabled);
  if (!project) return null;

  const usesAngle = ruler.kind === 'line' || ruler.kind === 'parallel' || ruler.kind === 'ellipse';

  return (
    <div className="space-y-3" data-testid="ruler-panel">
      <div className="grid grid-cols-2 gap-1">
        {KINDS.map((k) => (
          <button
            key={k}
            onClick={() => setRuler({ kind: k })}
            data-testid={`ruler-kind-${k}`}
            className={`text-[10px] py-1.5 rounded ${ruler.kind === k ? 'bg-accent text-white' : 'bg-panelLight text-textDim hover:text-text'}`}
          >
            {RULER_LABELS[k]}
          </button>
        ))}
      </div>
      <p className="text-[9px] text-textDim">{RULER_HELP[ruler.kind]}</p>
      {ruler.kind === 'perspective' && !gridEnabled && (
        <p className="text-[9px] text-amber-400">Activa «Mostrar grilla de perspectiva» en la pestaña Perspectiva: la regla usa sus puntos de fuga.</p>
      )}

      {ruler.kind !== 'off' && (
        <div className="space-y-1.5">
          {ruler.kind !== 'perspective' && (
            <label className="flex items-center gap-2 text-[11px]">
              <input type="checkbox" checked={ruler.visible} onChange={(e) => setRuler({ visible: e.target.checked })} />
              Mostrar la regla en el lienzo
            </label>
          )}

          {usesAngle && (
            <>
              <label className="flex items-center gap-2 text-[9px] text-textDim">
                <span className="w-14">{ruler.kind === 'ellipse' ? 'Giro' : 'Ángulo'}</span>
                <input type="range" min={-180} max={180} value={Math.round(ruler.angle)} onChange={(e) => setRuler({ angle: Number(e.target.value) })} className="flex-1" data-testid="ruler-angle" />
                <input
                  type="number"
                  value={Math.round(ruler.angle)}
                  onChange={(e) => setRuler({ angle: Number(e.target.value) })}
                  className="w-12 bg-panelLight border border-border rounded px-1 py-0.5 text-[10px]"
                />
              </label>
              <div className="flex gap-1">
                {([['Horizontal', 0], ['Vertical', 90], ['45°', 45], ['-45°', -45]] as [string, number][]).map(([label, a]) => (
                  <button key={label} onClick={() => setRuler({ angle: a })} className="flex-1 bg-panelLight hover:bg-border text-[9px] rounded py-1">
                    {label}
                  </button>
                ))}
              </div>
            </>
          )}

          {ruler.kind === 'ellipse' && (
            <div className="grid grid-cols-2 gap-1.5 text-[9px] text-textDim">
              <label className="flex items-center gap-1">
                Radio X
                <input type="number" min={1} value={Math.round(ruler.rx)} onChange={(e) => setRuler({ rx: Math.max(1, Number(e.target.value)) })} className="flex-1 min-w-0 bg-panelLight border border-border rounded px-1 py-0.5 text-[10px]" data-testid="ruler-rx" />
              </label>
              <label className="flex items-center gap-1">
                Radio Y
                <input type="number" min={1} value={Math.round(ruler.ry)} onChange={(e) => setRuler({ ry: Math.max(1, Number(e.target.value)) })} className="flex-1 min-w-0 bg-panelLight border border-border rounded px-1 py-0.5 text-[10px]" />
              </label>
              <button onClick={() => setRuler({ ry: ruler.rx })} className="col-span-2 bg-panelLight hover:bg-border text-[9px] rounded py-1">
                Convertir en círculo
              </button>
            </div>
          )}

          {ruler.kind !== 'parallel' && ruler.kind !== 'perspective' && (
            <label className="flex items-center gap-2 text-[9px] text-textDim">
              <span className="w-14">Imán</span>
              <input type="range" min={4} max={60} step={1} value={ruler.snapDistance} onChange={(e) => setRuler({ snapDistance: Number(e.target.value) })} className="flex-1" />
              <span className="w-8 text-right">{ruler.snapDistance}px</span>
            </label>
          )}

          {ruler.kind !== 'perspective' && (
            <button onClick={() => resetRuler(project.width, project.height)} className="w-full bg-panelLight hover:bg-border text-[10px] rounded py-1">
              Centrar la regla en el lienzo
            </button>
          )}
        </div>
      )}
      <p className="text-[9px] text-textDim">Funciona con el pincel, el borrador y el difuminado, y se combina con la simetría. Cada tipo se guarda con el proyecto.</p>
    </div>
  );
}
