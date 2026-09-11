import { useEffect } from 'react';
import { FilePlus, FolderOpen } from 'lucide-react';
import { useUIStore } from '@/store/uiStore';
import { useProject } from '@/hooks/useProject';
import { useProjectStore } from '@/store/projectStore';
import { isElectron } from '@/utils/fileUtils';

export default function StartScreen() {
  const openNewProjectDialog = useUIStore((s) => s.openNewProjectDialog);
  const { open, recentProjects, refreshRecent } = useProject();

  useEffect(() => {
    refreshRecent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6">
      <h1 className="text-3xl font-bold text-accent">SCHIZZO STUDIO</h1>
      <p className="text-textDim text-sm">Dibujo digital y pixel art, sin límites.</p>

      <div className="flex gap-3">
        <button
          onClick={openNewProjectDialog}
          className="flex items-center gap-2 bg-accent text-white px-4 py-2 rounded"
        >
          <FilePlus size={16} /> Nuevo proyecto
        </button>
        {isElectron() && (
          <button
            onClick={open}
            className="flex items-center gap-2 bg-panelLight text-text px-4 py-2 rounded"
          >
            <FolderOpen size={16} /> Abrir proyecto
          </button>
        )}
      </div>

      {recentProjects.length > 0 && (
        <div className="w-96">
          <h2 className="text-xs text-textDim uppercase tracking-wide mb-2">Recientes</h2>
          <ul className="space-y-1">
            {recentProjects.slice(0, 6).map((path) => (
              <RecentItem key={path} path={path} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function RecentItem({ path }: { path: string }) {
  const openProjectAtPath = useProjectStore((s) => s.openProjectAtPath);
  const name = path.split(/[\\/]/).pop();
  return (
    <li>
      <button
        onClick={() => openProjectAtPath(path)}
        className="w-full text-left text-xs text-textDim hover:text-text bg-panelLight rounded px-2 py-1.5 truncate"
        title={path}
      >
        {name}
      </button>
    </li>
  );
}
