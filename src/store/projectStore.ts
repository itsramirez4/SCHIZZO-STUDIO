import { create } from 'zustand';
import toast from 'react-hot-toast';
import * as fileService from '@/services/file.service';
import { useAppStore } from './appStore';

interface ProjectStoreState {
  recentProjects: string[];
  isSaving: boolean;
  isLoading: boolean;

  refreshRecent: () => Promise<void>;
  saveCurrentProject: () => Promise<void>;
  saveCurrentProjectAs: () => Promise<void>;
  openProjectDialog: () => Promise<void>;
  openProjectAtPath: (path: string) => Promise<void>;
}

export const useProjectStore = create<ProjectStoreState>((set, get) => ({
  recentProjects: [],
  isSaving: false,
  isLoading: false,

  refreshRecent: async () => {
    const recentProjects = await fileService.getRecentProjects();
    set({ recentProjects });
  },

  saveCurrentProject: async () => {
    const { project } = useAppStore.getState();
    if (!project) return;
    set({ isSaving: true });
    try {
      const result = await fileService.saveProject(project);
      if (!result.canceled) {
        toast.success('Proyecto guardado');
        if (result.filePath) {
          useAppStore.setState((s) =>
            s.project ? { project: { ...s.project, filePath: result.filePath } } : s
          );
        }
        get().refreshRecent();
      }
    } catch (err) {
      toast.error('No se pudo guardar el proyecto');
      console.error(err);
    } finally {
      set({ isSaving: false });
    }
  },

  saveCurrentProjectAs: async () => {
    const { project } = useAppStore.getState();
    if (!project) return;
    set({ isSaving: true });
    try {
      const result = await fileService.saveProjectAs(project);
      if (!result.canceled) {
        toast.success('Proyecto guardado');
        if (result.filePath) {
          useAppStore.setState((s) =>
            s.project ? { project: { ...s.project, filePath: result.filePath } } : s
          );
        }
        get().refreshRecent();
      }
    } catch (err) {
      toast.error('No se pudo guardar el proyecto');
      console.error(err);
    } finally {
      set({ isSaving: false });
    }
  },

  openProjectDialog: async () => {
    set({ isLoading: true });
    try {
      const result = await fileService.openProject();
      if (!result.canceled && result.project) {
        useAppStore.getState().loadProjectData(result.project);
        toast.success('Proyecto abierto');
        get().refreshRecent();
      }
    } catch (err) {
      toast.error('No se pudo abrir el proyecto');
      console.error(err);
    } finally {
      set({ isLoading: false });
    }
  },

  openProjectAtPath: async (path: string) => {
    set({ isLoading: true });
    try {
      const result = await fileService.openProjectAtPath(path);
      if (!result.canceled && result.project) {
        useAppStore.getState().loadProjectData(result.project);
        toast.success('Proyecto abierto');
      }
    } catch (err) {
      toast.error('No se pudo abrir el proyecto');
      console.error(err);
    } finally {
      set({ isLoading: false });
    }
  },
}));
