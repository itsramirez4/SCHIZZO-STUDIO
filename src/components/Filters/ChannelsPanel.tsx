import * as filterService from '@/services/filter.service';
import * as layerService from '@/services/layer.service';
import { useLayers } from '@/hooks/useLayers';
import { useAppStore } from '@/store/appStore';

const CHANNELS: { id: 'r' | 'g' | 'b' | 'a'; label: string }[] = [
  { id: 'r', label: 'Rojo' },
  { id: 'g', label: 'Verde' },
  { id: 'b', label: 'Azul' },
  { id: 'a', label: 'Alfa' },
];

export default function ChannelsPanel() {
  const { currentLayer } = useLayers();
  const pushHistory = useAppStore((s) => s.pushHistory);

  function apply(channel: 'r' | 'g' | 'b' | 'a') {
    if (!currentLayer) return;
    const canvas = layerService.getLayerCanvas(currentLayer.id);
    if (!canvas) return;
    filterService.isolateChannel(canvas, channel);
    pushHistory(`Ver canal ${channel.toUpperCase()}`);
  }

  return (
    <div className="mt-4 pt-3 border-t border-border">
      <div className="text-xs text-textDim font-medium mb-2">Canales</div>
      <p className="text-[11px] text-textDim mb-2">
        Convierte la capa en la vista en escala de grises de un canal — usa Deshacer para volver al color.
      </p>
      <div className="grid grid-cols-4 gap-1.5">
        {CHANNELS.map((c) => (
          <button
            key={c.id}
            onClick={() => apply(c.id)}
            disabled={!currentLayer}
            className="bg-panelLight text-xs rounded py-1.5 disabled:opacity-40"
          >
            {c.label}
          </button>
        ))}
      </div>
    </div>
  );
}
