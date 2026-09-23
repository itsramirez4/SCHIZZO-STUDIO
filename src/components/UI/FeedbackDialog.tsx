import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { X, Copy, Save, Mail, Globe, ChevronDown, ChevronRight } from 'lucide-react';
import { useUIStore } from '@/store/uiStore';
import { useAppStore } from '@/store/appStore';
import { getRecentErrors } from '@/services/diagnostics.service';
import { flattenLayers } from '@/services/layer.service';
import { isElectron, downloadDataUrl, sanitizeFilename } from '@/utils/fileUtils';
import { FEEDBACK_EMAIL } from '@/utils/constants';

const TYPE_LABELS: Record<string, string> = { drawing: 'Dibujo digital', pixelart: 'Pixel Art', comic: 'Cómic / Manga', '3d': '3D', hybrid: 'Híbrido' };
const THUMB_MAX_SIDE = 480;

/** Builds the plain-text diagnostic block — the same text whether it ends up copied, saved or
 * emailed, so what the person sees before sending is exactly what goes out. */
function buildDiagnosticText(project: ReturnType<typeof useAppStore.getState>['project']) {
  const errors = getRecentErrors();
  const lines = [
    `SCHIZZO STUDIO ${__APP_VERSION__}`,
    `Plataforma: ${navigator.platform} — ${isElectron() ? 'app de escritorio' : 'navegador'}`,
    project ? `Proyecto: ${TYPE_LABELS[project.type] ?? project.type}, ${project.width}×${project.height}px, ${project.layers.length} capa(s)` : 'Sin proyecto abierto',
  ];
  if (errors.length === 0) {
    lines.push('', 'Sin errores registrados en esta sesión.');
  } else {
    lines.push('', `Últimos ${errors.length} error(es) de esta sesión:`);
    for (const e of errors) lines.push(`  [${e.source}] ${e.message}`);
  }
  return lines.join('\n');
}

export default function FeedbackDialog() {
  const show = useUIStore((s) => s.showFeedbackDialog);
  const close = useUIStore((s) => s.closeFeedbackDialog);
  const project = useAppStore((s) => s.project);
  const [message, setMessage] = useState('');
  const [showDiagnostic, setShowDiagnostic] = useState(false);
  const [includeThumb, setIncludeThumb] = useState(false);
  const [thumb, setThumb] = useState<string | null>(null);

  const diagnostic = useMemo(() => (show ? buildDiagnosticText(project) : ''), [show, project]);

  if (!show) return null;

  function toggleThumb(checked: boolean) {
    setIncludeThumb(checked);
    if (checked && project && !thumb) {
      try {
        const flat = flattenLayers(project.layers, project.width, project.height);
        const k = Math.min(1, THUMB_MAX_SIDE / Math.max(project.width, project.height));
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(project.width * k));
        c.height = Math.max(1, Math.round(project.height * k));
        const ctx = c.getContext('2d')!;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(flat, 0, 0, c.width, c.height);
        setThumb(c.toDataURL('image/jpeg', 0.8));
      } catch (err) {
        console.error(err);
        toast.error('No se pudo generar la miniatura');
        setIncludeThumb(false);
      }
    }
  }

  const fullText = () => [message.trim(), message.trim() ? '' : null, '--- Diagnóstico ---', diagnostic].filter((l) => l !== null).join('\n');

  async function copyAll() {
    try {
      await navigator.clipboard.writeText(fullText());
      toast.success('Copiado al portapapeles');
    } catch {
      toast.error('No se pudo copiar');
    }
  }

  async function saveFile() {
    const name = `schizzo-comentario-${new Date().toISOString().slice(0, 10)}.txt`;
    if (isElectron()) {
      const r = await window.electronAPI.feedbackSave(fullText(), name);
      if (!r.canceled) toast.success('Guardado');
    } else {
      downloadDataUrl(`data:text/plain;charset=utf-8,${encodeURIComponent(fullText())}`, sanitizeFilename(name));
    }
    if (includeThumb && thumb) {
      // A second, separate save — a .txt can't carry an image, and silently dropping the
      // thumbnail the person asked to include would be worse than one extra save dialog.
      if (isElectron()) await window.electronAPI.exportImage(thumb, 'jpg', `schizzo-comentario-${new Date().toISOString().slice(0, 10)}`);
      else downloadDataUrl(thumb, 'schizzo-comentario.jpg');
    }
  }

  // Two ways to reach the same email, not one — a `mailto:` link only works if Windows' registered
  // handler for it actually points at a working mail app, which in practice often isn't true (an
  // unconfigured or uninstalled default "Mail" app swallows the request with no visible error, no
  // matter how correct the link is). Gmail's own compose URL only needs a working browser, which is
  // far more reliably present, so it's offered as an equal option rather than a buried fallback.
  function emailBody() {
    return fullText() + (includeThumb ? '\n\n(Adjunta también la miniatura que acabas de guardar/copiar, esto no la incluye sola.)' : '');
  }

  function sendByEmail() {
    const subject = encodeURIComponent('Comentario sobre SCHIZZO STUDIO');
    window.open(`mailto:${FEEDBACK_EMAIL}?subject=${subject}&body=${encodeURIComponent(emailBody())}`);
  }

  function sendByGmailWeb() {
    const params = new URLSearchParams({ view: 'cm', fs: '1', to: FEEDBACK_EMAIL, su: 'Comentario sobre SCHIZZO STUDIO', body: emailBody() });
    window.open(`https://mail.google.com/mail/?${params.toString()}`);
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={close}>
      <div className="bg-panel border border-border rounded-lg w-[420px] max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 p-4 pb-2">
          <h2 className="text-sm font-semibold flex-1">Enviar comentario</h2>
          <button onClick={close} className="text-textDim hover:text-text">
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto px-4 space-y-3">
          <p className="text-[11px] text-textDim leading-relaxed">
            Cuéntame qué ha pasado o qué se te ocurre. Se envía tal cual lo ves aquí — nada se manda solo.
          </p>
          <textarea
            autoFocus
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="¿Qué ha pasado, o qué quieres contarme?"
            rows={5}
            className="w-full bg-panelLight border border-border rounded px-2.5 py-2 text-xs resize-none"
          />

          {project && (
            <label className="flex items-center gap-2 text-[11px] text-textDim">
              <input type="checkbox" checked={includeThumb} onChange={(e) => toggleThumb(e.target.checked)} />
              Incluir una miniatura de lo que estaba dibujando
            </label>
          )}
          {includeThumb && thumb && (
            <img src={thumb} alt="Miniatura del lienzo" className="w-full rounded border border-border checkerboard" />
          )}

          <div>
            <button onClick={() => setShowDiagnostic((v) => !v)} className="flex items-center gap-1 text-[10px] text-textDim hover:text-text">
              {showDiagnostic ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              Diagnóstico incluido (versión, errores recientes...)
            </button>
            {showDiagnostic && (
              <pre className="mt-1.5 text-[9px] text-textDim bg-panelLight border border-border rounded p-2 whitespace-pre-wrap break-words max-h-40 overflow-y-auto">
                {diagnostic}
              </pre>
            )}
          </div>
        </div>
        <p className="px-4 pt-1 text-[9px] text-textDim">Si "Correo" o "Gmail" no abren nada, copia o guarda y mándamelo por donde prefieras.</p>
        <div className="flex flex-wrap items-center gap-1.5 p-4 pt-2">
          <button onClick={copyAll} className="flex-1 min-w-[90px] flex items-center justify-center gap-1.5 text-xs bg-panelLight hover:bg-border rounded py-1.5">
            <Copy size={13} /> Copiar
          </button>
          <button onClick={saveFile} className="flex-1 min-w-[90px] flex items-center justify-center gap-1.5 text-xs bg-panelLight hover:bg-border rounded py-1.5">
            <Save size={13} /> Guardar
          </button>
          <button
            onClick={sendByEmail}
            title="Abre tu cliente de correo — si no pasa nada al pulsar, probablemente no tienes uno configurado; prueba con Gmail al lado"
            className="flex-1 min-w-[90px] flex items-center justify-center gap-1.5 text-xs bg-accentSoft text-accent hover:bg-accent hover:text-white rounded py-1.5 transition-colors"
          >
            <Mail size={13} /> Correo
          </button>
          <button
            onClick={sendByGmailWeb}
            title="Abre un correo nuevo en Gmail, en el navegador — funciona aunque no tengas ningún cliente de correo configurado"
            className="flex-1 min-w-[90px] flex items-center justify-center gap-1.5 text-xs bg-accentSoft text-accent hover:bg-accent hover:text-white rounded py-1.5 transition-colors"
          >
            <Globe size={13} /> Gmail
          </button>
        </div>
      </div>
    </div>
  );
}
