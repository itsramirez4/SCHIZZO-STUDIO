import { FilePlus, FolderOpen, Save, Download, Undo2, Redo2, ImagePlus, Boxes, View, Scaling, Crop, PackageOpen, LayoutGrid, History as HistoryIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import { useProject } from '@/hooks/useProject';
import { useHistory } from '@/hooks/useHistory';
import { useUIStore } from '@/store/uiStore';
import { useAppStore } from '@/store/appStore';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { useAutoSaveStore } from '@/store/autoSaveStore';
import { importImagesAsLayers } from '@/services/importImage';
import { importKraAsLayer } from '@/services/kraImport.service';

export default function Header() {
  const { project, save, open } = useProject();
  const { canUndo, canRedo, undo, redo } = useHistory();
  const openNewProjectDialog = useUIStore((s) => s.openNewProjectDialog);
  const openExportDialog = useUIStore((s) => s.openExportDialog);
  const openModel3DViewer = useUIStore((s) => s.openModel3DViewer);
  const toggleReference3DPanel = useUIStore((s) => s.toggleReference3DPanel);
  const showReference3DPanel = useUIStore((s) => s.showReference3DPanel);
  const openResizeDialog = useUIStore((s) => s.openResizeDialog);
  const trimToContent = useAppStore((s) => s.trimToContent);
  const pushHistory = useAppStore((s) => s.pushHistory);
  const addLayer = useAppStore((s) => s.addLayer);
  const setWorkspaceMode = useWorkspaceStore((s) => s.setMode);
  const openAutoSaveDialog = useAutoSaveStore((s) => s.openDialog);

  async function handleImport() {
    const layerId = await importImagesAsLayers(addLayer);
    if (layerId) pushHistory('Importar imagen');
  }

  async function handleImportKra() {
    try {
      const layerId = await importKraAsLayer(addLayer);
      if (layerId) pushHistory('Importar Krita');
    } catch (err) {
      toast.error('No se pudo importar el archivo .kra');
      console.error(err);
    }
  }

  function handleTrimToContent() {
    if (!trimToContent()) toast('Nada que recortar — el lienzo ya está ajustado al contenido');
  }

  return (
    <div className="h-11 bg-panel border-b border-border flex items-center px-2 gap-1">
      <span className="text-sm font-semibold px-2 text-accent">SCHIZZO STUDIO</span>
      <div className="w-px h-5 bg-border mx-1" />
      <button onClick={openNewProjectDialog} title="Nuevo proyecto (Ctrl+N)" className="icon-btn">
        <FilePlus size={16} />
      </button>
      <button onClick={open} title="Abrir proyecto (Ctrl+O)" className="icon-btn">
        <FolderOpen size={16} />
      </button>
      <button onClick={save} disabled={!project} title="Guardar (Ctrl+S)" className="icon-btn disabled:opacity-30">
        <Save size={16} />
      </button>
      <button onClick={openAutoSaveDialog} title="Copias de seguridad automáticas" className="icon-btn">
        <HistoryIcon size={16} />
      </button>
      <button onClick={handleImport} disabled={!project} title="Importar imagen" className="icon-btn disabled:opacity-30">
        <ImagePlus size={16} />
      </button>
      <button onClick={handleImportKra} disabled={!project} title="Importar Krita (.kra)" className="icon-btn disabled:opacity-30">
        <PackageOpen size={16} />
      </button>
      <button onClick={openModel3DViewer} disabled={!project} title="Insertar modelo 3D" className="icon-btn disabled:opacity-30">
        <Boxes size={16} />
      </button>
      <button
        onClick={toggleReference3DPanel}
        disabled={!project}
        title="Referencia 3D flotante"
        className={`icon-btn disabled:opacity-30 ${showReference3DPanel ? 'text-accent' : ''}`}
      >
        <View size={16} />
      </button>
      <button onClick={openResizeDialog} disabled={!project} title="Redimensionar (inteligente)" className="icon-btn disabled:opacity-30">
        <Scaling size={16} />
      </button>
      <button onClick={handleTrimToContent} disabled={!project} title="Recortar al contenido" className="icon-btn disabled:opacity-30">
        <Crop size={16} />
      </button>
      <button onClick={openExportDialog} disabled={!project} title="Exportar (Ctrl+E)" className="icon-btn disabled:opacity-30">
        <Download size={16} />
      </button>
      <button
        onClick={() => setWorkspaceMode('floating')}
        disabled={!project}
        title="Workspace flotante (paneles acoplables, presets)"
        className="icon-btn disabled:opacity-30"
      >
        <LayoutGrid size={16} />
      </button>
      <div className="w-px h-5 bg-border mx-1" />
      <button onClick={undo} disabled={!canUndo} title="Deshacer (Ctrl+Z)" className="icon-btn disabled:opacity-30">
        <Undo2 size={16} />
      </button>
      <button onClick={redo} disabled={!canRedo} title="Rehacer (Ctrl+Shift+Z)" className="icon-btn disabled:opacity-30">
        <Redo2 size={16} />
      </button>
      {project && <span className="ml-auto text-xs text-textDim pr-2">{project.name}</span>}
    </div>
  );
}
