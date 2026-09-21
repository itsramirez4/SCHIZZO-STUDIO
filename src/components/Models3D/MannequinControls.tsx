import { useState } from 'react';
import { Model3DViewerEngine } from '@/services/model3d.service';
import {
  BODY_TYPES,
  BodyTypeId,
  EXPRESSION_PRESETS,
  Expression,
  FINGER_NAMES,
  FOOT_PRESETS,
  TOE_NAMES,
  SUBJECT_LABELS,
  HAND_PRESETS,
  AnatomyView,
  DEFAULT_ANATOMY,
  Outfit,
  PROP_CATALOG,
  PropKind,
  RigState,
  SubjectKind,
  Vec3Deg,
  defaultRigState,
  getPoses,
  randomPose,
} from '@/services/mannequin.service';
import NumberSlider from './NumberSlider';
import PoseLibrary from './PoseLibrary';

const SUBJECTS: { id: SubjectKind | 'none'; label: string }[] = [
  { id: 'none', label: 'Sin maniquí' },
  ...(Object.keys(SUBJECT_LABELS) as SubjectKind[]).map((id) => ({ id, label: SUBJECT_LABELS[id] })),
];

const OUTFIT_LABELS: Record<keyof Outfit, string> = {
  shirt: 'Camiseta',
  jacket: 'Chaqueta',
  tie: 'Corbata',
  scarf: 'Bufanda',
  pants: 'Pantalón',
  shorts: 'Pantalón corto',
  skirt: 'Falda',
  belt: 'Cinturón',
  shoes: 'Zapatos',
  boots: 'Botas',
  gloves: 'Guantes',
  hat: 'Sombrero',
  cap: 'Gorra',
  helmet: 'Casco',
  glasses: 'Gafas',
  backpack: 'Mochila',
  cape: 'Capa',
};

const AXES = ['X', 'Y', 'Z'] as const;

interface Props {
  engine: Model3DViewerEngine | null;
  /** Called whenever the scene contents change (mannequin/props added or removed). */
  onSceneChange: () => void;
}

/** Swaps left/right joints and mirrors the Y/Z axes, giving the mirror image of a pose. */
function mirrorPose(pose: Record<string, Vec3Deg>): Record<string, Vec3Deg> {
  const out: Record<string, Vec3Deg> = {};
  for (const [name, v] of Object.entries(pose)) {
    const swap = /(L|R)$/.test(name) && !/^(hips|spine|chest|neck|head|pelvis|tail\d)$/.test(name);
    let target = name;
    if (swap) target = name.slice(0, -1) + (name.endsWith('L') ? 'R' : 'L');
    else if (/^[a-z]+(FL|FR|BL|BR)$/.test(name)) target = name.slice(0, -1) + (name.endsWith('L') ? 'R' : 'L');
    out[target] = [v[0], -v[1], -v[2]];
  }
  return out;
}

export default function MannequinControls({ engine, onSceneChange }: Props) {
  const [, setTick] = useState(0);
  const refresh = () => setTick((n) => n + 1);
  const rig = engine?.getRig() ?? null;
  const state = rig?.state ?? null;
  const [jointName, setJointName] = useState('head');
  const [handSide, setHandSide] = useState<'L' | 'R'>('R');
  const [footSide, setFootSide] = useState<'L' | 'R'>('R');
  const [propId, setPropId] = useState<number | null>(null);

  if (!engine) return null;
  const eng = engine;

  function setSubject(id: SubjectKind | 'none') {
    if (id === 'none') {
      eng.setRigState(null);
    } else {
      const prev = eng.getRig()?.state;
      const next = defaultRigState(id);
      if (prev && prev.kind === id) Object.assign(next, prev);
      else if (prev) next.outfit = prev.outfit;
      eng.setRigState(next);
      setJointName(id === 'human' ? 'head' : 'neck');
    }
    onSceneChange();
    refresh();
  }

  function patchState(patch: Partial<RigState>) {
    if (!state) return;
    eng.setRigState({ ...state, ...patch });
    refresh();
  }

  const joints = rig?.jointInfos() ?? [];
  const joint = joints.find((j) => j.name === jointName) ?? joints[0];
  const rot: Vec3Deg = (joint && state?.pose[joint.name]) || [0, 0, 0];

  const props = eng.getProps();
  const selectedProp = props.find((p) => p.id === propId) ?? null;

  return (
    <div className="space-y-2 border-t border-border pt-2 mt-2">
      <div className="text-[10px] text-textDim uppercase tracking-wide">Maniquí de referencia</div>
      <select
        value={state?.kind ?? 'none'}
        onChange={(e) => setSubject(e.target.value as SubjectKind | 'none')}
        className="w-full bg-panel border border-border rounded text-[10px] px-1 py-0.5"
      >
        {SUBJECTS.map((s) => (
          <option key={s.id} value={s.id}>
            {s.label}
          </option>
        ))}
      </select>

      {state && rig && (
        <>
          {state.kind === 'human' && (
            <select
              value={state.bodyType}
              onChange={(e) => patchState({ bodyType: e.target.value as BodyTypeId })}
              className="w-full bg-panel border border-border rounded text-[10px] px-1 py-0.5"
            >
              {(Object.keys(BODY_TYPES) as BodyTypeId[]).map((id) => (
                <option key={id} value={id}>
                  {BODY_TYPES[id].label}
                </option>
              ))}
            </select>
          )}

          <div className="flex gap-1">
            <select
              value=""
              onChange={(e) => {
                const def = getPoses(state.kind).find((p) => p.id === e.target.value);
                if (def) {
                  rig.setPose(def.pose);
                  refresh();
                }
              }}
              className="flex-1 bg-panel border border-border rounded text-[10px] px-1 py-0.5"
            >
              <option value="">Pose predefinida…</option>
              {getPoses(state.kind).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
            <button
              onClick={() => {
                rig.setPose(randomPose(state.kind));
                refresh();
              }}
              className="bg-panelLight text-[10px] rounded px-2"
              title="Pose aleatoria plausible (respeta los límites de cada articulación)"
            >
              🎲
            </button>
            <button
              onClick={() => {
                rig.setPose(mirrorPose(state.pose));
                refresh();
              }}
              className="bg-panelLight text-[10px] rounded px-2"
              title="Espejar la pose (izquierda ↔ derecha)"
            >
              ⇋
            </button>
          </div>

          <PoseLibrary engine={eng} onSceneChange={onSceneChange} refresh={refresh} />

          {joint && (
            <div className="space-y-1">
              <select
                value={joint.name}
                onChange={(e) => {
                  setJointName(e.target.value);
                  rig.highlightJoint(e.target.value);
                  refresh();
                }}
                onFocus={() => rig.highlightJoint(joint.name)}
                onBlur={() => rig.highlightJoint(null)}
                className="w-full bg-panel border border-border rounded text-[10px] px-1 py-0.5"
              >
                {joints.map((j) => (
                  <option key={j.name} value={j.name}>
                    {j.label}
                  </option>
                ))}
              </select>
              {joint.limits.map(([lo, hi], axis) =>
                lo === hi ? null : (
                  <NumberSlider
                    key={`${joint.name}-${axis}`}
                    label={`Rot ${AXES[axis]}`}
                    value={Math.round(rot[axis])}
                    min={lo}
                    max={hi}
                    onChange={(v) => {
                      rig.setJoint(joint.name, axis as 0 | 1 | 2, v);
                      refresh();
                    }}
                  />
                )
              )}
              <p className="text-[9px] text-textDim">Los rangos son los de una articulación real: no permiten poses imposibles.</p>
            </div>
          )}

          {state.kind === 'human' && (
            <>
              <div className="border-t border-border pt-2 space-y-1">
                <div className="text-[10px] text-textDim uppercase tracking-wide">Manos</div>
                <div className="flex gap-1">
                  {(['L', 'R'] as const).map((side) => (
                    <button
                      key={side}
                      onClick={() => setHandSide(side)}
                      className={`flex-1 text-[10px] rounded py-0.5 ${handSide === side ? 'bg-accent text-white' : 'bg-panelLight text-textDim'}`}
                    >
                      {side === 'L' ? 'Izquierda' : 'Derecha'}
                    </button>
                  ))}
                </div>
                <select
                  value=""
                  onChange={(e) => {
                    const preset = HAND_PRESETS.find((h) => h.id === e.target.value);
                    if (preset) {
                      rig.setHand(handSide, preset.curls);
                      refresh();
                    }
                  }}
                  className="w-full bg-panel border border-border rounded text-[10px] px-1 py-0.5"
                >
                  <option value="">Posición de la mano…</option>
                  {HAND_PRESETS.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.label}
                    </option>
                  ))}
                </select>
                {FINGER_NAMES.map((name, f) => (
                  <NumberSlider
                    key={name}
                    label={name}
                    value={Math.round(state.hands[handSide][f] * 100)}
                    min={0}
                    max={100}
                    onChange={(v) => {
                      const curls = [...state.hands[handSide]];
                      curls[f] = v / 100;
                      rig.setHand(handSide, curls);
                      refresh();
                    }}
                  />
                ))}
              </div>

              <div className="border-t border-border pt-2 space-y-1">
                <div className="text-[10px] text-textDim uppercase tracking-wide">Pies</div>
                <div className="flex gap-1">
                  {(['L', 'R'] as const).map((side) => (
                    <button
                      key={side}
                      onClick={() => setFootSide(side)}
                      className={`flex-1 text-[10px] rounded py-0.5 ${footSide === side ? 'bg-accent text-white' : 'bg-panelLight text-textDim'}`}
                    >
                      {side === 'L' ? 'Izquierdo' : 'Derecho'}
                    </button>
                  ))}
                </div>
                <select
                  value=""
                  onChange={(e) => {
                    const preset = FOOT_PRESETS.find((f) => f.id === e.target.value);
                    if (!preset) return;
                    rig.setFoot(footSide, preset.curls);
                    if (preset.ankleX !== undefined) rig.setJoint(`ankle${footSide}`, 0, preset.ankleX);
                    refresh();
                  }}
                  className="w-full bg-panel border border-border rounded text-[10px] px-1 py-0.5"
                >
                  <option value="">Posición del pie…</option>
                  {FOOT_PRESETS.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.label}
                    </option>
                  ))}
                </select>
                {(() => {
                  const toes = state.feet[footSide];
                  const avg = toes.reduce((a, b) => a + b, 0) / toes.length;
                  return (
                    <NumberSlider
                      label="Todos"
                      value={Math.round(avg * 100)}
                      min={-100}
                      max={100}
                      onChange={(v) => {
                        rig.setFoot(footSide, toes.map(() => v / 100));
                        refresh();
                      }}
                    />
                  );
                })()}
                {TOE_NAMES.map((name, f) => (
                  <NumberSlider
                    key={name}
                    label={name}
                    value={Math.round(state.feet[footSide][f] * 100)}
                    min={-100}
                    max={100}
                    onChange={(v) => {
                      const curls = [...state.feet[footSide]];
                      curls[f] = v / 100;
                      rig.setFoot(footSide, curls);
                      refresh();
                    }}
                  />
                ))}
                <button
                  onClick={() => {
                    const other = footSide === 'L' ? 'R' : 'L';
                    rig.setFoot(other, state.feet[footSide]);
                    rig.setJoint(`ankle${other}`, 0, (state.pose[`ankle${footSide}`] ?? [0, 0, 0])[0]);
                    refresh();
                  }}
                  className="w-full bg-panelLight text-[10px] rounded py-0.5"
                >
                  Copiar al otro pie
                </button>
                <p className="text-[9px] text-textDim">Valores negativos levantan el dedo; positivos lo doblan hacia el suelo. La inclinación del pie se ajusta en la articulación «Tobillo».</p>
              </div>

              <div className="border-t border-border pt-2 space-y-1">
                <div className="text-[10px] text-textDim uppercase tracking-wide">Rostro y expresión</div>
                <select
                  value=""
                  onChange={(e) => {
                    const preset = EXPRESSION_PRESETS.find((x) => x.id === e.target.value);
                    if (preset) {
                      rig.setExpression(preset.expr);
                      refresh();
                    }
                  }}
                  className="w-full bg-panel border border-border rounded text-[10px] px-1 py-0.5"
                >
                  <option value="">Expresión…</option>
                  {EXPRESSION_PRESETS.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.label}
                    </option>
                  ))}
                </select>
                {(
                  [
                    ['browRaise', 'Cejas ↑', -1, 1],
                    ['browTilt', 'Ceño', -1, 1],
                    ['eyeOpen', 'Ojos', 0, 1],
                    ['mouthCurve', 'Sonrisa', -1, 1],
                    ['mouthOpen', 'Boca', 0, 1],
                  ] as [keyof Expression, string, number, number][]
                ).map(([key, label, min, max]) => (
                  <NumberSlider
                    key={key}
                    label={label}
                    value={Math.round(state.expression[key] * 100)}
                    min={min * 100}
                    max={max * 100}
                    onChange={(v) => {
                      rig.setExpression({ ...state.expression, [key]: v / 100 });
                      refresh();
                    }}
                  />
                ))}
              </div>
            </>
          )}

          {state.kind === 'human' && (
            <div className="border-t border-border pt-2 space-y-1">
              <div className="text-[10px] text-textDim uppercase tracking-wide">Estudio de anatomía</div>
              <div className="grid grid-cols-4 gap-1">
                {(
                  [
                    ['Piel', { skin: 1, muscle: false, bone: false }],
                    ['Músculos', { skin: 0, muscle: true, bone: false }],
                    ['Esqueleto', { skin: 0, muscle: false, bone: true }],
                    ['Capas', { skin: 0.25, muscle: true, bone: true }],
                  ] as [string, AnatomyView][]
                ).map(([label, view]) => (
                  <button
                    key={label}
                    onClick={() => {
                      rig.setAnatomy(view);
                      refresh();
                    }}
                    className="bg-panelLight hover:bg-border text-[10px] rounded py-1"
                  >
                    {label}
                  </button>
                ))}
              </div>
              {(() => {
                const a = state.anatomy ?? DEFAULT_ANATOMY;
                return (
                  <>
                    <NumberSlider label="Piel" value={Math.round(a.skin * 100)} min={0} max={100} onChange={(v) => { rig.setAnatomy({ ...a, skin: v / 100 }); refresh(); }} />
                    <div className="flex gap-3">
                      <label className="flex items-center gap-1 text-[10px] text-textDim">
                        <input type="checkbox" checked={a.muscle} onChange={(e) => { rig.setAnatomy({ ...a, muscle: e.target.checked }); refresh(); }} /> Músculos
                      </label>
                      <label className="flex items-center gap-1 text-[10px] text-textDim">
                        <input type="checkbox" checked={a.bone} onChange={(e) => { rig.setAnatomy({ ...a, bone: e.target.checked }); refresh(); }} /> Esqueleto
                      </label>
                    </div>
                  </>
                );
              })()}
              <p className="text-[9px] text-textDim">Músculos y huesos son masas simplificadas para orientarte al posar, no un modelo médico.</p>
            </div>
          )}

          <div className="border-t border-border pt-2 space-y-1">
            <div className="text-[10px] text-textDim uppercase tracking-wide">{state.kind === 'human' ? 'Ropa y accesorios' : 'Aspecto'}</div>
            {state.kind === 'human' && (
              <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
                {(Object.keys(OUTFIT_LABELS) as (keyof Outfit)[]).map((k) => (
                  <label key={k} className="flex items-center gap-1 text-[10px] text-textDim">
                    <input type="checkbox" checked={!!state.outfit[k]} onChange={(e) => patchState({ outfit: { ...state.outfit, [k]: e.target.checked } })} />
                    {OUTFIT_LABELS[k]}
                  </label>
                ))}
              </div>
            )}
            <label className="flex items-center gap-2 text-[10px] text-textDim">
              {state.kind === 'human' ? 'Piel' : 'Pelaje'}
              <input type="color" value={state.skin} onChange={(e) => patchState({ skin: e.target.value })} className="w-8 h-5 bg-transparent" />
            </label>
          </div>
        </>
      )}

      <div className="border-t border-border pt-2 space-y-1">
        <div className="text-[10px] text-textDim uppercase tracking-wide">Objetos de escena</div>
        <select
          value=""
          onChange={(e) => {
            if (!e.target.value) return;
            const p = eng.addProp(e.target.value as PropKind);
            setPropId(p.id);
            onSceneChange();
            refresh();
          }}
          className="w-full bg-panel border border-border rounded text-[10px] px-1 py-0.5"
        >
          <option value="">Añadir objeto…</option>
          {Array.from(new Set(PROP_CATALOG.map((p) => p.group))).map((g) => (
            <optgroup key={g} label={g}>
              {PROP_CATALOG.filter((p) => p.group === g).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        {props.length > 0 && (
          <select
            value={selectedProp?.id ?? ''}
            onChange={(e) => setPropId(Number(e.target.value))}
            className="w-full bg-panel border border-border rounded text-[10px] px-1 py-0.5"
          >
            {props.map((p) => (
              <option key={p.id} value={p.id}>
                {PROP_CATALOG.find((c) => c.id === p.kind)?.label} #{p.id}
              </option>
            ))}
          </select>
        )}
        {selectedProp && (
          <>
            <NumberSlider label="X" value={Number(selectedProp.group.position.x.toFixed(1))} min={-6} max={6} step={0.1} onChange={(v) => { eng.updateProp(selectedProp.id, { x: v }); refresh(); }} />
            <NumberSlider label="Z" value={Number(selectedProp.group.position.z.toFixed(1))} min={-6} max={6} step={0.1} onChange={(v) => { eng.updateProp(selectedProp.id, { z: v }); refresh(); }} />
            <NumberSlider label="Giro" value={Math.round((selectedProp.group.rotation.y * 180) / Math.PI)} min={-180} max={180} onChange={(v) => { eng.updateProp(selectedProp.id, { rotY: v }); refresh(); }} />
            <NumberSlider label="Escala" value={Number(selectedProp.group.scale.x.toFixed(2))} min={0.2} max={6} step={0.05} onChange={(v) => { eng.updateProp(selectedProp.id, { scale: v }); refresh(); }} />
            <button
              onClick={() => {
                eng.removeProp(selectedProp.id);
                setPropId(null);
                onSceneChange();
                refresh();
              }}
              className="w-full bg-panelLight text-[10px] rounded py-1"
            >
              Quitar objeto
            </button>
          </>
        )}
        <p className="text-[9px] text-textDim">Objetos y figuras son bloques simplificados para estudiar volumen, escala y perspectiva, no modelos detallados.</p>
      </div>
    </div>
  );
}
