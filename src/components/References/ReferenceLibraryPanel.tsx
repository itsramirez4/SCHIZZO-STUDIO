import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Star, Trash2, ExternalLink } from 'lucide-react';
import { useReferenceLibraryStore } from '@/store/referenceLibraryStore';
import { buildReferenceFromDataUrl } from '@/services/referenceImport.service';
import { isElectron } from '@/utils/fileUtils';
import { searchReferences, fetchAsDataUrl, ReferenceSearchResult } from '@/services/referenceSearch.service';
import { ReferenceImage } from '@/types/references';

/** A persistent, cross-project library of reference photos — distinct from the existing "locked
 * reference layer" (which lives only inside one project's layer stack and is gone once deleted).
 * Same Electron-fs-JSON persistence pattern as the Asset Library, in its own file. */
export default function ReferenceLibraryPanel() {
  const references = useReferenceLibraryStore((s) => s.references);
  const loadLibrary = useReferenceLibraryStore((s) => s.loadLibrary);
  const addReference = useReferenceLibraryStore((s) => s.addReference);
  const removeReference = useReferenceLibraryStore((s) => s.removeReference);
  const toggleFavorite = useReferenceLibraryStore((s) => s.toggleFavorite);
  const setTags = useReferenceLibraryStore((s) => s.setTags);
  const recordView = useReferenceLibraryStore((s) => s.recordView);

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

  const filtered = references.filter((r) => {
    if (activeTag && !r.tags.includes(activeTag)) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      if (!r.name.toLowerCase().includes(q) && !r.tags.some((t) => t.toLowerCase().includes(q))) return false;
    }
    return true;
  });

  return (
    <div className="space-y-3">
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
                      <button
                        onClick={() => toggleFavorite(ref.id)}
                        className={ref.favorite ? 'text-accent' : 'text-textDim hover:text-text'}
                        title="Favorita"
                      >
                        <Star size={12} fill={ref.favorite ? 'currentColor' : 'none'} />
                      </button>
                      <button onClick={() => removeReference(ref.id)} className="text-textDim hover:text-red-400" title="Eliminar">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                  <div className="text-[9px] text-textDim">
                    {ref.width}×{ref.height} · {ref.viewCount} vista(s)
                  </div>
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
    </div>
  );
}
