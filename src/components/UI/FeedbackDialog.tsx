import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { X, Copy, Save, Mail, Globe, ChevronDown, ChevronRight } from 'lucide-react';
import { useUIStore } from '@/store/uiStore';
import { useAppStore } from '@/store/appStore';
import { getRecentErrors } from '@/services/diagnostics.service';
import { flattenLayers } from '@/services/layer.service';
import { isElectron, downloadDataUrl, sanitizeFilename } from '@/utils/fileUtils';
import { FEEDBACK_EMAIL } from '@/utils/constants';
import i18n from '@/i18n';

const TYPE_LABELS: Record<string, string> = { drawing: 'Dibujo digital', pixelart: 'Pixel Art', comic: 'Cómic / Manga', '3d': '3D', hybrid: 'Híbrido' };
const THUMB_MAX_SIDE = 480;

/** Builds the plain-text diagnostic block — the same text whether it ends up copied, saved or
 * emailed, so what the person sees before sending is exactly what goes out. Uses `i18n.t`
 * directly rather than the `useTranslation` hook since it's called from outside render too
 * (useMemo below); reads the dialogs namespace explicitly since this isn't a component. */
function buildDiagnosticText(project: ReturnType<typeof useAppStore.getState>['project']) {
  const t = (key: string, opts?: Record<string, unknown>) => i18n.t(`dialogs:feedback.${key}`, opts);
  const errors = getRecentErrors();
  const lines = [
    t('diagnosticVersion', { version: __APP_VERSION__ }),
    t('diagnosticPlatform', { platform: navigator.platform, context: isElectron() ? t('diagnosticDesktop') : t('diagnosticBrowser') }),
    project ? t('diagnosticProject', { type: TYPE_LABELS[project.type] ?? project.type, width: project.width, height: project.height, layers: project.layers.length }) : t('diagnosticNoProject'),
  ];
  if (errors.length === 0) {
    lines.push('', t('diagnosticNoErrors'));
  } else {
    lines.push('', t('diagnosticRecentErrors', { count: errors.length }));
    for (const e of errors) lines.push(`  [${e.source}] ${e.message}`);
  }
  return lines.join('\n');
}

export default function FeedbackDialog() {
  const { t } = useTranslation('dialogs');
  const show = useUIStore((s) => s.showFeedbackDialog);
  const close = useUIStore((s) => s.closeFeedbackDialog);
  const feedbackContext = useUIStore((s) => s.feedbackContext);
  const project = useAppStore((s) => s.project);
  const [message, setMessage] = useState('');
  const [showDiagnostic, setShowDiagnostic] = useState(false);
  const [includeThumb, setIncludeThumb] = useState(false);
  const [thumb, setThumb] = useState<string | null>(null);

  // The component never actually unmounts (it just renders null below when closed), so a useState
  // initializer would only ever run once, at app startup — this re-seeds the message every time
  // the dialog actually opens instead.
  useEffect(() => {
    if (show) setMessage(feedbackContext ?? '');
  }, [show, feedbackContext]);

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
        toast.error(t('feedback.thumbErrorToast'));
        setIncludeThumb(false);
      }
    }
  }

  const fullText = () => [message.trim(), message.trim() ? '' : null, '--- Diagnóstico ---', diagnostic].filter((l) => l !== null).join('\n');

  async function copyAll() {
    try {
      await navigator.clipboard.writeText(fullText());
      toast.success(t('feedback.copiedToast'));
    } catch {
      toast.error(t('feedback.copyErrorToast'));
    }
  }

  async function saveFile() {
    const name = `schizzo-comentario-${new Date().toISOString().slice(0, 10)}.txt`;
    if (isElectron()) {
      const r = await window.electronAPI.feedbackSave(fullText(), name);
      if (!r.canceled) toast.success(t('feedback.savedToast'));
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
    return fullText() + (includeThumb ? `\n\n(${t('feedback.attachThumbNote')})` : '');
  }

  function sendByEmail() {
    const subject = encodeURIComponent(t('feedback.subject'));
    window.open(`mailto:${FEEDBACK_EMAIL}?subject=${subject}&body=${encodeURIComponent(emailBody())}`);
  }

  function sendByGmailWeb() {
    const params = new URLSearchParams({ view: 'cm', fs: '1', to: FEEDBACK_EMAIL, su: t('feedback.subject'), body: emailBody() });
    window.open(`https://mail.google.com/mail/?${params.toString()}`);
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={close}>
      <div className="bg-panel border border-border rounded-lg w-[420px] max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 p-4 pb-2">
          <h2 className="text-sm font-semibold flex-1">{t('feedback.title')}</h2>
          <button onClick={close} className="text-textDim hover:text-text">
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto px-4 space-y-3">
          <p className="text-[11px] text-textDim leading-relaxed">{t('feedback.intro')}</p>
          <textarea
            autoFocus
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={t('feedback.placeholder')}
            rows={5}
            className="w-full bg-panelLight border border-border rounded px-2.5 py-2 text-xs resize-none"
          />

          {project && (
            <label className="flex items-center gap-2 text-[11px] text-textDim">
              <input type="checkbox" checked={includeThumb} onChange={(e) => toggleThumb(e.target.checked)} />
              {t('feedback.includeThumb')}
            </label>
          )}
          {includeThumb && thumb && (
            <img src={thumb} alt={t('feedback.thumbAlt')} className="w-full rounded border border-border checkerboard" />
          )}

          <div>
            <button onClick={() => setShowDiagnostic((v) => !v)} className="flex items-center gap-1 text-[10px] text-textDim hover:text-text">
              {showDiagnostic ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              {t('feedback.diagnosticToggle')}
            </button>
            {showDiagnostic && (
              <pre className="mt-1.5 text-[9px] text-textDim bg-panelLight border border-border rounded p-2 whitespace-pre-wrap break-words max-h-40 overflow-y-auto">
                {diagnostic}
              </pre>
            )}
          </div>
        </div>
        <p className="px-4 pt-1 text-[9px] text-textDim">{t('feedback.sendHint')}</p>
        <div className="flex flex-wrap items-center gap-1.5 p-4 pt-2">
          <button onClick={copyAll} className="flex-1 min-w-[90px] flex items-center justify-center gap-1.5 text-xs bg-panelLight hover:bg-border rounded py-1.5">
            <Copy size={13} /> {t('feedback.copy')}
          </button>
          <button onClick={saveFile} className="flex-1 min-w-[90px] flex items-center justify-center gap-1.5 text-xs bg-panelLight hover:bg-border rounded py-1.5">
            <Save size={13} /> {t('feedback.save')}
          </button>
          <button
            onClick={sendByEmail}
            title={t('feedback.emailTitle')}
            className="flex-1 min-w-[90px] flex items-center justify-center gap-1.5 text-xs bg-accentSoft text-accent hover:bg-accent hover:text-white rounded py-1.5 transition-colors"
          >
            <Mail size={13} /> {t('feedback.email')}
          </button>
          <button
            onClick={sendByGmailWeb}
            title={t('feedback.gmailTitle')}
            className="flex-1 min-w-[90px] flex items-center justify-center gap-1.5 text-xs bg-accentSoft text-accent hover:bg-accent hover:text-white rounded py-1.5 transition-colors"
          >
            <Globe size={13} /> {t('feedback.gmail')}
          </button>
        </div>
      </div>
    </div>
  );
}
