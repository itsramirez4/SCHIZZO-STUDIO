import { useState } from 'react';
import { Model3DViewerEngine } from '@/services/model3d.service';
import NumberSlider from './NumberSlider';

/** Operates directly on the loaded model's real THREE.Bone objects (via the engine) rather
 * than a parallel bone/skeleton type — Three.js already re-renders every frame, so mutating
 * `bone.rotation` here is immediately reflected with no extra plumbing. FK only: correctly
 * implementing world-space IK (dragging an end effector toward a target through a bone chain)
 * needs real matrix-world math and a drag-target gizmo — a substantial addition on its own,
 * left out so this ships as a working, if more manual, posing tool rather than a broken one. */
export default function PoseEditor({ engine, modelVersion }: { engine: Model3DViewerEngine | null; modelVersion: number }) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [, setTick] = useState(0);

  if (!engine?.hasSkeleton()) return null;
  const bones = engine.getBoneList();
  const selected = bones[selectedIndex]?.bone ?? bones[0]?.bone;

  function setRotationDeg(axis: 'x' | 'y' | 'z', deg: number) {
    if (!selected) return;
    selected.rotation[axis] = (deg * Math.PI) / 180;
    setTick((n) => n + 1);
  }

  const toDeg = (rad: number) => Math.round((rad * 180) / Math.PI);

  return (
    <div className="space-y-1.5 border-t border-border pt-2 mt-2" key={modelVersion}>
      <div className="text-[10px] text-textDim uppercase tracking-wide">Pose ({bones.length} huesos)</div>
      <select
        value={selectedIndex}
        onChange={(e) => setSelectedIndex(Number(e.target.value))}
        className="w-full bg-panel border border-border rounded text-[10px] px-1 py-0.5"
      >
        {bones.map((b, i) => (
          <option key={b.bone.uuid} value={i}>
            {'  '.repeat(b.depth)}
            {b.bone.name || `Hueso ${i}`}
          </option>
        ))}
      </select>
      {selected && (
        <>
          <NumberSlider label="Rot X" value={toDeg(selected.rotation.x)} min={-180} max={180} onChange={(v) => setRotationDeg('x', v)} />
          <NumberSlider label="Rot Y" value={toDeg(selected.rotation.y)} min={-180} max={180} onChange={(v) => setRotationDeg('y', v)} />
          <NumberSlider label="Rot Z" value={toDeg(selected.rotation.z)} min={-180} max={180} onChange={(v) => setRotationDeg('z', v)} />
        </>
      )}
      <button
        onClick={() => {
          engine.resetPose();
          setTick((n) => n + 1);
        }}
        className="w-full bg-panelLight text-[10px] rounded py-1"
      >
        Restablecer pose
      </button>
    </div>
  );
}
