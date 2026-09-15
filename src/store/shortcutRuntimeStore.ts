import { create } from 'zustand';

/**
 * A live, non-persisted registry mapping shortcut action ids to the real callback that performs
 * them — registered once by App.tsx (the only place with direct access to every store action a
 * shortcut can trigger) and read from anywhere else that needs to actually fire an action by id:
 * the keydown handler itself, the macro player, and the shortcut-reassignment UI's "test it"
 * button. This is what keeps "record a macro" and "press a key" both real — they dispatch through
 * the exact same map, not two parallel implementations that could drift apart.
 */
interface ShortcutRuntimeStore {
  actionMap: Record<string, () => void>;
  registerActions: (map: Record<string, () => void>) => void;
  dispatch: (actionId: string) => void;
}

export const useShortcutRuntimeStore = create<ShortcutRuntimeStore>((set, get) => ({
  actionMap: {},
  registerActions: (map) => set({ actionMap: map }),
  dispatch: (actionId) => {
    get().actionMap[actionId]?.();
  },
}));
