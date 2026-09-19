import { create } from 'zustand';
import { AnatomyView, SubjectKind } from '@/services/mannequin.service';
import { useUIStore } from './uiStore';

export interface ViewerRequest {
  nonce: number;
  kind?: SubjectKind;
  anatomy?: AnatomyView;
  /** Slowly orbit the camera around the model ("live model" mode). */
  autoRotate?: boolean;
  /** Pose preset id, e.g. 'contrapposto'. */
  pose?: string;
}

interface ViewerRequestStore {
  request: ViewerRequest | null;
  /** Opens the 3D reference window (if needed) and asks it to set up the given scene. */
  send: (req: Omit<ViewerRequest, 'nonce'>) => void;
}

/** Lets other panels (Study modes) configure the 3D reference window without owning its engine. */
export const useViewerRequestStore = create<ViewerRequestStore>((set, get) => ({
  request: null,
  send: (req) => {
    if (!useUIStore.getState().showReference3DPanel) useUIStore.getState().toggleReference3DPanel();
    set({ request: { ...req, nonce: (get().request?.nonce ?? 0) + 1 } });
  },
}));
