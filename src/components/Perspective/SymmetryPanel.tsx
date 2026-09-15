import { useAppStore } from '@/store/appStore';
import { usePerspectiveStore } from '@/store/perspectiveStore';
import { SYMMETRY_MODE_LABELS, SymmetryMode } from '@/types/perspective';

const MODES = Object.keys(SYMMETRY_MODE_LABELS) as SymmetryMode[];

export default function SymmetryPanel() {
  const project = useAppStore((s) => s.project);
  const symmetry = usePerspectiveStore((s) => s.symmetry);
  const setSymmetryMode = usePerspectiveStore((s) => s.setSymmetryMode);
  const updateSymmetrySettings = usePerspectiveStore((s) => s.updateSymmetrySettings);
  const moveSymmetryCenter = usePerspectiveStore((s) => s.moveSymmetryCenter);

  if (!project) return null;

  return (
    <div className="space-y-3">
      <p className="text-[9px] text-textDim">
        Mientras pintás, cada trazo del pincel/borrador se repite reflejado o rotado según el modo elegido — pinta de
        verdad sobre la capa, no es solo una vista previa.
      </p>

      <div className="grid grid-cols-3 gap-1">
        {MODES.map((mode) => (
          <button
            key={mode}
            onClick={() => setSymmetryMode(mode)}
            className={`text-[9px] py-1.5 rounded px-1 ${symmetry.mode === mode ? 'bg-accent text-white' : 'bg-panelLight text-textDim hover:text-text'}`}
          >
            {SYMMETRY_MODE_LABELS[mode]}
          </button>
        ))}
      </div>

      {symmetry.mode !== 'none' && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-[9px] text-textDim">
            <span className="w-16">Centro X</span>
            <input
              type="number"
              value={Math.round(symmetry.centerX)}
              onChange={(e) => moveSymmetryCenter(Number(e.target.value), symmetry.centerY)}
              className="flex-1 bg-panelLight border border-border rounded px-1.5 py-1"
            />
          </div>
          <div className="flex items-center gap-2 text-[9px] text-textDim">
            <span className="w-16">Centro Y</span>
            <input
              type="number"
              value={Math.round(symmetry.centerY)}
              onChange={(e) => moveSymmetryCenter(symmetry.centerX, Number(e.target.value))}
              className="flex-1 bg-panelLight border border-border rounded px-1.5 py-1"
            />
          </div>
          <button
            onClick={() => moveSymmetryCenter(project.width / 2, project.height / 2)}
            className="w-full text-[9px] bg-panelLight rounded py-1"
          >
            Centrar en el lienzo
          </button>

          {symmetry.mode === 'mirrorDiagonal' && (
            <label className="flex items-center gap-2 text-[9px] text-textDim">
              <span className="w-16">Ángulo</span>
              <input
                type="range"
                min={0}
                max={180}
                step={1}
                value={symmetry.angle}
                onChange={(e) => updateSymmetrySettings({ angle: Number(e.target.value) })}
                className="flex-1"
              />
              <span className="w-8 text-right">{symmetry.angle}°</span>
            </label>
          )}

          <label className="flex items-center gap-2 text-[10px]">
            <input type="checkbox" checked={symmetry.showGuidelines} onChange={(e) => updateSymmetrySettings({ showGuidelines: e.target.checked })} />
            Mostrar líneas guía
          </label>
        </div>
      )}
    </div>
  );
}
