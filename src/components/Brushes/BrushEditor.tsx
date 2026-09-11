import { useState } from 'react';
import toast from 'react-hot-toast';
import { useUIStore } from '@/store/uiStore';
import { useBrush } from '@/hooks/useBrush';
import { useTools } from '@/hooks/useTools';
import { createBrush } from '@/services/brush.service';
import { isElectron } from '@/utils/fileUtils';
import { Brush } from '@/types';
import BrushPreview from './BrushPreview';

const SLIDERS: { key: keyof Brush; label: string; min: number; max: number; pct?: boolean }[] = [
  { key: 'size', label: 'Tamaño', min: 1, max: 300 },
  { key: 'hardness', label: 'Dureza', min: 0, max: 100, pct: true },
  { key: 'opacity', label: 'Opacidad', min: 1, max: 100, pct: true },
  { key: 'spacing', label: 'Espaciado', min: 1, max: 100, pct: true },
  { key: 'scatter', label: 'Dispersión', min: 0, max: 100, pct: true },
  { key: 'angleJitter', label: 'Variación de ángulo', min: 0, max: 360 },
  { key: 'sizeJitter', label: 'Variación de tamaño', min: 0, max: 100, pct: true },
];

export default function BrushEditor() {
  const show = useUIStore((s) => s.showBrushEditor);
  const close = useUIStore((s) => s.closeBrushEditor);
  const { currentBrush, updateCurrentBrush, addBrushToLibrary, setCurrentBrush } = useBrush();
  const { primaryColor } = useTools();
  const [name, setName] = useState(currentBrush.name);

  if (!show) return null;

  function getValue(key: keyof Brush, pct?: boolean) {
    const v = currentBrush[key] as number;
    return pct ? Math.round(v * 100) : v;
  }

  function setValue(key: keyof Brush, raw: number, pct?: boolean) {
    updateCurrentBrush({ [key]: pct ? raw / 100 : raw } as Partial<Brush>);
  }

  function saveAsNew() {
    const { id: _id, ...rest } = currentBrush;
    const brush = createBrush({ ...rest, name: name.trim() || 'Pincel personalizado' });
    addBrushToLibrary(brush);
    setCurrentBrush(brush);
    toast.success('Pincel guardado en la librería');
  }

  async function exportBrush() {
    if (!isElectron()) {
      toast.error('Exportar pinceles solo está disponible en la app de escritorio');
      return;
    }
    const json = JSON.stringify(currentBrush);
    const result = await window.electronAPI.exportBrush(json, name.trim() || 'pincel');
    if (!result.canceled) toast.success('Pincel exportado');
  }

  async function importBrush() {
    if (!isElectron()) {
      toast.error('Importar pinceles solo está disponible en la app de escritorio');
      return;
    }
    const result = await window.electronAPI.importBrush();
    if (result.canceled) return;
    for (const json of result.brushes) {
      try {
        const { id: _id, ...data } = JSON.parse(json) as Brush;
        const brush = createBrush(data);
        addBrushToLibrary(brush);
        setCurrentBrush(brush);
      } catch (err) {
        console.error('Pincel inválido', err);
      }
    }
    toast.success('Pincel importado');
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-panel border border-border rounded-lg w-[440px] p-5 max-h-[85vh] overflow-y-auto">
        <h2 className="text-lg font-semibold mb-3">Editor de pinceles</h2>

        <BrushPreview brush={currentBrush} color={primaryColor} />

        <label className="block text-xs text-textDim mb-1 mt-3">Nombre</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full bg-panelLight border border-border rounded px-2 py-1.5 mb-3 text-sm"
        />

        <div className="space-y-2">
          {SLIDERS.map(({ key, label, min, max, pct }) => (
            <div key={key}>
              <div className="flex justify-between text-xs text-textDim mb-1">
                <span>{label}</span>
                <span>
                  {getValue(key, pct)}
                  {pct ? '%' : 'px'}
                </span>
              </div>
              <input
                type="range"
                min={min}
                max={max}
                value={getValue(key, pct)}
                onChange={(e) => setValue(key, Number(e.target.value), pct)}
                className="w-full"
              />
            </div>
          ))}
        </div>

        <div className="flex gap-2 mt-4">
          <button onClick={importBrush} className="flex-1 bg-panelLight text-xs rounded py-1.5">
            Importar .brush
          </button>
          <button onClick={exportBrush} className="flex-1 bg-panelLight text-xs rounded py-1.5">
            Exportar .brush
          </button>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <button onClick={close} className="px-3 py-1.5 text-sm text-textDim hover:text-text">
            Cerrar
          </button>
          <button onClick={saveAsNew} className="px-3 py-1.5 text-sm bg-accent text-white rounded">
            Guardar como nuevo
          </button>
        </div>
      </div>
    </div>
  );
}
