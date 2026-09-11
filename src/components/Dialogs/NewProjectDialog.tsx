import { useState } from 'react';
import { useUIStore } from '@/store/uiStore';
import { useAppStore } from '@/store/appStore';
import { ProjectType } from '@/types';
import { DEFAULT_CANVAS_WIDTH, DEFAULT_CANVAS_HEIGHT, DEFAULT_DPI } from '@/utils/constants';

const PRESETS: { label: string; width: number; height: number; type: ProjectType }[] = [
  { label: 'HD (1920×1080)', width: 1920, height: 1080, type: 'drawing' },
  { label: 'Cuadrado (2000×2000)', width: 2000, height: 2000, type: 'drawing' },
  { label: 'A4 300dpi (2480×3508)', width: 2480, height: 3508, type: 'drawing' },
  { label: 'Pixel Art (64×64)', width: 64, height: 64, type: 'pixelart' },
  { label: 'Pixel Art (128×128)', width: 128, height: 128, type: 'pixelart' },
];

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
    close();
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
        <div className="flex gap-2 mb-3">
          {(['drawing', 'pixelart'] as ProjectType[]).map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`flex-1 py-1.5 rounded text-sm ${type === t ? 'bg-accent text-white' : 'bg-panelLight text-textDim'}`}
            >
              {t === 'drawing' ? 'Dibujo digital' : 'Pixel Art'}
            </button>
          ))}
        </div>

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
        <div className="flex flex-wrap gap-1.5 mb-4">
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
