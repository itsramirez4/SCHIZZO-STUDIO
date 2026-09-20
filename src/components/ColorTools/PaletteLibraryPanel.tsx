import { useState } from 'react';
import toast from 'react-hot-toast';
import { Star, Trash2, Copy, Upload, FolderInput } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { useAssetLibraryStore } from '@/store/assetLibraryStore';
import { useTools } from '@/hooks/useTools';
import { encodePaletteCode, decodePaletteCode } from '@/services/paletteShare.service';
import { createPalette } from '@/services/paletteLibrary.service';
import { parsePaletteFile } from '@/services/paletteExtraction.service';
import { isElectron } from '@/utils/fileUtils';

/** Saved palettes come from the "Guardar" buttons on the Harmony/Extracción/Generador tabs —
 * this panel is for browsing, applying, favoriting, deleting, and sharing them, plus importing
 * one from a pasted code. No dedicated store: palettes live in the existing assetLibraryStore,
 * same persistence as patterns/gradients/textures. */
export default function PaletteLibraryPanel() {
  const palettes = useAssetLibraryStore((s) => s.palettes);
  const removePalette = useAssetLibraryStore((s) => s.removePalette);
  const togglePaletteFavorite = useAssetLibraryStore((s) => s.togglePaletteFavorite);
  const addPalette = useAssetLibraryStore((s) => s.addPalette);
  const { setPrimaryColor } = useTools();
  const [importCode, setImportCode] = useState('');
  const project = useAppStore((s) => s.project);
  const updateProjectPalettes = useAppStore((s) => s.updateProjectPalettes);
  const projectPalettes = project?.palettes ?? [];
  const addToProject = (p: { name: string; colors: string[] }) => {
    updateProjectPalettes([...projectPalettes, createPalette(p.name, p.colors)]);
    toast.success('Guardada en este proyecto');
  };

  function copyCode(name: string, colors: string[]) {
    const code = encodePaletteCode(name, colors);
    navigator.clipboard.writeText(code).then(
      () => toast.success('Código copiado — pegalo donde quieras compartirlo'),
      () => toast.error('No se pudo copiar')
    );
  }

  function importFromCode() {
    const decoded = decodePaletteCode(importCode);
    if (!decoded) {
      toast.error('Código de paleta inválido');
      return;
    }
    addPalette(createPalette(decoded.name, decoded.colors));
    setImportCode('');
    toast.success(`Paleta "${decoded.name}" importada`);
  }

  async function importFromFile() {
    if (!isElectron()) {
      toast.error('Importar desde archivo solo está disponible en la app de escritorio');
      return;
    }
    const result = await window.electronAPI.importPaletteFile();
    if (result.canceled || !result.content) return;
    const colors = parsePaletteFile(result.content);
    if (colors.length === 0) {
      toast.error('No se encontraron colores válidos en el archivo (se admiten .gpl y .hex)');
      return;
    }
    const name = result.name || 'Paleta importada';
    addPalette(createPalette(name, colors));
    toast.success(`Paleta "${name}" importada (${colors.length} colores)`);
  }

  const sorted = [...palettes].sort((a, b) => Number(b.favorite) - Number(a.favorite) || b.created - a.created);

  return (
    <div className="space-y-3">
      <div className="flex gap-1.5">
        <input
          type="text"
          value={importCode}
          onChange={(e) => setImportCode(e.target.value)}
          placeholder="Pegar código de paleta…"
          className="flex-1 bg-panel border border-border rounded text-[11px] px-1.5 py-1 font-mono"
        />
        <button onClick={importFromCode} disabled={!importCode.trim()} className="text-[11px] bg-panelLight rounded px-2.5 disabled:opacity-40">
          Importar
        </button>
        <button onClick={importFromFile} title="Importar desde archivo .gpl o .hex" className="text-textDim hover:text-text shrink-0">
          <Upload size={14} />
        </button>
      </div>

      {project && (
        <div className="space-y-1.5">
          <div className="text-[10px] uppercase tracking-wide text-textDim">Paletas de este proyecto</div>
          {projectPalettes.length === 0 ? (
            <p className="text-[10px] text-textDim">Ninguna todavía: usa el icono de carpeta de una paleta para guardarla en el proyecto.</p>
          ) : (
            projectPalettes.map((p) => (
              <div key={p.id} className="border border-accent/40 rounded p-1.5 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] truncate">{p.name}</span>
                  <button onClick={() => updateProjectPalettes(projectPalettes.filter((x) => x.id !== p.id))} className="text-textDim hover:text-red-400" title="Quitar del proyecto">
                    <Trash2 size={12} />
                  </button>
                </div>
                <div className="flex gap-1">
                  {p.colors.map((hex, i) => (
                    <button key={i} onClick={() => setPrimaryColor(hex)} className="flex-1 h-7 rounded border border-border" style={{ background: hex }} title={`${hex} — usar como color primario`} />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {sorted.length === 0 ? (
        <p className="text-[10px] text-textDim">No hay paletas guardadas todavía.</p>
      ) : (
        <div className="space-y-2">
          {sorted.map((p) => (
            <div key={p.id} className="border border-border rounded p-1.5 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] truncate">{p.name}</span>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => copyCode(p.name, p.colors)} className="text-textDim hover:text-text" title="Copiar código para compartir">
                    <Copy size={12} />
                  </button>
                  {project && (
                    <button onClick={() => addToProject(p)} className="text-textDim hover:text-text" title="Guardar en este proyecto">
                      <FolderInput size={12} />
                    </button>
                  )}
                  <button onClick={() => togglePaletteFavorite(p.id)} className={p.favorite ? 'text-accent' : 'text-textDim hover:text-text'} title="Favorita">
                    <Star size={12} fill={p.favorite ? 'currentColor' : 'none'} />
                  </button>
                  {!p.builtIn && (
                    <button onClick={() => removePalette(p.id)} className="text-textDim hover:text-red-400" title="Eliminar">
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              </div>
              <div className="flex gap-1">
                {p.colors.map((hex, i) => (
                  <button
                    key={i}
                    onClick={() => setPrimaryColor(hex)}
                    className="flex-1 h-7 rounded border border-border"
                    style={{ background: hex }}
                    title={`${hex} — usar como color primario`}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
