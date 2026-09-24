import { useEffect } from 'react';
import { FilePlus, FolderOpen, History, Clock, LucideIcon, MessageCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useUIStore } from '@/store/uiStore';
import { useProject } from '@/hooks/useProject';
import { useProjectStore } from '@/store/projectStore';
import { useAutoSaveStore } from '@/store/autoSaveStore';
import { isElectron } from '@/utils/fileUtils';
import Logo from '@/components/UI/Logo';

interface ActionCard {
  title: string;
  description: string;
  icon: LucideIcon;
  accent: string;
  onClick: () => void;
}

export default function StartScreen() {
  const { t } = useTranslation('chrome');
  const openNewProjectDialog = useUIStore((s) => s.openNewProjectDialog);
  const { open, recentProjects, refreshRecent } = useProject();
  const openAutoSaveDialog = useAutoSaveStore((s) => s.openDialog);
  const openFeedbackDialog = useUIStore((s) => s.openFeedbackDialog);

  useEffect(() => {
    refreshRecent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const actions: ActionCard[] = [
    {
      title: t('startScreen.newProjectTitle'),
      description: t('startScreen.newProjectDesc'),
      icon: FilePlus,
      accent: 'border-t-pink-400',
      onClick: openNewProjectDialog,
    },
    ...(isElectron()
      ? [
          {
            title: t('startScreen.openProjectTitle'),
            description: t('startScreen.openProjectDesc'),
            icon: FolderOpen,
            accent: 'border-t-blue-400',
            onClick: open,
          },
          {
            title: t('startScreen.recoverBackupTitle'),
            description: t('startScreen.recoverBackupDesc'),
            icon: History,
            accent: 'border-t-amber-400',
            onClick: openAutoSaveDialog,
          },
        ]
      : []),
  ];

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-8 overflow-y-auto py-10 px-4">
      <div className="text-center">
        <Logo size={112} className="mx-auto mb-3" />
        <h1 className="text-4xl font-bold text-accent mb-2">SCHIZZO STUDIO</h1>
        <p className="text-textDim text-sm">{t('startScreen.tagline')}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-3xl">
        {actions.map(({ title, description, icon: Icon, accent, onClick }) => (
          <button
            key={title}
            onClick={onClick}
            className={`text-left bg-panel border border-border border-t-4 ${accent} rounded-lg p-4 hover:bg-panelLight transition-colors`}
          >
            <Icon size={20} className="text-accent mb-3" />
            <h3 className="text-sm font-semibold mb-1">{title}</h3>
            <p className="text-xs text-textDim leading-snug">{description}</p>
          </button>
        ))}
      </div>

      {recentProjects.length > 0 && (
        <div className="w-full max-w-3xl">
          <h2 className="text-xs text-textDim uppercase tracking-wide mb-2">{t('startScreen.continueHeading')}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {recentProjects.slice(0, 6).map((path) => (
              <RecentItem key={path} path={path} />
            ))}
          </div>
        </div>
      )}

      <button onClick={openFeedbackDialog} className="flex items-center gap-1.5 text-[11px] text-textDim hover:text-text">
        <MessageCircle size={12} /> {t('startScreen.feedbackLink')}
      </button>
    </div>
  );
}

function RecentItem({ path }: { path: string }) {
  const openProjectAtPath = useProjectStore((s) => s.openProjectAtPath);
  const name = path.split(/[\\/]/).pop();
  return (
    <button
      onClick={() => openProjectAtPath(path)}
      title={path}
      className="flex items-center gap-2 text-left text-xs text-textDim hover:text-text bg-panelLight hover:bg-panel border border-border rounded px-3 py-2 truncate transition-colors"
    >
      <Clock size={13} className="shrink-0 opacity-70" />
      <span className="truncate">{name}</span>
    </button>
  );
}
