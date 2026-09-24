import { useState } from 'react';
import { useUIStore } from '@/store/uiStore';
import { useAppStore } from '@/store/appStore';
import { useLearningStore } from '@/store/learningStore';
import { ProjectType } from '@/types';
import { DEFAULT_CANVAS_WIDTH, DEFAULT_CANVAS_HEIGHT, DEFAULT_DPI } from '@/utils/constants';
import { SIZE_PRESETS, SIZE_PRESET_CATEGORY_LABELS, SizePreset } from '@/data/sizePresets';

const PRESETS: { label: string; width: number; height: number; type: ProjectType }[] = [
  { label: 'HD (1920×1080)', width: 1920, height: 1080, type: 'drawing' },
  { label: 'Cuadrado (2000×2000)', width: 2000, height: 2000, type: 'drawing' },
  { label: 'Pixel Art (64×64)', width: 64, height: 64, type: 'pixelart' },
  { label: 'Pixel Art (128×128)', width: 128, height: 128, type: 'pixelart' },
];

const CATEGORY_ORDER: SizePreset['category'][] = ['web', 'print', 'social', 'ui'];

const TYPE_LABELS: Record<ProjectType, string> = {
  drawing: 'Dibujo digital',
  pixelart: 'Pixel Art',
  comic: 'Cómic / Manga',
  '3d': '3D',
  hybrid: 'Híbrido',
};

export default function NewProjectDialog() {
  const show = useUIStore((s) => s.showNewProjectDialog);
  const close = useUIStore((s) => s.closeNewProjectDialog);
  const newProject = useAppStore((s) => s.newProject);

  const [name, setName] = useState('Proyecto sin título');
  const [type, setType] = useState<ProjectType>('drawing');
  const [width, setWidth] = useState(DEFAULT_CANVAS_WIDTH);
  const [height, setHeight] = useState(DEFAULT_CANVAS_HEIGHT);
  const [dpi, setDpi] = useState(DEFAULT_DPI);

  if (!show) return null;

  function handleCreate() {
    newProject({ name: name.trim() || 'Proyecto sin título', type, width, height, dpi });
    // Cómic y 3D ya tienen sus herramientas dedicadas en la app (panel de viñetas/globos,
    // visor 3D con cámara/luces/pose) — al elegir ese tipo, las abrimos de una para que el
    // proyecto arranque directo en ese flujo en vez de dejarlas escondidas en un menú.
    if (type === 'comic') useUIStore.setState({ showComicPanel: true });
    if (type === '3d') {
      // El visor completo (cámara/luces/pose/importar) para configurar el modelo, más el
      // panel de referencia flotante para que quede visible mientras se dibuja después
      // de cerrar el visor — sin esto último, "3D" se sentía igual que "Dibujo" en cuanto
      // cerrabas el modal la primera vez.
      useUIStore.getState().openModel3DViewer();
      useUIStore.setState({ showReference3DPanel: true });
    }
    close();
    useLearningStore.getState().maybeStartOnboardingTour();
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-panel border border-border rounded-lg w-[420px] p-5">
        <h2 className="text-lg font-semibold mb-4">Nuevo proyecto</h2>

        <label className="block text-xs text-textDim mb-1">Nombre</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full bg-panelLight border border-border rounded px-2 py-1.5 mb-3 text-sm"
        />

        <label className="block text-xs text-textDim mb-1">Tipo</label>
        <div className="grid grid-cols-2 gap-2 mb-3">
          {(['drawing', 'pixelart', 'comic', '3d'] as ProjectType[]).map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`py-1.5 rounded text-sm ${type === t ? 'bg-accent text-white' : 'bg-panelLight text-textDim'}`}
            >
              {TYPE_LABELS[t]}
            </button>
          ))}
        </div>
        {type === 'comic' && (
          <p className="text-[10px] text-textDim -mt-2 mb-3">Arranca con el panel de Cómic (viñetas y globos) abierto.</p>
        )}
        {type === '3d' && (
          <p className="text-[10px] text-textDim -mt-2 mb-3">Arranca con el visor 3D (cámara, luces, pose) abierto para importar un modelo.</p>
        )}

        <div className="flex gap-3 mb-3">
          <div className="flex-1">
            <label className="block text-xs text-textDim mb-1">Ancho (px)</label>
            <input
              type="number"
              value={width}
              min={1}
              onChange={(e) => setWidth(Math.max(1, Number(e.target.value)))}
              className="w-full bg-panelLight border border-border rounded px-2 py-1.5 text-sm"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs text-textDim mb-1">Alto (px)</label>
            <input
              type="number"
              value={height}
              min={1}
              onChange={(e) => setHeight(Math.max(1, Number(e.target.value)))}
              className="w-full bg-panelLight border border-border rounded px-2 py-1.5 text-sm"
            />
          </div>
          <div className="w-20">
            <label className="block text-xs text-textDim mb-1">DPI</label>
            <input
              type="number"
              value={dpi}
              min={1}
              onChange={(e) => setDpi(Math.max(1, Number(e.target.value)))}
              className="w-full bg-panelLight border border-border rounded px-2 py-1.5 text-sm"
            />
          </div>
        </div>

        <label className="block text-xs text-textDim mb-1">Presets</label>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              onClick={() => {
                setWidth(p.width);
                setHeight(p.height);
                setType(p.type);
              }}
              className="text-[11px] bg-panelLight hover:bg-border rounded px-2 py-1"
            >
              {p.label}
            </button>
          ))}
        </div>

        <label className="block text-xs text-textDim mb-1">Plantillas de tamaño</label>
        <div className="max-h-40 overflow-y-auto space-y-2 mb-4 border border-border rounded p-2">
          {CATEGORY_ORDER.map((category) => (
            <div key={category}>
              <div className="text-[9px] text-textDim uppercase tracking-wide mb-1">{SIZE_PRESET_CATEGORY_LABELS[category]}</div>
              <div className="flex flex-wrap gap-1.5">
                {SIZE_PRESETS.filter((p) => p.category === category).map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setWidth(p.width);
                      setHeight(p.height);
                      setType('drawing');
                    }}
                    className="text-[10px] bg-panelLight hover:bg-border rounded px-2 py-1"
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-2">
          <button onClick={close} className="px-3 py-1.5 text-sm text-textDim hover:text-text">
            Cancelar
          </button>
          <button onClick={handleCreate} className="px-3 py-1.5 text-sm bg-accent text-white rounded">
            Crear
          </button>
        </div>
      </div>
    </div>
  );
}
