import { FilePlus, FolderOpen, Save, Download, Undo2, Redo2, ImagePlus, Boxes, View, Scaling, Crop, PackageOpen, LayoutGrid, Hand, History as HistoryIcon, MessageCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import Logo from '@/components/UI/Logo';
import { useProject } from '@/hooks/useProject';
import { useHistory } from '@/hooks/useHistory';
import { useUIStore } from '@/store/uiStore';
import { useAppStore } from '@/store/appStore';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { useAutoSaveStore } from '@/store/autoSaveStore';
import { useAiStore } from '@/store/aiStore';
import { Sparkles } from 'lucide-react';
import { importImagesAsLayers } from '@/services/importImage';

/** A thin visual grouping for the header's icon clusters — a labelled Photoshop menu bar would be
 * more discoverable, but the app deliberately stays icon-first (see the "essence" decision); this
 * is the lighter-weight way of answering "where do I find X" without one. */
function Group({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center gap-0.5 px-1">{children}</div>;
}

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
  const openFeedbackDialog = useUIStore((s) => s.openFeedbackDialog);
  const aiEnabled = useAiStore((s) => s.enabled);
  const setAiEnabled = useAiStore((s) => s.setEnabled);
  const leftHanded = useUIStore((s) => s.leftHanded);
  const toggleLeftHanded = useUIStore((s) => s.toggleLeftHanded);

  async function handleImport() {
    const layerId = await importImagesAsLayers(addLayer);
    if (layerId) pushHistory('Importar imagen');
  }

  async function handleImportKra() {
    try {
      // jszip (this import's only real dependency) is a big chunk of the bundle for a rarely
      // used action — load it on demand instead of paying for it on every app start.
      const { importKraAsLayer } = await import('@/services/kraImport.service');
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
      <div className="flex items-center gap-2 px-2 shrink-0">
        <Logo size={26} />
        <span className="text-sm font-semibold text-accent hidden sm:inline">SCHIZZO STUDIO</span>
      </div>
      <div className="w-px h-5 bg-border mx-1" />

      <Group>
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
      </Group>
      <div className="w-px h-5 bg-border mx-1" />

      <Group>
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
      </Group>
      <div className="w-px h-5 bg-border mx-1" />

      <button
        onClick={openExportDialog}
        disabled={!project}
        title="Exportar (Ctrl+E)"
        className="flex items-center gap-1.5 px-2.5 h-7 rounded text-xs font-medium bg-accentSoft text-accent hover:bg-accent hover:text-white transition-colors disabled:opacity-30 disabled:hover:bg-accentSoft disabled:hover:text-accent"
      >
        <Download size={14} /> Exportar
      </button>
      <div className="w-px h-5 bg-border mx-1" />

      <Group>
        <button
          onClick={() => setWorkspaceMode('floating')}
          disabled={!project}
          title="Workspace flotante (paneles acoplables, presets)"
          className="icon-btn disabled:opacity-30"
        >
          <LayoutGrid size={16} />
        </button>
        <button
          onClick={toggleLeftHanded}
          title={leftHanded ? 'Modo zurdo activado: volver al diseño normal' : 'Modo zurdo: herramientas a la derecha y paneles a la izquierda'}
          className={`icon-btn ${leftHanded ? 'text-accent' : ''}`}
        >
          <Hand size={16} />
        </button>
      </Group>

      <button
        onClick={() => {
          setAiEnabled(!aiEnabled);
          toast(aiEnabled ? 'IA desactivada: la app es 100 % manual (sin asistente, sin modelos, sin conexiones).' : 'IA activada: el asistente propone, tú decides.', { icon: aiEnabled ? '✋' : '✨' });
        }}
        title={aiEnabled ? 'IA activada — clic para desactivarla por completo (modo 100 % manual)' : 'IA desactivada (100 % manual) — clic para activarla'}
        className={`icon-btn relative ${aiEnabled ? 'text-accent' : 'text-textDim'}`}
        data-ai-toggle={aiEnabled ? 'on' : 'off'}
      >
        <Sparkles size={16} />
        {!aiEnabled && <span className="absolute inset-0 flex items-center justify-center pointer-events-none"><span className="w-5 h-px bg-textDim rotate-45" /></span>}
      </button>

      <div className="ml-auto flex items-center">
        <Group>
          <button onClick={undo} disabled={!canUndo} title="Deshacer (Ctrl+Z)" className="icon-btn disabled:opacity-30">
            <Undo2 size={16} />
          </button>
          <button onClick={redo} disabled={!canRedo} title="Rehacer (Ctrl+Shift+Z)" className="icon-btn disabled:opacity-30">
            <Redo2 size={16} />
          </button>
        </Group>
        <div className="w-px h-5 bg-border mx-1" />
        <button onClick={openFeedbackDialog} title="Enviar comentario — ¿algo no va bien, o se te ocurre algo?" className="icon-btn">
          <MessageCircle size={16} />
        </button>
        {project && <span className="text-xs text-textDim pr-2 pl-2 border-l border-border ml-1">{project.name}</span>}
      </div>
    </div>
  );
}
