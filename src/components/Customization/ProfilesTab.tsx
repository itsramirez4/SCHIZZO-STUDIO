import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Cloud, Download, Trash2, Upload } from 'lucide-react';
import { allProfiles, useCustomizationStore } from '@/store/customizationStore';
import { useCloudSyncStore } from '@/store/cloudSyncStore';
import { PANEL_ID_LABELS } from '@/data/panelIds';
import { isElectron, sanitizeFilename } from '@/utils/fileUtils';
import { CloudProvider, CLOUD_PROVIDER_LABELS, CloudFileMeta } from '@/types/cloudSync';
import { deleteProfileFromCloud, downloadProfileJsonFromCloud, listCloudProfiles, uploadProfileToCloud } from '@/services/cloudProfileSync.service';

export default function ProfilesTab() {
  const customProfiles = useCustomizationStore((s) => s.customProfiles);
  const activeProfileId = useCustomizationStore((s) => s.activeProfileId);
  const applyProfile = useCustomizationStore((s) => s.applyProfile);
  const saveCurrentAsProfile = useCustomizationStore((s) => s.saveCurrentAsProfile);
  const deleteProfile = useCustomizationStore((s) => s.deleteProfile);
  const exportProfile = useCustomizationStore((s) => s.exportProfile);
  const importProfile = useCustomizationStore((s) => s.importProfile);

  const cloudLoadAll = useCloudSyncStore((s) => s.loadAll);
  const cloudStatus = useCloudSyncStore((s) => s.status);

  const [newName, setNewName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [cloudProvider, setCloudProvider] = useState<CloudProvider | ''>('');
  const [cloudFiles, setCloudFiles] = useState<CloudFileMeta[]>([]);
  const [cloudBusy, setCloudBusy] = useState(false);

  const profiles = allProfiles({ customProfiles });
  const connectedProviders = (Object.keys(cloudStatus) as CloudProvider[]).filter((p) => cloudStatus[p]);

  useEffect(() => {
    cloudLoadAll();
  }, [cloudLoadAll]);

  async function refreshCloudList(provider: CloudProvider) {
    setCloudBusy(true);
    try {
      const result = await listCloudProfiles(provider);
      setCloudFiles(result.files as CloudFileMeta[]);
    } finally {
      setCloudBusy(false);
    }
  }

  function handleSelectCloudProvider(provider: CloudProvider | '') {
    setCloudProvider(provider);
    setCloudFiles([]);
    if (provider) refreshCloudList(provider);
  }

  async function handleUploadToCloud(profile: (typeof profiles)[number]) {
    if (!cloudProvider) return;
    const result = await uploadProfileToCloud(cloudProvider, profile);
    if (result.ok) {
      toast.success('Perfil subido a la nube');
      refreshCloudList(cloudProvider);
    } else {
      toast.error(result.error || 'No se pudo subir');
    }
  }

  async function handleDownloadFromCloud(file: CloudFileMeta) {
    if (!cloudProvider) return;
    const result = await downloadProfileJsonFromCloud(cloudProvider, file.id);
    if (result.ok && result.json) {
      const imported = importProfile(result.json);
      if (imported.ok) toast.success('Perfil importado desde la nube');
      else toast.error(imported.error || 'Archivo de perfil inválido');
    } else {
      toast.error(result.error || 'No se pudo descargar');
    }
  }

  async function handleDeleteFromCloud(file: CloudFileMeta) {
    if (!cloudProvider) return;
    const result = await deleteProfileFromCloud(cloudProvider, file.id);
    if (result.ok) {
      toast.success('Eliminado de la nube');
      refreshCloudList(cloudProvider);
    } else {
      toast.error(result.error || 'No se pudo eliminar');
    }
  }

  async function handleExport(profileId: string, profileName: string) {
    const json = exportProfile(profileId);
    const filename = sanitizeFilename(profileName);
    if (isElectron()) {
      const base64 = btoa(unescape(encodeURIComponent(json)));
      await window.electronAPI.exportImage(`data:text/plain;base64,${base64}`, 'json', filename);
    } else {
      const blob = new Blob([json], { type: 'application/json' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${filename}.json`;
      link.click();
    }
  }

  function handleImportClick() {
    fileInputRef.current?.click();
  }

  function handleFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = importProfile(String(reader.result ?? ''));
      if (result.ok) toast.success('Perfil importado');
      else toast.error(result.error || 'No se pudo importar');
    };
    reader.readAsText(file);
  }

  function handleSaveCurrent() {
    const name = newName.trim();
    if (!name) return;
    saveCurrentAsProfile(name);
    setNewName('');
    toast.success('Perfil guardado');
  }

  return (
    <div className="space-y-3">
      <p className="text-[9px] text-textDim">
        Cada perfil aplica sus propios paneles visibles y tamaño/opacidad de pincel por defecto. Los perfiles de fábrica
        comparten los mismos atajos — personalizalos desde la pestaña "Atajos" si querés diferencias por perfil.
      </p>

      <div className="space-y-1.5">
        {profiles.map((profile) => (
          <div key={profile.id} className="border border-border rounded p-2 space-y-1.5">
            <div className="flex items-center justify-between gap-1.5">
              <span className="text-[11px] font-medium truncate">
                {profile.name} {profile.id === activeProfileId && <span className="text-accent">●</span>}
              </span>
              <div className="flex items-center gap-1 shrink-0">
                {cloudProvider && (
                  <button onClick={() => handleUploadToCloud(profile)} title={`Subir a ${CLOUD_PROVIDER_LABELS[cloudProvider]}`} className="text-textDim hover:text-text">
                    <Cloud size={11} />
                  </button>
                )}
                <button onClick={() => handleExport(profile.id, profile.name)} title="Exportar" className="text-textDim hover:text-text">
                  <Download size={11} />
                </button>
                {!profile.builtIn && (
                  <button onClick={() => deleteProfile(profile.id)} title="Eliminar" className="text-textDim hover:text-red-400">
                    <Trash2 size={11} />
                  </button>
                )}
              </div>
            </div>
            <p className="text-[9px] text-textDim truncate">
              Pincel {profile.defaultBrushSize}px · Opacidad {Math.round(profile.defaultOpacity * 100)}% ·{' '}
              {profile.visiblePanels.map((id) => PANEL_ID_LABELS[id] ?? id).join(', ') || 'sin paneles fijos'}
            </p>
            <button
              onClick={() => applyProfile(profile.id)}
              disabled={profile.id === activeProfileId}
              className="w-full text-[10px] bg-accent text-white rounded py-1 disabled:opacity-40"
            >
              {profile.id === activeProfileId ? 'Activo' : 'Aplicar'}
            </button>
          </div>
        ))}
      </div>

      <div className="border-t border-border pt-2 space-y-1.5">
        <div className="flex gap-1.5">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nombre del nuevo perfil"
            className="flex-1 bg-panel border border-border rounded text-[10px] px-1.5 py-1"
          />
          <button onClick={handleSaveCurrent} disabled={!newName.trim()} className="text-[10px] bg-panelLight rounded px-2 disabled:opacity-40">
            Guardar actual
          </button>
        </div>
        <button onClick={handleImportClick} className="w-full flex items-center justify-center gap-1 text-[10px] bg-panelLight rounded py-1">
          <Upload size={11} /> Importar perfil (.json)
        </button>
        <input ref={fileInputRef} type="file" accept="application/json" className="hidden" onChange={handleFileChosen} />
      </div>

      {isElectron() && (
        <div className="border-t border-border pt-2 space-y-1.5">
          <h4 className="text-[10px] font-semibold text-textDim flex items-center gap-1">
            <Cloud size={11} /> Sincronizar con la nube
          </h4>
          {connectedProviders.length === 0 ? (
            <p className="text-[9px] text-textDim">
              No hay ninguna cuenta conectada. Conectá Dropbox, Google Drive o OneDrive desde la pestaña "Nube" para
              sincronizar perfiles.
            </p>
          ) : (
            <>
              <select
                value={cloudProvider}
                onChange={(e) => handleSelectCloudProvider(e.target.value as CloudProvider | '')}
                className="w-full bg-panel border border-border rounded text-[10px] px-1.5 py-1"
              >
                <option value="">Elegí una cuenta conectada…</option>
                {connectedProviders.map((p) => (
                  <option key={p} value={p}>
                    {CLOUD_PROVIDER_LABELS[p]}
                  </option>
                ))}
              </select>

              {cloudProvider && (
                <div className="space-y-1">
                  {cloudBusy ? (
                    <p className="text-[9px] text-textDim">Cargando…</p>
                  ) : cloudFiles.length === 0 ? (
                    <p className="text-[9px] text-textDim">Sin perfiles en la nube todavía. Usá el ícono de nube junto a un perfil para subirlo.</p>
                  ) : (
                    cloudFiles.map((f) => (
                      <div key={f.id} className="flex items-center justify-between gap-1 text-[10px] bg-panel rounded px-1.5 py-1">
                        <span className="truncate flex-1">{f.name.replace(/\.schizzoprofile\.json$/, '')}</span>
                        <button onClick={() => handleDownloadFromCloud(f)} className="text-textDim hover:text-text" title="Importar">
                          <Download size={11} />
                        </button>
                        <button onClick={() => handleDeleteFromCloud(f)} className="text-textDim hover:text-red-400" title="Eliminar de la nube">
                          <Trash2 size={11} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
