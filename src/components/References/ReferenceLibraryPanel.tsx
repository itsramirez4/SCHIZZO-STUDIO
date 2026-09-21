import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Star, Trash2, ExternalLink, FolderInput, GitCompare, Folder } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { useReferenceLibraryStore } from '@/store/referenceLibraryStore';
import { buildReferenceFromDataUrl } from '@/services/referenceImport.service';
import { isElectron } from '@/utils/fileUtils';
import { searchReferences, fetchAsDataUrl, ReferenceSearchResult } from '@/services/referenceSearch.service';
import { ReferenceImage } from '@/types/references';
import * as layerService from '@/services/layer.service';
import CompareDialog, { CompareSource } from '@/components/Versions/CompareDialog';

const NO_FOLDER = '\u0000none';

/** The reference scaled to fit inside a `w`×`h` canvas (centred, transparent margins), optionally
 * mirrored — so it lines up with the drawing in every comparison mode. */
async function fitToCanvas(dataUrl: string, w: number, h: number, mirror: boolean): Promise<string> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = dataUrl;
  });
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  const scale = Math.min(w / img.naturalWidth, h / img.naturalHeight);
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  if (mirror) {
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
  return c.toDataURL('image/png');
}

/** A persistent, cross-project library of reference photos — distinct from the existing "locked
 * reference layer" (which lives only inside one project's layer stack and is gone once deleted).
 * Same Electron-fs-JSON persistence pattern as the Asset Library, in its own file. */
export default function ReferenceLibraryPanel() {
  const globalRefs = useReferenceLibraryStore((s) => s.references);
  const loadLibrary = useReferenceLibraryStore((s) => s.loadLibrary);
  const addGlobal = useReferenceLibraryStore((s) => s.addReference);
  const removeGlobal = useReferenceLibraryStore((s) => s.removeReference);
  const toggleGlobalFavorite = useReferenceLibraryStore((s) => s.toggleFavorite);
  const setGlobalTags = useReferenceLibraryStore((s) => s.setTags);
  const recordGlobalView = useReferenceLibraryStore((s) => s.recordView);
  const mapGlobal = useReferenceLibraryStore((s) => s.mapReferences);
  const project = useAppStore((s) => s.project);
  const updateProjectReferences = useAppStore((s) => s.updateProjectReferences);

  // Two shelves: the global library (every project) and the references saved with this project.
  // (Opens on the project's own shelf when a project is open — references are studied per drawing.)
  const [scope, setScope] = useState<'global' | 'project'>(project ? 'project' : 'global');
  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [extraFolders, setExtraFolders] = useState<string[]>([]);
  const [compare, setCompare] = useState<{ sources: CompareSource[] } | null>(null);
  // Electron has no window.prompt, so folder names are typed into an inline field instead.
  const [folderEditor, setFolderEditor] = useState<{ mode: 'new' | 'rename'; value: string; old?: string; forRefId?: string } | null>(null);
  const inProject = scope === 'project' && !!project;
  const projectRefs = project?.references ?? [];
  const references = inProject ? projectRefs : globalRefs;
  // Always read the project's shelf at call time: several imports in a row (a multi-file import) would
  // otherwise each start from the same stale list and the last one would overwrite the others.
  const freshProjectRefs = () => useAppStore.getState().project?.references ?? [];
  const patchProject = (fn: (r: ReferenceImage) => ReferenceImage) => updateProjectReferences(freshProjectRefs().map(fn));
  // New references go into the folder currently open.
  const addReference = (raw: ReferenceImage) => {
    const r = activeFolder && activeFolder !== NO_FOLDER ? { ...raw, folder: activeFolder } : raw;
    return inProject ? updateProjectReferences([r, ...freshProjectRefs()]) : addGlobal(r);
  };
  const mapRefs = (fn: (r: ReferenceImage) => ReferenceImage) => (inProject ? patchProject(fn) : mapGlobal(fn));
  const setFolder = (id: string, folder: string | undefined) => mapRefs((r) => (r.id === id ? { ...r, folder } : r));
  const removeReference = (id: string) => (inProject ? updateProjectReferences(freshProjectRefs().filter((r) => r.id !== id)) : removeGlobal(id));
  const toggleFavorite = (id: string) => (inProject ? patchProject((r) => (r.id === id ? { ...r, favorite: !r.favorite } : r)) : toggleGlobalFavorite(id));
  const setTags = (id: string, tags: string[]) => (inProject ? patchProject((r) => (r.id === id ? { ...r, tags } : r)) : setGlobalTags(id, tags));
  const recordView = (id: string) => (inProject ? patchProject((r) => (r.id === id ? { ...r, viewCount: r.viewCount + 1, lastViewedAt: Date.now() } : r)) : recordGlobalView(id));
  /** Copies a reference to the other shelf (a project keeps its own copy of the pixels). */
  const copyToOtherShelf = (ref: ReferenceImage) => {
    const copy = { ...ref, id: `${ref.id}-${Date.now().toString(36)}` };
    if (inProject) addGlobal(copy);
    else updateProjectReferences([copy, ...freshProjectRefs()]);
    toast.success(inProject ? 'Copiada a la biblioteca global' : 'Copiada a este proyecto');
  };

  const [search, setSearch] = useState('');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [webQuery, setWebQuery] = useState('');
  const [webResults, setWebResults] = useState<ReferenceSearchResult[] | null>(null);
  const [webBusy, setWebBusy] = useState(false);

  useEffect(() => {
    loadLibrary();
  }, [loadLibrary]);

  async function importFromFile() {
    if (!isElectron()) {
      toast.error('Importar solo está disponible en la app de escritorio');
      return;
    }
    const result = await window.electronAPI.importImages();
    if (result.canceled) return;
    setIsImporting(true);
    try {
      for (const file of result.files) {
        const ref = await buildReferenceFromDataUrl(file.dataUrl, file.name.replace(/\.[^.]+$/, ''));
        addReference(ref);
      }
      toast.success(`${result.files.length} referencia(s) importada(s)`);
    } finally {
      setIsImporting(false);
    }
  }

  async function importFromUrl() {
    const url = urlInput.trim();
    if (!url) return;
    setIsImporting(true);
    try {
      const result = await window.electronAPI.fetchImageUrl(url);
      if (!result.ok || !result.dataUrl) {
        toast.error(result.error || 'No se pudo descargar la imagen');
        return;
      }
      const name = decodeURIComponent(url.split('/').pop()?.split('?')[0] || 'Referencia');
      const ref = await buildReferenceFromDataUrl(result.dataUrl, name, url);
      addReference(ref);
      setUrlInput('');
      toast.success('Referencia importada');
    } finally {
      setIsImporting(false);
    }
  }

  async function runWebSearch() {
    const q = webQuery.trim();
    if (!q) return;
    setWebBusy(true);
    try {
      setWebResults(await searchReferences(q));
    } catch {
      toast.error('No se pudo buscar: comprueba tu conexión a internet');
    } finally {
      setWebBusy(false);
    }
  }

  async function saveWebResult(r: ReferenceSearchResult) {
    setWebBusy(true);
    try {
      const dataUrl = await fetchAsDataUrl(r.imageUrl);
      const ref = await buildReferenceFromDataUrl(dataUrl, r.title, r.pageUrl);
      ref.tags = ['web', r.license];
      addReference(ref);
      toast.success('Guardada en tus referencias');
    } catch {
      toast.error('No se pudo descargar la imagen');
    } finally {
      setWebBusy(false);
    }
  }

  async function openWindow(ref: ReferenceImage) {
    recordView(ref.id);
    if (!isElectron()) {
      toast.error('Las ventanas de referencia solo están disponibles en la app de escritorio');
      return;
    }
    await window.electronAPI.openReferenceWindow(ref.dataUrl, ref.name);
  }

  function commitTags(id: string, raw: string) {
    const tags = raw
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    setTags(id, tags);
  }

  const allTags = Array.from(new Set(references.flatMap((r) => r.tags))).sort();
  const folders = Array.from(new Set([...references.map((r) => r.folder).filter((f): f is string => !!f), ...extraFolders])).sort();
  const folderCount = (f: string) => references.filter((r) => (f === NO_FOLDER ? !r.folder : r.folder === f)).length;

  const newFolder = () => setFolderEditor({ mode: 'new', value: '' });
  const renameFolder = (old: string) => setFolderEditor({ mode: 'rename', value: old, old });
  function commitFolderEditor() {
    if (!folderEditor) return;
    const name = folderEditor.value.trim();
    const { mode, old, forRefId } = folderEditor;
    setFolderEditor(null);
    if (!name) return;
    if (mode === 'rename' && old) {
      if (name !== old) {
        mapRefs((r) => (r.folder === old ? { ...r, folder: name } : r));
        setExtraFolders((f) => f.map((x) => (x === old ? name : x)));
      }
      setActiveFolder(name);
      return;
    }
    setExtraFolders((f) => (f.includes(name) ? f : [...f, name]));
    if (forRefId) setFolder(forRefId, name);
    else setActiveFolder(name);
  }
  function removeFolder(old: string) {
    if (!window.confirm(`¿Quitar la carpeta «${old}»? Sus referencias no se borran: pasan a «Sin carpeta».`)) return;
    mapRefs((r) => (r.folder === old ? { ...r, folder: undefined } : r));
    setExtraFolders((f) => f.filter((x) => x !== old));
    setActiveFolder(null);
  }

  /** Puts the drawing and this reference (fitted to the canvas, plus a mirrored copy) into the compare dialog. */
  async function compareWithDrawing(ref: ReferenceImage) {
    if (!project) {
      toast.error('Abre un proyecto para comparar');
      return;
    }
    try {
      const drawing = layerService.flattenLayers(project.layers, project.width, project.height).toDataURL('image/png');
      const [fit, mirrored] = await Promise.all([
        fitToCanvas(ref.dataUrl, project.width, project.height, false),
        fitToCanvas(ref.dataUrl, project.width, project.height, true),
      ]);
      setCompare({
        sources: [
          { id: 'drawing', label: 'Tu dibujo (estado actual)', url: drawing },
          { id: 'ref', label: `Referencia · ${ref.name}`, url: fit },
          { id: 'ref-mirrored', label: `Referencia volteada (espejo) · ${ref.name}`, url: mirrored },
        ],
      });
    } catch {
      toast.error('No se pudo preparar la comparación');
    }
  }

  const filtered = references.filter((r) => {
    if (activeFolder === NO_FOLDER ? !!r.folder : activeFolder && r.folder !== activeFolder) return false;
    if (activeTag && !r.tags.includes(activeTag)) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      if (!r.name.toLowerCase().includes(q) && !r.tags.some((t) => t.toLowerCase().includes(q))) return false;
    }
    return true;
  });

  return (
    <div className="space-y-3">
      <div className="flex rounded overflow-hidden border border-border text-[11px]">
        {(['global', 'project'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setScope(s)}
            disabled={s === 'project' && !project}
            className={`flex-1 py-1 disabled:opacity-40 ${scope === s ? 'bg-accent text-white' : 'bg-panel text-textDim hover:text-text'}`}
          >
            {s === 'global' ? 'Biblioteca global' : `Este proyecto (${projectRefs.length})`}
          </button>
        ))}
      </div>
      <div className="space-y-1" data-testid="reference-folders">
        <div className="flex flex-wrap gap-1 items-center">
          {([[null, 'Todas', references.length], [NO_FOLDER, 'Sin carpeta', folderCount(NO_FOLDER)]] as [string | null, string, number][]).map(([key, label, n]) => (
            <button
              key={label}
              onClick={() => setActiveFolder(key)}
              className={`text-[10px] rounded px-2 py-0.5 border ${activeFolder === key ? 'bg-accent text-white border-accent' : 'bg-panel border-border text-textDim'}`}
            >
              {label} ({n})
            </button>
          ))}
          {folders.map((f) => (
            <button
              key={f}
              onClick={() => setActiveFolder(f)}
              className={`text-[10px] rounded px-2 py-0.5 border flex items-center gap-1 ${activeFolder === f ? 'bg-accent text-white border-accent' : 'bg-panel border-border text-textDim'}`}
            >
              <Folder size={10} />
              {f} ({folderCount(f)})
            </button>
          ))}
          <button onClick={newFolder} className="text-[10px] rounded px-2 py-0.5 border border-dashed border-border text-textDim hover:text-text">
            + Carpeta
          </button>
        </div>
        {folderEditor && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              commitFolderEditor();
            }}
            className="flex gap-1"
            data-testid="folder-editor"
          >
            <input
              autoFocus
              value={folderEditor.value}
              onChange={(e) => setFolderEditor({ ...folderEditor, value: e.target.value })}
              onKeyDown={(e) => e.key === 'Escape' && setFolderEditor(null)}
              placeholder={folderEditor.mode === 'new' ? 'Nombre de la carpeta (p. ej. «Manos»)…' : 'Nuevo nombre…'}
              className="flex-1 min-w-0 bg-panel border border-border rounded text-[10px] px-1.5 py-0.5"
            />
            <button type="submit" className="text-[10px] bg-accent text-white rounded px-2">
              Aceptar
            </button>
            <button type="button" onClick={() => setFolderEditor(null)} className="text-[10px] bg-panelLight rounded px-2">
              Cancelar
            </button>
          </form>
        )}
        {activeFolder && activeFolder !== NO_FOLDER && !folderEditor && (
          <div className="flex gap-3 text-[9px] text-textDim">
            <span>Lo que importes ahora se guarda en «{activeFolder}».</span>
            <button onClick={() => renameFolder(activeFolder)} className="underline hover:text-text">
              Renombrar
            </button>
            <button onClick={() => removeFolder(activeFolder)} className="underline hover:text-red-400">
              Quitar carpeta
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        <button onClick={importFromFile} disabled={isImporting} className="text-[11px] bg-panelLight rounded py-1.5 disabled:opacity-40">
          Importar archivo…
        </button>
        <div className="flex gap-1">
          <input
            type="text"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="URL de imagen…"
            className="flex-1 min-w-0 bg-panel border border-border rounded text-[10px] px-1.5"
          />
          <button onClick={importFromUrl} disabled={isImporting || !urlInput.trim()} className="text-[10px] bg-panelLight rounded px-2 disabled:opacity-40">
            Ir
          </button>
        </div>
      </div>

      <details className="border border-border rounded">
        <summary className="text-[11px] px-2 py-1.5 cursor-pointer">Buscar referencias en internet</summary>
        <div className="p-2 space-y-2">
          <div className="flex gap-1">
            <input
              type="text"
              value={webQuery}
              onChange={(e) => setWebQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && runWebSearch()}
              placeholder="p. ej. «hands study», «horse anatomy»…"
              className="flex-1 min-w-0 bg-panel border border-border rounded text-[10px] px-1.5 py-1"
            />
            <button onClick={runWebSearch} disabled={webBusy || !webQuery.trim()} className="text-[10px] bg-panelLight rounded px-2 disabled:opacity-40">
              {webBusy ? '…' : 'Buscar'}
            </button>
          </div>
          <p className="text-[9px] text-textDim">Imágenes de Wikimedia Commons (licencias libres, se guarda la licencia como etiqueta). Requiere conexión; la búsqueda en inglés da más resultados.</p>
          {webResults && webResults.length === 0 && <p className="text-[10px] text-textDim">Sin resultados.</p>}
          {webResults && webResults.length > 0 && (
            <div className="grid grid-cols-3 gap-1 max-h-64 overflow-y-auto">
              {webResults.map((r) => (
                <button key={r.id} onClick={() => saveWebResult(r)} disabled={webBusy} title={`${r.title} — ${r.license}${r.author ? ` — ${r.author}` : ''}
Clic para guardar en tus referencias`} className="relative aspect-square overflow-hidden rounded border border-border hover:border-accent">
                  <img src={r.thumbUrl} alt={r.title} loading="lazy" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      </details>

      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Buscar por nombre o etiqueta…"
        className="w-full bg-panel border border-border rounded text-[11px] px-1.5 py-1"
      />

      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {allTags.map((tag) => (
            <button
              key={tag}
              onClick={() => setActiveTag(activeTag === tag ? null : tag)}
              className={`text-[9px] rounded-full px-2 py-0.5 border ${
                activeTag === tag ? 'bg-accent text-white border-accent' : 'bg-panel border-border text-textDim'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="text-[10px] text-textDim">No hay referencias{search || activeTag ? ' que coincidan' : ' guardadas todavía'}.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((ref) => (
            <div key={ref.id} className="border border-border rounded p-1.5">
              <div className="flex gap-2">
                <img src={ref.dataUrl} alt="" className="w-14 h-14 object-cover rounded border border-border shrink-0" />
                <div className="flex-1 min-w-0 space-y-0.5">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[11px] truncate">{ref.name}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => openWindow(ref)} className="text-textDim hover:text-text" title="Abrir en ventana flotante">
                        <ExternalLink size={12} />
                      </button>
                      <button onClick={() => compareWithDrawing(ref)} className="text-textDim hover:text-text" title="Comparar con mi dibujo (superposición, deslizador, espejo…)" data-testid="compare-reference">
                        <GitCompare size={12} />
                      </button>
                      <button
                        onClick={() => toggleFavorite(ref.id)}
                        className={ref.favorite ? 'text-accent' : 'text-textDim hover:text-text'}
                        title="Favorita"
                      >
                        <Star size={12} fill={ref.favorite ? 'currentColor' : 'none'} />
                      </button>
                      {project && (
                        <button onClick={() => copyToOtherShelf(ref)} className="text-textDim hover:text-text" title={inProject ? 'Copiar a la biblioteca global' : 'Copiar a este proyecto'}>
                          <FolderInput size={12} />
                        </button>
                      )}
                      <button onClick={() => removeReference(ref.id)} className="text-textDim hover:text-red-400" title="Eliminar">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                  <div className="text-[9px] text-textDim">
                    {ref.width}×{ref.height} · {ref.viewCount} vista(s)
                  </div>
                  <select
                    value={ref.folder ?? ''}
                    onChange={(e) => {
                      if (e.target.value === '\u0000new') setFolderEditor({ mode: 'new', value: '', forRefId: ref.id });
                      else setFolder(ref.id, e.target.value || undefined);
                    }}
                    className="w-full bg-panel border border-border rounded text-[9px] px-1 py-0.5"
                    title="Carpeta"
                  >
                    <option value="">Sin carpeta</option>
                    {folders.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                    <option value={'\u0000new'}>+ Nueva carpeta…</option>
                  </select>
                  <input
                    type="text"
                    defaultValue={ref.tags.join(', ')}
                    onBlur={(e) => commitTags(ref.id, e.target.value)}
                    placeholder="etiquetas separadas por coma"
                    className="w-full bg-panel border border-border rounded text-[9px] px-1 py-0.5"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {compare && (
        <CompareDialog
          sources={compare.sources}
          initialA="drawing"
          initialB="ref"
          title="Comparar dibujo y referencia"
          labelA="Dibujo"
          labelB="Referencia"
          initialMode="overlay"
          onClose={() => setCompare(null)}
        />
      )}
    </div>
  );
}
