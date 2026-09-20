import { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useUIStore } from '@/store/uiStore';
import { useBrush } from '@/hooks/useBrush';
import { useTools } from '@/hooks/useTools';
import { createBrush, preloadBrushTexture } from '@/services/brush.service';
import { isElectron } from '@/utils/fileUtils';
import { Brush, BrushDynamics } from '@/types';
import BrushPreview from './BrushPreview';
import { importAbr } from '@/services/abrImport.service';
import { importKritaBundle, importKritaPreset, importProcreateBrush } from '@/services/brushFormats.service';

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
  const textureInputRef = useRef<HTMLInputElement>(null);
  const tipsInputRef = useRef<HTMLInputElement>(null);
  const abrInputRef = useRef<HTMLInputElement>(null);

  if (!show) return null;

  function getValue(key: keyof Brush, pct?: boolean) {
    const v = currentBrush[key] as number;
    return pct ? Math.round(v * 100) : v;
  }

  function setValue(key: keyof Brush, raw: number, pct?: boolean) {
    updateCurrentBrush({ [key]: pct ? raw / 100 : raw } as Partial<Brush>);
  }

  function setDynamic(key: keyof BrushDynamics, value: boolean) {
    const dynamics: BrushDynamics = {
      sizeToPressure: false,
      opacityToPressure: false,
      angleToDirection: false,
      ...currentBrush.dynamics,
      [key]: value,
    };
    updateCurrentBrush({ dynamics });
  }

  function handleTextureFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // lets picking the exact same file again still fire onChange
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      preloadBrushTexture(reader.result as string);
      updateCurrentBrush({ texture: reader.result as string });
    };
    reader.onerror = () => toast.error('No se pudo leer la imagen');
    reader.readAsDataURL(file);
  }

  /** Imports one or many PNG/JPG images as brush tips (one brush per image). */
  function handleTipFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length === 0) return;
    let done = 0;
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const brush = createBrush({
          name: file.name.replace(/\.[^.]+$/, ''),
          texture: reader.result as string,
          size: 48,
          hardness: 1,
          spacing: 0.18,
          category: 'Importados',
          dynamics: { sizeToPressure: true, opacityToPressure: false, angleToDirection: false },
        });
        preloadBrushTexture(brush.texture);
        addBrushToLibrary(brush);
        if (++done === files.length) {
          setCurrentBrush(brush);
          toast.success(`${done} pincel(es) importado(s) como puntas`);
        }
      };
      reader.onerror = () => toast.error(`No se pudo leer ${file.name}`);
      reader.readAsDataURL(file);
    });
  }

  async function handleAbrFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    for (const file of files) {
      try {
        const ext = file.name.split('.').pop()?.toLowerCase();
        if (ext === 'bundle') {
          const r = await importKritaBundle(await file.arrayBuffer());
          r.brushes.forEach((b) => addBrushToLibrary(b));
          if (r.brushes.length) setCurrentBrush(r.brushes[0]);
          const skipped = Object.entries(r.skipped).map(([k, n]) => `${k} (${n})`).join(', ');
          toast.success(`${file.name}: ${r.brushes.length} pincel(es) importado(s)`);
          if (skipped) toast(`No se importan (sin equivalente): ${skipped}`, { icon: 'ℹ️', duration: 9000 });
          if (r.notes.length) toast(`Ten en cuenta: ${r.notes.slice(0, 4).join('; ')}`, { icon: 'ℹ️', duration: 9000 });
          continue;
        }
        if (ext === 'brush' || ext === 'kpp') {
          const one = ext === 'brush' ? await importProcreateBrush(await file.arrayBuffer(), file.name.replace(/\.[^.]+$/, '')) : await importKritaPreset(await file.arrayBuffer(), file.name.replace(/\.[^.]+$/, ''));
          addBrushToLibrary(one.brush);
          setCurrentBrush(one.brush);
          toast.success(`${file.name}: pincel importado`);
          if (one.notes.length) toast(`Ten en cuenta: ${one.notes.join('; ')}`, { icon: 'ℹ️', duration: 9000 });
          continue;
        }
        const { brushes, lostFeatures, bakedFeatures, skipped, skippedPatterns, notes } = await importAbr(await file.arrayBuffer());
        brushes.forEach((b) => addBrushToLibrary(b));
        if (brushes.length) setCurrentBrush(brushes[0]);
        const lost = Object.entries(lostFeatures).map(([k, n]) => `${k} (${n})`).join(', ');
        toast.success(`${file.name}: ${brushes.length} pincel(es) importado(s)${skipped ? `, ${skipped} sin punta legible` : ''}`);
        if (notes.length) toast(`Ten en cuenta: ${notes.join('; ')}`, { icon: 'ℹ️', duration: 8000 });
        if (skippedPatterns) toast(`${skippedPatterns} textura(s) de papel con un formato no compatible: esos pinceles se importan sin ella`, { icon: 'ℹ️', duration: 7000 });
        const baked = Object.keys(bakedFeatures).join(' y ');
        if (baked) toast(`Aproximado dentro de la punta: ${baked} (el grano no queda fijo al lienzo como en Photoshop)`, { icon: 'ℹ️', duration: 8000 });
        if (lost) toast(`No se importa: ${lost}`, { icon: 'ℹ️', duration: 7000 });
      } catch (err) {
        console.error(err);
        toast.error(`${file.name}: no es un .abr compatible (se admite Photoshop CS y posterior)`);
      }
    }
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

        <div className="mt-3 space-y-1.5">
          <div className="text-xs text-textDim">Sensibilidad a la presión (tableta gráfica)</div>
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={currentBrush.dynamics?.sizeToPressure ?? false}
              onChange={(e) => setDynamic('sizeToPressure', e.target.checked)}
            />
            Tamaño según presión
          </label>
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={currentBrush.dynamics?.opacityToPressure ?? false}
              onChange={(e) => setDynamic('opacityToPressure', e.target.checked)}
            />
            Opacidad según presión
          </label>
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={currentBrush.dynamics?.tiltToSize ?? false} onChange={(e) => setDynamic('tiltToSize', e.target.checked)} />
            Tamaño según inclinación del lápiz
          </label>
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={currentBrush.dynamics?.angleToDirection ?? false} onChange={(e) => setDynamic('angleToDirection', e.target.checked)} />
            Girar la punta según la dirección del trazo
          </label>
          <p className="text-[10px] text-textDim">Con mouse o un lápiz sin sensor de presión ni inclinación, el efecto queda parejo (no varía).</p>
        </div>

        <div className="mt-3 space-y-1.5">
          <div className="text-xs text-textDim">Textura del pincel</div>
          <input ref={textureInputRef} type="file" accept="image/*" className="hidden" onChange={handleTextureFile} />
          <div className="flex items-center gap-2">
            {currentBrush.texture && (
              <img src={currentBrush.texture} alt="" className="w-8 h-8 object-cover rounded border border-border bg-panelLight" />
            )}
            <button onClick={() => textureInputRef.current?.click()} className="flex-1 bg-panelLight text-xs rounded py-1.5">
              {currentBrush.texture ? 'Cambiar imagen' : 'Cargar imagen…'}
            </button>
            {currentBrush.texture && (
              <button onClick={() => updateCurrentBrush({ texture: undefined })} className="text-xs text-textDim hover:text-text px-2">
                Quitar
              </button>
            )}
          </div>
          <p className="text-[10px] text-textDim">Lo claro de la imagen pinta más opaco y lo oscuro menos — como un papel, tiza o estampa real, teñida con el color actual.</p>
        </div>

        <div className="mt-3">
          <input ref={tipsInputRef} type="file" accept="image/png,image/jpeg,image/webp" multiple className="hidden" onChange={handleTipFiles} />
          <button onClick={() => tipsInputRef.current?.click()} className="w-full bg-panelLight text-xs rounded py-1.5">
            Importar imágenes como pinceles (PNG/JPG, varias a la vez)…
          </button>
          <p className="text-[10px] text-textDim mt-1">Cada imagen se convierte en una punta: lo claro pinta y lo oscuro no.</p>
          <input ref={abrInputRef} type="file" accept=".abr,.brush,.kpp,.bundle" multiple className="hidden" onChange={handleAbrFiles} />
          <button onClick={() => abrInputRef.current?.click()} className="w-full bg-panelLight text-xs rounded py-1.5 mt-2">
            Importar pinceles (.abr, Procreate .brush, Krita .bundle/.kpp)…
          </button>
          <p className="text-[10px] text-textDim mt-1">.abr de Photoshop (CS y anteriores): puntas, tamaño, espaciado, dispersión y presión; la textura de papel y el pincel dual se integran de forma aproximada en la punta, los bordes húmedos y el ruido no. Procreate (.brush) y paquetes de Krita (.bundle): puntas, tamaño, espaciado, presión, orientación y dispersión (verificado con archivos reales); un .kpp suelto solo trae la punta si la lleva incrustada, y los .abr muy antiguos (v1/v2) solo se han probado con archivos sintéticos.</p>
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
