import { useAppStore } from '@/store/appStore';
import { useProjectStore } from '@/store/projectStore';

export function useProject() {
  const project = useAppStore((s) => s.project);
  const newProject = useAppStore((s) => s.newProject);
  const loadProjectData = useAppStore((s) => s.loadProjectData);
  const { saveCurrentProject, saveCurrentProjectAs, openProjectDialog, isSaving, isLoading, recentProjects, refreshRecent } =
    useProjectStore();

  return {
    project,
    newProject,
    loadProjectData,
    save: saveCurrentProject,
    saveAs: saveCurrentProjectAs,
    open: openProjectDialog,
    isSaving,
    isLoading,
    recentProjects,
    refreshRecent,
  };
}
