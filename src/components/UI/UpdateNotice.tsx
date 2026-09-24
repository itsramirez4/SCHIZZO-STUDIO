import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { Download, RefreshCw } from 'lucide-react';
import { isElectron } from '@/utils/fileUtils';
import i18n from '@/i18n';

/**
 * Silent by default — a "checking for updates" toast on every launch would get old fast. Only
 * speaks up for the moment that matters: a new version has finished downloading in the background
 * and is ready to install, which needs the person to knowingly choose to restart (never forced).
 * The other update:* events only produce a toast when checkForUpdatesNow() was called by hand
 * (the header's "Buscar actualizaciones" button) — so the automatic startup check stays silent
 * unless there's actually something to install.
 */
export default function UpdateNotice() {
  const { t } = useTranslation('dialogs');
  const [readyVersion, setReadyVersion] = useState<string | null>(null);

  useEffect(() => {
    if (!isElectron() || !window.electronAPI.onUpdateEvent) return;
    // i18n.t (not the hook's t) so these still resolve in whatever language is current when the
    // event actually fires, not whatever it was when this effect first ran.
    const offDownloaded = window.electronAPI.onUpdateEvent('update:downloaded', (version) => setReadyVersion(version as string));
    const offAvailable = window.electronAPI.onUpdateEvent('update:available', (version) => {
      if (manualCheckPending) toast.success(i18n.t('dialogs:updateNotice.downloadingToast', { version }));
    });
    const offNotAvailable = window.electronAPI.onUpdateEvent('update:not-available', () => {
      if (manualCheckPending) toast.success(i18n.t('dialogs:updateNotice.upToDateToast'));
    });
    const offError = window.electronAPI.onUpdateEvent('update:error', (message) => {
      console.warn('Actualización automática:', message);
      if (manualCheckPending) toast.error(i18n.t('dialogs:updateNotice.checkErrorToast'));
    });
    return () => {
      offDownloaded();
      offAvailable();
      offNotAvailable();
      offError();
    };
  }, []);

  if (!readyVersion) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-panel border border-border rounded-lg shadow-lg p-3 flex items-center gap-3 max-w-xs">
      <Download size={18} className="text-accent shrink-0" />
      <div className="text-xs flex-1">
        <div className="font-medium">{t('updateNotice.ready', { version: readyVersion })}</div>
        <div className="text-textDim">{t('updateNotice.installsOnRestart')}</div>
      </div>
      <button
        onClick={() => window.electronAPI.updateInstall()}
        className="flex items-center gap-1 text-[11px] bg-accentSoft text-accent hover:bg-accent hover:text-white rounded px-2 py-1 shrink-0 transition-colors"
      >
        <RefreshCw size={11} /> {t('updateNotice.restart')}
      </button>
      <button onClick={() => setReadyVersion(null)} className="text-textDim hover:text-text text-[11px] shrink-0">
        {t('updateNotice.later')}
      </button>
    </div>
  );
}

// Whether the *next* available/not-available/error event was provoked by a manual click, so the
// silent automatic startup check doesn't also produce a toast — reset the instant one arrives.
let manualCheckPending = false;

/** Called from the header's "Buscar actualizaciones" button. */
export function checkForUpdatesNow() {
  if (!isElectron() || !window.electronAPI.updateCheck) return;
  manualCheckPending = true;
  setTimeout(() => (manualCheckPending = false), 15000); // in case nothing ever answers
  window.electronAPI.updateCheck().finally(() => {
    setTimeout(() => (manualCheckPending = false), 500);
  });
}
