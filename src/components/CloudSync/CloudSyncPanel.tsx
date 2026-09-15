import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Cloud, Download, Trash2, Upload, RefreshCw } from 'lucide-react';
import { useCloudSyncStore } from '@/store/cloudSyncStore';
import { useAppStore } from '@/store/appStore';
import { CloudProvider, CLOUD_PROVIDER_LABELS } from '@/types/cloudSync';
import { uploadProjectToCloud, downloadProjectFromCloud } from '@/services/cloudProjectSync.service';
import { isElectron } from '@/utils/fileUtils';

const PROVIDERS = Object.keys(CLOUD_PROVIDER_LABELS) as CloudProvider[];

/**
 * Real OAuth (PKCE + system-browser + loopback redirect, per RFC 8252) and real REST API calls
 * to each provider — but every provider requires the USER to register their own app in that
 * provider's developer console (Dropbox App Console / Google Cloud Console / Azure App
 * Registration) to get a Client ID, since a third-party app can't ship credentials for accounts
 * it doesn't control. The exact redirect URI to register is shown below each provider's fields.
 */
export default function CloudSyncPanel() {
  const loadAll = useCloudSyncStore((s) => s.loadAll);
  const configs = useCloudSyncStore((s) => s.configs);
  const status = useCloudSyncStore((s) => s.status);
  const files = useCloudSyncStore((s) => s.files);
  const busy = useCloudSyncStore((s) => s.busy);
  const redirectUri = useCloudSyncStore((s) => s.redirectUri);
  const setConfig = useCloudSyncStore((s) => s.setConfig);
  const connect = useCloudSyncStore((s) => s.connect);
  const disconnect = useCloudSyncStore((s) => s.disconnect);
  const refreshFiles = useCloudSyncStore((s) => s.refreshFiles);

  const project = useAppStore((s) => s.project);
  const loadProjectData = useAppStore((s) => s.loadProjectData);

  const [clientIdDrafts, setClientIdDrafts] = useState<Partial<Record<CloudProvider, string>>>({});
  const [clientSecretDrafts, setClientSecretDrafts] = useState<Partial<Record<CloudProvider, string>>>({});

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    setClientIdDrafts(Object.fromEntries(PROVIDERS.map((p) => [p, configs[p]?.clientId ?? ''])));
    setClientSecretDrafts(Object.fromEntries(PROVIDERS.map((p) => [p, configs[p]?.clientSecret ?? ''])));
  }, [configs]);

  if (!isElectron()) {
    return <p className="text-[10px] text-textDim p-3">La sincronización en la nube solo está disponible en la app de escritorio.</p>;
  }

  async function saveConfig(provider: CloudProvider) {
    await setConfig(provider, { clientId: (clientIdDrafts[provider] || '').trim(), clientSecret: (clientSecretDrafts[provider] || '').trim() || undefined });
    toast.success('Guardado');
  }

  async function handleConnect(provider: CloudProvider) {
    if (!configs[provider]?.clientId) {
      toast.error('Guardá el Client ID primero');
      return;
    }
    const result = await connect(provider);
    if (result.ok) {
      toast.success(`${CLOUD_PROVIDER_LABELS[provider]} conectado`);
      refreshFiles(provider);
    } else {
      toast.error(result.error || 'No se pudo conectar');
    }
  }

  async function handleUpload(provider: CloudProvider) {
    if (!project) return;
    const result = await uploadProjectToCloud(provider, project);
    if (result.ok) {
      toast.success('Proyecto subido');
      refreshFiles(provider);
    } else {
      toast.error(result.error || 'No se pudo subir');
    }
  }

  async function handleDownload(provider: CloudProvider, fileId: string) {
    const result = await downloadProjectFromCloud(provider, fileId);
    if (result.ok && result.project) {
      loadProjectData(result.project);
      toast.success('Proyecto abierto');
    } else {
      toast.error(result.error || 'No se pudo descargar');
    }
  }

  async function handleDelete(provider: CloudProvider, fileId: string) {
    const result = await window.electronAPI.cloudDelete(provider, fileId);
    if (result.ok) {
      toast.success('Eliminado');
      refreshFiles(provider);
    } else {
      toast.error(result.error || 'No se pudo eliminar');
    }
  }

  return (
    <div className="space-y-4">
      {PROVIDERS.map((provider) => {
        const connected = !!status[provider];
        const isBusy = !!busy[provider];
        const providerFiles = files[provider] ?? [];

        return (
          <div key={provider} className="border border-border rounded p-2 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium flex items-center gap-1.5">
                <Cloud size={13} />
                {CLOUD_PROVIDER_LABELS[provider]}
              </span>
              <span className={`text-[9px] px-1.5 py-0.5 rounded ${connected ? 'bg-accent text-white' : 'bg-panelLight text-textDim'}`}>
                {connected ? 'Conectado' : 'No conectado'}
              </span>
            </div>

            {!connected && (
              <>
                <input
                  type="text"
                  value={clientIdDrafts[provider] ?? ''}
                  onChange={(e) => setClientIdDrafts((s) => ({ ...s, [provider]: e.target.value }))}
                  placeholder="Client ID"
                  className="w-full bg-panel border border-border rounded text-[10px] px-1.5 py-1 font-mono"
                />
                {provider === 'googleDrive' && (
                  <input
                    type="text"
                    value={clientSecretDrafts[provider] ?? ''}
                    onChange={(e) => setClientSecretDrafts((s) => ({ ...s, [provider]: e.target.value }))}
                    placeholder="Client Secret (Google lo requiere)"
                    className="w-full bg-panel border border-border rounded text-[10px] px-1.5 py-1 font-mono"
                  />
                )}
                <div className="flex gap-1.5">
                  <button onClick={() => saveConfig(provider)} className="flex-1 text-[10px] bg-panelLight rounded py-1">
                    Guardar
                  </button>
                  <button
                    onClick={() => handleConnect(provider)}
                    disabled={isBusy || !configs[provider]?.clientId}
                    className="flex-1 text-[10px] bg-accent text-white rounded py-1 disabled:opacity-40"
                  >
                    {isBusy ? 'Conectando…' : 'Conectar'}
                  </button>
                </div>
                <p className="text-[9px] text-textDim">
                  Redirect URI a registrar en la app de {CLOUD_PROVIDER_LABELS[provider]}: <span className="font-mono break-all">{redirectUri}</span>
                </p>
              </>
            )}

            {connected && (
              <>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => handleUpload(provider)}
                    disabled={!project || isBusy}
                    className="flex-1 flex items-center justify-center gap-1 text-[10px] bg-panelLight rounded py-1 disabled:opacity-40"
                  >
                    <Upload size={11} /> Subir proyecto actual
                  </button>
                  <button onClick={() => refreshFiles(provider)} disabled={isBusy} className="text-[10px] bg-panelLight rounded px-2 disabled:opacity-40" title="Actualizar lista">
                    <RefreshCw size={11} />
                  </button>
                  <button onClick={() => disconnect(provider)} className="text-[10px] bg-panelLight rounded px-2 text-textDim hover:text-red-400" title="Desconectar">
                    Salir
                  </button>
                </div>

                {providerFiles.length === 0 ? (
                  <p className="text-[9px] text-textDim">Sin proyectos en la nube todavía.</p>
                ) : (
                  <div className="space-y-1">
                    {providerFiles.map((f) => (
                      <div key={f.id} className="flex items-center justify-between gap-1 text-[10px] bg-panel rounded px-1.5 py-1">
                        <span className="truncate flex-1">{f.name}</span>
                        <button onClick={() => handleDownload(provider, f.id)} className="text-textDim hover:text-text" title="Abrir">
                          <Download size={11} />
                        </button>
                        <button onClick={() => handleDelete(provider, f.id)} className="text-textDim hover:text-red-400" title="Eliminar">
                          <Trash2 size={11} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
