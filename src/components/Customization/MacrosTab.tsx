import { useState } from 'react';
import toast from 'react-hot-toast';
import { Circle, Play, Square, Trash2 } from 'lucide-react';
import { SHORTCUT_DEFINITIONS } from '@/data/shortcutDefinitions';
import { useCustomizationStore } from '@/store/customizationStore';

const LABEL_BY_ID = Object.fromEntries(SHORTCUT_DEFINITIONS.map((d) => [d.id, d.label]));

/**
 * Macros only record shortcut-triggerable actions (whatever `App.tsx`'s `actionMap` covers) — no
 * click/drag/pointer simulation, and no conditional branches. Playback dispatches through the
 * same `shortcutRuntimeStore` the live keyboard handler uses, so a played-back macro does exactly
 * what pressing those keys in that sequence would have done.
 */
export default function MacrosTab() {
  const macros = useCustomizationStore((s) => s.macros);
  const isRecording = useCustomizationStore((s) => s.isRecording);
  const recordingSteps = useCustomizationStore((s) => s.recordingSteps);
  const isPlaying = useCustomizationStore((s) => s.isPlaying);
  const playingMacroId = useCustomizationStore((s) => s.playingMacroId);
  const startRecording = useCustomizationStore((s) => s.startRecording);
  const stopRecording = useCustomizationStore((s) => s.stopRecording);
  const cancelRecording = useCustomizationStore((s) => s.cancelRecording);
  const deleteMacro = useCustomizationStore((s) => s.deleteMacro);
  const playMacro = useCustomizationStore((s) => s.playMacro);
  const stopPlayback = useCustomizationStore((s) => s.stopPlayback);

  const [name, setName] = useState('');
  const [speed, setSpeed] = useState(1);

  function handleStop() {
    const trimmed = name.trim() || `Macro ${macros.length + 1}`;
    stopRecording(trimmed);
    setName('');
    toast.success('Macro guardada');
  }

  return (
    <div className="space-y-3">
      <p className="text-[9px] text-textDim">
        Graba una secuencia de atajos (cambios de herramienta, deshacer, etc.) y reprodúcela después. No simula clics ni
        arrastres del mouse — solo acciones que también podrías disparar con el teclado.
      </p>

      <div className="border border-border rounded p-2 space-y-1.5">
        {!isRecording ? (
          <button onClick={startRecording} className="w-full flex items-center justify-center gap-1.5 text-[10px] bg-panelLight rounded py-1.5">
            <Circle size={11} className="text-red-400" fill="currentColor" /> Empezar a grabar
          </button>
        ) : (
          <>
            <p className="text-[10px] text-center">Grabando… {recordingSteps.length} paso(s)</p>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nombre de la macro"
              className="w-full bg-panel border border-border rounded text-[10px] px-1.5 py-1"
            />
            <div className="flex gap-1.5">
              <button onClick={handleStop} className="flex-1 text-[10px] bg-accent text-white rounded py-1">
                Guardar
              </button>
              <button onClick={cancelRecording} className="flex-1 text-[10px] bg-panelLight rounded py-1">
                Cancelar
              </button>
            </div>
          </>
        )}
      </div>

      <div className="flex items-center gap-2 text-[9px] text-textDim">
        <span>Velocidad de reproducción</span>
        <input
          type="range"
          min={0.25}
          max={3}
          step={0.25}
          value={speed}
          onChange={(e) => setSpeed(Number(e.target.value))}
          className="flex-1"
        />
        <span className="w-8 text-right">{speed}x</span>
      </div>

      {macros.length === 0 ? (
        <p className="text-[9px] text-textDim">Todavía no grabaste ninguna macro.</p>
      ) : (
        <div className="space-y-1.5">
          {macros.map((macro) => {
            const playingThis = isPlaying && playingMacroId === macro.id;
            return (
              <div key={macro.id} className="border border-border rounded p-2 space-y-1">
                <div className="flex items-center justify-between gap-1.5">
                  <span className="text-[11px] font-medium truncate">{macro.name}</span>
                  <div className="flex items-center gap-1 shrink-0">
                    {playingThis ? (
                      <button onClick={stopPlayback} title="Detener" className="text-textDim hover:text-text">
                        <Square size={11} />
                      </button>
                    ) : (
                      <button
                        onClick={() => playMacro(macro.id, speed)}
                        disabled={isPlaying}
                        title="Reproducir"
                        className="text-textDim hover:text-text disabled:opacity-40"
                      >
                        <Play size={11} />
                      </button>
                    )}
                    <button onClick={() => deleteMacro(macro.id)} title="Eliminar" className="text-textDim hover:text-red-400">
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>
                <p className="text-[9px] text-textDim truncate">
                  {macro.steps.map((s) => LABEL_BY_ID[s.actionId] ?? s.actionId).join(' → ')}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
