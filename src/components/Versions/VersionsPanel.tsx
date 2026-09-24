import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { GitCompare, RotateCcw, Trash2 } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import * as layerService from '@/services/layer.service';
import { VersionMeta, deleteVersion, getBaseline, getVersionImage, listVersions, loadVersionProject, saveVersion } from '@/services/versionHistory.service';
import CompareDialog, { CompareSource } from './CompareDialog';

const fmt = (iso: string) => new Date(iso).toLocaleString(undefined, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

/** Saved versions of the project (survive closing the app) and before/after comparison. */
export default function VersionsPanel() {
  const { t } = useTranslation('panelsProject');
  const project = useAppStore((s) => s.project);
  const loadProjectData = useAppStore((s) => s.loadProjectData);
  const [versions, setVersions] = useState<VersionMeta[]>([]);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [sources, setSources] = useState<CompareSource[] | null>(null);
  const [pair, setPair] = useState<[string, string]>(['', '']);

  const refresh = useCallback(async () => {
    if (!project) return setVersions([]);
    try {
      setVersions(await listVersions(project.id));
    } catch {
      setVersions([]);
    }
  }, [project?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (!project) return <p className="p-3 text-[11px] text-textDim">{t('versions.openProjectHint')}</p>;

  async function save() {
    if (!project) return;
    setBusy(true);
    try {
      await saveVersion(project, { name: name.trim() || t('versions.defaultVersionName', { date: new Date().toLocaleString() }) });
      setName('');
      await refresh();
      toast.success(t('versions.savedToast'));
    } catch (e) {
      console.error(e);
      toast.error(t('versions.saveError'));
    } finally {
      setBusy(false);
    }
  }

  async function restore(v: VersionMeta) {
    if (!project || !window.confirm(t('versions.restoreConfirm', { name: v.name }))) return;
    setBusy(true);
    try {
      await saveVersion(project, { name: t('versions.beforeRestoreName', { name: v.name }), auto: true });
      loadProjectData(await loadVersionProject(v.id, project.filePath));
      await refresh();
      toast.success(t('versions.restoredToast', { name: v.name }));
    } catch (e) {
      console.error(e);
      toast.error(t('versions.restoreError'));
    } finally {
      setBusy(false);
    }
  }

  async function remove(v: VersionMeta) {
    if (!window.confirm(t('versions.deleteConfirm', { name: v.name }))) return;
    await deleteVersion(v.id);
    await refresh();
  }

  async function openCompare(preselect?: string) {
    if (!project) return;
    const list: CompareSource[] = [];
    const base = getBaseline(project.id);
    if (base) list.push({ id: 'baseline', label: t('versions.baselineLabel', { date: fmt(base.created) }), url: base.flat });
    list.push({ id: 'current', label: t('versions.currentLabel'), url: layerService.flattenLayers(project.layers, project.width, project.height).toDataURL('image/png') });
    for (const v of versions) {
      const url = await getVersionImage(v.id);
      if (url) list.push({ id: v.id, label: t('versions.versionLabel', { name: v.name, date: fmt(v.created) }), url });
    }
    const oldest = versions[versions.length - 1];
    const a = preselect ?? (oldest ? oldest.id : list[0].id);
    setPair([a, 'current']);
    setSources(list);
  }

  return (
    <div className="p-3 space-y-3">
      <div className="space-y-1.5">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && save()}
          placeholder={t('versions.namePlaceholder')}
          className="w-full bg-panel border border-border rounded px-2 py-1 text-[11px]"
        />
        <div className="flex gap-1.5">
          <button onClick={save} disabled={busy} className="flex-1 bg-accent text-white text-[11px] rounded py-1.5 disabled:opacity-50">
            {t('versions.saveVersion')}
          </button>
          <button onClick={() => openCompare()} className="flex items-center gap-1 bg-panelLight text-[11px] rounded px-2.5" title={t('versions.compareBeforeAfterTitle')}>
            <GitCompare size={13} /> {t('versions.compare')}
          </button>
        </div>
        <p className="text-[10px] text-textDim leading-relaxed">
          {t('versions.persistenceHint')}
        </p>
      </div>

      {versions.length === 0 && <p className="text-[11px] text-textDim">{t('versions.noneYet')}</p>}
      <div className="space-y-1.5">
        {versions.map((v) => (
          <div key={v.id} className="flex gap-2 border border-border rounded p-1.5">
            <img src={v.thumb} alt="" className="w-14 h-14 object-cover rounded bg-white shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-medium truncate" title={v.name}>{v.name}</div>
              <div className="text-[10px] text-textDim">{fmt(v.created)}{v.auto ? t('versions.autoSuffix') : ''}</div>
              <div className="flex gap-1 mt-1">
                <button onClick={() => restore(v)} disabled={busy} title={t('versions.restoreTitle')} className="flex items-center gap-1 text-[10px] bg-panelLight hover:bg-border rounded px-1.5 py-0.5">
                  <RotateCcw size={11} /> {t('versions.restore')}
                </button>
                <button onClick={() => openCompare(v.id)} title={t('versions.compareWithCurrentTitle')} className="text-[10px] bg-panelLight hover:bg-border rounded px-1.5 py-0.5">
                  {t('versions.compare')}
                </button>
                <button onClick={() => remove(v)} title={t('versions.deleteTitle')} className="text-textDim hover:text-red-400 ml-auto">
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {sources && <CompareDialog sources={sources} initialA={pair[0]} initialB={pair[1]} onClose={() => setSources(null)} />}
    </div>
  );
}
