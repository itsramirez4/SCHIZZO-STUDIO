import { useState } from 'react';
import { LayoutGrid, Sun, Moon, MonitorSmartphone } from 'lucide-react';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { WORKSPACE_PRESETS } from '@/services/workspacePresets.service';
import { ThemeMode } from '@/types/workspace';

const THEME_ICONS: Record<ThemeMode, typeof Sun> = {
  light: Sun,
  dark: Moon,
  auto: MonitorSmartphone,
};

export default function PresetSwitcher() {
  const presetId = useWorkspaceStore((s) => s.presetId);
  const loadPreset = useWorkspaceStore((s) => s.loadPreset);
  const uiScale = useWorkspaceStore((s) => s.uiScale);
  const setUIScale = useWorkspaceStore((s) => s.setUIScale);
  const theme = useWorkspaceStore((s) => s.theme);
  const setTheme = useWorkspaceStore((s) => s.setTheme);
  const [open, setOpen] = useState(false);

  const ThemeIcon = THEME_ICONS[theme];

  return (
    <div className="absolute bottom-3 right-3 z-[1000] flex flex-col items-end gap-2">
      {open && (
        <div className="bg-panel border border-border rounded shadow-2xl w-64 max-h-96 overflow-y-auto">
          {WORKSPACE_PRESETS.map((preset, i) => (
            <button
              key={preset.id}
              onClick={() => {
                loadPreset(preset.id);
                setOpen(false);
              }}
              className={`w-full text-left px-3 py-2 border-b border-border last:border-b-0 hover:bg-panelLight ${
                presetId === preset.id ? 'bg-panelLight' : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-text">{preset.name}</span>
                <span className="text-[10px] text-textDim">Alt+{i + 1}</span>
              </div>
              <p className="text-[10px] text-textDim mt-0.5">{preset.description}</p>
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center gap-1.5 bg-panel border border-border rounded shadow-2xl p-1.5">
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : theme === 'light' ? 'auto' : 'dark')}
          title={`Tema: ${theme} (Ctrl+Shift+T)`}
          className="text-textDim hover:text-text w-7 h-7 flex items-center justify-center rounded hover:bg-panelLight"
        >
          <ThemeIcon size={14} />
        </button>
        <select
          value={uiScale}
          onChange={(e) => setUIScale(Number(e.target.value))}
          title="Escala de la interfaz (Ctrl+`)"
          className="bg-panelLight border border-border rounded text-[11px] px-1 py-1"
        >
          {[0.8, 0.9, 1, 1.1, 1.2, 1.5].map((s) => (
            <option key={s} value={s}>
              {Math.round(s * 100)}%
            </option>
          ))}
        </select>
        <button
          onClick={() => setOpen((o) => !o)}
          className={`flex items-center gap-1.5 text-xs px-2 py-1.5 rounded ${open ? 'bg-accent text-white' : 'bg-panelLight text-text hover:bg-border'}`}
        >
          <LayoutGrid size={13} /> Workspaces
        </button>
      </div>
    </div>
  );
}
