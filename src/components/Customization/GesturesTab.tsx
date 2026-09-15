import { DiscreteGestureType, GESTURE_LABELS } from '@/types/gestures';
import { SHORTCUT_DEFINITIONS } from '@/data/shortcutDefinitions';
import { useCustomizationStore } from '@/store/customizationStore';

const GESTURE_TYPES = Object.keys(GESTURE_LABELS) as DiscreteGestureType[];

export default function GesturesTab() {
  const gestureBindings = useCustomizationStore((s) => s.gestureBindings);
  const setGestureBinding = useCustomizationStore((s) => s.setGestureBinding);

  return (
    <div className="space-y-3">
      <p className="text-[9px] text-textDim">
        Requiere una pantalla táctil o tableta con soporte táctil — se detectan con la API nativa de Touch Events del
        navegador. El pellizco para hacer zoom (pinch-to-zoom) es un comportamiento fijo, no se puede reasignar. El giro
        (rotate) no está disponible: no hay una vista de lienzo rotable a la que conectarlo.
      </p>

      <div className="space-y-1">
        {GESTURE_TYPES.map((type) => (
          <div key={type} className="flex items-center justify-between gap-1.5 text-[10px] bg-panel rounded px-1.5 py-1">
            <span className="truncate flex-1">{GESTURE_LABELS[type]}</span>
            <select
              value={gestureBindings[type] ?? ''}
              onChange={(e) => setGestureBinding(type, e.target.value || null)}
              className="bg-panelLight border border-border rounded text-[10px] px-1 py-0.5 max-w-[140px]"
            >
              <option value="">Sin asignar</option>
              {SHORTCUT_DEFINITIONS.map((def) => (
                <option key={def.id} value={def.id}>
                  {def.label}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
    </div>
  );
}
