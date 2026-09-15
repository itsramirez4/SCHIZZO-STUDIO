import { useAppStore } from '@/store/appStore';

export default function OnionSkinSettingsPanel() {
  const settings = useAppStore((s) => s.onionSkinSettings);
  const setOnionSkinSettings = useAppStore((s) => s.setOnionSkinSettings);

  return (
    <div className="border border-border rounded p-2 mb-2 space-y-1.5">
      <div className="grid grid-cols-2 gap-2">
        <label className="flex items-center justify-between text-[10px] text-textDim gap-1">
          Frames atrás
          <input
            type="number"
            min={0}
            max={5}
            value={settings.framesBack}
            onChange={(e) => setOnionSkinSettings({ framesBack: Math.max(0, Math.min(5, Number(e.target.value))) })}
            className="w-10 bg-panel border border-border rounded px-1 py-0.5"
          />
        </label>
        <label className="flex items-center justify-between text-[10px] text-textDim gap-1">
          Frames adelante
          <input
            type="number"
            min={0}
            max={5}
            value={settings.framesForward}
            onChange={(e) => setOnionSkinSettings({ framesForward: Math.max(0, Math.min(5, Number(e.target.value))) })}
            className="w-10 bg-panel border border-border rounded px-1 py-0.5"
          />
        </label>
      </div>
      <div>
        <div className="flex justify-between text-[10px] text-textDim mb-0.5">
          <span>Opacidad</span>
          <span>{Math.round(settings.opacityBack * 100)}%</span>
        </div>
        <input
          type="range"
          min={5}
          max={80}
          value={Math.round(settings.opacityBack * 100)}
          onChange={(e) => {
            const v = Number(e.target.value) / 100;
            setOnionSkinSettings({ opacityBack: v, opacityForward: v * 0.6 });
          }}
          className="w-full"
        />
      </div>
      <label className="flex items-center gap-1.5 text-[10px] text-textDim">
        <input type="checkbox" checked={settings.tint} onChange={(e) => setOnionSkinSettings({ tint: e.target.checked })} />
        Teñir (rojo = atrás, azul = adelante)
      </label>
    </div>
  );
}
