import { useEffect } from 'react';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { WORKSPACE_PRESETS } from '@/services/workspacePresets.service';

const SCALE_STEPS = [0.8, 0.9, 1, 1.1, 1.2, 1.5];

export function useWorkspaceShortcuts() {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;

      const { loadPreset, uiScale, setUIScale, theme, setTheme } = useWorkspaceStore.getState();

      if (e.altKey && e.key >= '1' && e.key <= '6') {
        const preset = WORKSPACE_PRESETS[Number(e.key) - 1];
        if (preset) {
          e.preventDefault();
          loadPreset(preset.id);
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === '`') {
        e.preventDefault();
        const idx = SCALE_STEPS.indexOf(uiScale);
        setUIScale(SCALE_STEPS[(idx + 1 + SCALE_STEPS.length) % SCALE_STEPS.length] ?? 1);
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 't') {
        e.preventDefault();
        setTheme(theme === 'dark' ? 'light' : theme === 'light' ? 'auto' : 'dark');
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
