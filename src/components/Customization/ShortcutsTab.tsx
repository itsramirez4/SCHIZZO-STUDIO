import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { RotateCcw } from 'lucide-react';
import { SHORTCUT_DEFINITIONS } from '@/data/shortcutDefinitions';
import { comboFromEvent, effectiveCombo, findDefinitionForCombo, formatCombo } from '@/services/shortcutEngine.service';
import { useCustomizationStore } from '@/store/customizationStore';

const CATEGORY_ORDER = ['Herramientas', 'Pincel', 'Edición', 'Archivo', 'Vista'];

/**
 * Reassignment listens for exactly one keydown on `window` (capture phase, so it wins over the
 * app's own global shortcut handler) while `listeningFor` is set. Conflicts are resolved by
 * disabling whichever OTHER shortcut currently owns that combo — `findDefinitionForCombo` is the
 * same lookup the live keydown handler in App.tsx uses, so what this UI shows always matches what
 * actually fires.
 */
export default function ShortcutsTab() {
  const overrides = useCustomizationStore((s) => s.overrides);
  const setOverride = useCustomizationStore((s) => s.setOverride);
  const resetOverride = useCustomizationStore((s) => s.resetOverride);
  const resetAllOverrides = useCustomizationStore((s) => s.resetAllOverrides);

  const [listeningFor, setListeningFor] = useState<string | null>(null);

  useEffect(() => {
    if (!listeningFor) return;

    function onKeyDown(e: KeyboardEvent) {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === 'Escape') {
        setListeningFor(null);
        return;
      }
      if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return;

      const combo = comboFromEvent(e);
      const def = SHORTCUT_DEFINITIONS.find((d) => d.id === listeningFor)!;
      const conflict = findDefinitionForCombo(combo, SHORTCUT_DEFINITIONS, overrides, listeningFor ?? undefined);

      if (conflict) {
        setOverride(conflict.id, null);
        toast(`"${conflict.label}" quedó sin atajo (usaba ${formatCombo(combo)})`, { icon: '⚠️' });
      }
      setOverride(def.id, combo);
      toast.success(`${def.label} → ${formatCombo(combo)}`);
      setListeningFor(null);
    }

    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true });
  }, [listeningFor, overrides, setOverride]);

  const byCategory = CATEGORY_ORDER.map((category) => ({
    category,
    defs: SHORTCUT_DEFINITIONS.filter((d) => d.category === category),
  }));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[9px] text-textDim">Hacé clic en "Reasignar" y presioná la combinación deseada. Esc cancela.</p>
        <button onClick={resetAllOverrides} className="text-[9px] text-textDim hover:text-text flex items-center gap-1 shrink-0">
          <RotateCcw size={10} /> Restablecer todo
        </button>
      </div>

      {byCategory.map(({ category, defs }) => (
        <div key={category}>
          <h4 className="text-[10px] font-semibold text-textDim mb-1">{category}</h4>
          <div className="space-y-1">
            {defs.map((def) => {
              const combo = effectiveCombo(def, overrides);
              const isCustom = def.id in overrides;
              const isListening = listeningFor === def.id;
              return (
                <div key={def.id} className="flex items-center justify-between gap-1.5 text-[10px] bg-panel rounded px-1.5 py-1">
                  <span className="truncate flex-1">{def.label}</span>
                  {isCustom && (
                    <button onClick={() => resetOverride(def.id)} title="Restablecer" className="text-textDim hover:text-text">
                      <RotateCcw size={10} />
                    </button>
                  )}
                  <button
                    onClick={() => setListeningFor(isListening ? null : def.id)}
                    className={`min-w-[72px] text-center rounded px-1.5 py-0.5 font-mono ${
                      isListening ? 'bg-accent text-white' : combo ? 'bg-panelLight' : 'bg-panelLight text-textDim italic'
                    }`}
                  >
                    {isListening ? 'Presioná…' : combo ? formatCombo(combo) : 'Desactivado'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
