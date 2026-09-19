import { useState } from 'react';
import toast from 'react-hot-toast';
import { useUIStore } from '@/store/uiStore';
import { useViewerRequestStore } from '@/store/viewerRequestStore';
import { useMirrorModeStore } from '@/store/mirrorModeStore';
import { usePoseSessionStore } from '@/store/poseSessionStore';
import { useAppStore } from '@/store/appStore';

/** One-click study setups that combine the app's existing tools. */
export default function ModesTab() {
  const ui = useUIStore();
  const project = useAppStore((s) => s.project);
  const viewer = useViewerRequestStore((s) => s.send);
  const mirror = useMirrorModeStore();
  const poses = usePoseSessionStore();
  const [interval, setIntervalSec] = useState(60);

  function artistTable() {
    if (!ui.showReferencesPanel) ui.toggleReferencesPanel();
    if (!ui.showColorToolsPanel) ui.toggleColorToolsPanel();
    if (!ui.showReference3DPanel) ui.toggleReference3DPanel();
    if (!ui.showLayerPanel) ui.toggleLayerPanel();
    viewer({ kind: 'human', pose: 'contrapposto' });
    toast.success('Mesa de artista: lienzo, referencias, paleta, modelo 3D y capas abiertos');
  }

  const Mode = ({ title, text, action, label, active }: { title: string; text: string; action: () => void; label: string; active?: boolean }) => (
    <div className="border border-border rounded p-2 space-y-1">
      <div className="text-[11px] font-medium">{title}</div>
      <p className="text-[10px] text-textDim leading-relaxed">{text}</p>
      <button onClick={action} className={`w-full text-[10px] rounded py-1 ${active ? 'bg-accent text-white' : 'bg-panelLight hover:bg-border'}`}>
        {label}
      </button>
    </div>
  );

  return (
    <div className="space-y-2">
      <p className="text-[10px] text-textDim">Atajos que preparan tu espacio de estudio con un clic.</p>
      <Mode
        title="Mesa de artista"
        text="Abre a la vez el lienzo, las referencias, la paleta de color, un modelo 3D flotante y las capas."
        action={artistTable}
        label="Abrir mesa de artista"
      />
      <Mode
        title="Modo modelo vivo"
        text="Un modelo 3D que gira lentamente a tu alrededor mientras dibujas; puedes pararlo con el botón ⟳ de la ventana."
        action={() => viewer({ kind: 'human', pose: 'contrapposto', autoRotate: true })}
        label="Iniciar modelo vivo"
      />
      <Mode
        title="Estudio de anatomía"
        text="Modelo 3D con piel semitransparente, músculos y esqueleto para entender qué hay bajo la forma."
        action={() => viewer({ kind: 'human', anatomy: { skin: 0.25, muscle: true, bone: true }, autoRotate: false })}
        label="Abrir estudio de anatomía"
      />
      <Mode
        title="Pose aleatoria"
        text="Una pose nueva cada 2 minutos en la ventana 3D, con temporizador (otras duraciones en Academia → Poses)."
        action={() => (poses.phase === 'off' ? poses.start('random', 120) : poses.stop())}
        label={poses.phase === 'off' ? 'Empezar' : 'Detener'}
        active={poses.phase !== 'off'}
      />

      <div className="border border-border rounded p-2 space-y-1">
        <div className="text-[11px] font-medium">Modo espejo automático</div>
        <p className="text-[10px] text-textDim leading-relaxed">Voltea el lienzo horizontalmente cada cierto tiempo para que los errores de proporción y simetría salten a la vista. Puedes seguir dibujando mientras está volteado.</p>
        <select value={interval} onChange={(e) => setIntervalSec(Number(e.target.value))} disabled={mirror.running} className="w-full bg-panel border border-border rounded text-[11px] px-1.5 py-1">
          {[[15, 'Cada 15 s'], [30, 'Cada 30 s'], [60, 'Cada minuto'], [120, 'Cada 2 minutos'], [300, 'Cada 5 minutos']].map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        <button
          onClick={() => {
            if (!project) return toast.error('Abre un proyecto primero');
            mirror.running ? mirror.stop() : mirror.start(interval);
          }}
          className={`w-full text-[10px] rounded py-1 ${mirror.running ? 'bg-accent text-white' : 'bg-panelLight hover:bg-border'}`}
        >
          {mirror.running ? 'Detener y volver a la vista normal' : 'Activar modo espejo'}
        </button>
      </div>
    </div>
  );
}
