import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTools } from '@/hooks/useTools';
import { mixLight, mixPigments } from '@/services/pigmentMix.service';

/** Two-colour pigment mixer with a "how paint behaves" ramp next to the digital (light) blend. */
export default function PigmentMixer() {
  const { primaryColor, secondaryColor, setPrimaryColor } = useTools();
  const [a, setA] = useState(primaryColor);
  const [b, setB] = useState(secondaryColor);
  const [ratio, setRatio] = useState(50);

  const ramp = useMemo(() => Array.from({ length: 9 }, (_, i) => mixPigments([{ hex: a, weight: 8 - i }, { hex: b, weight: i }])), [a, b]);
  const mixed = useMemo(() => mixPigments([{ hex: a, weight: 100 - ratio }, { hex: b, weight: ratio }]), [a, b, ratio]);
  const light = mixLight(a, b, ratio / 100);

  return (
    <div className="space-y-3">
      <p className="text-[10px] text-textDim">
        Mezcla como pintura: azul + amarillo da verde y no gris. Es una aproximación en espacio RYB (no una simulación espectral de pigmentos concretos).
      </p>
      <div className="flex items-center gap-2">
        <input type="color" value={a} onChange={(e) => setA(e.target.value)} className="w-9 h-7 bg-transparent" title="Color A" />
        <input type="range" min={0} max={100} value={ratio} onChange={(e) => setRatio(Number(e.target.value))} className="flex-1" />
        <input type="color" value={b} onChange={(e) => setB(e.target.value)} className="w-9 h-7 bg-transparent" title="Color B" />
      </div>
      <div className="text-[10px] text-textDim text-center">{100 - ratio}% A · {ratio}% B</div>

      <div className="flex gap-2">
        <div className="flex-1">
          <div className="h-12 rounded border border-border" style={{ background: mixed }} />
          <div className="text-[10px] text-center mt-1">Pigmento {mixed}</div>
        </div>
        <div className="flex-1">
          <div className="h-12 rounded border border-border" style={{ background: light }} />
          <div className="text-[10px] text-center mt-1 text-textDim">Luz (RGB) {light}</div>
        </div>
      </div>

      <div>
        <div className="text-[10px] text-textDim mb-1">Rampa de mezcla (9 pasos)</div>
        <div className="flex h-8 rounded overflow-hidden border border-border">
          {ramp.map((c, i) => (
            <button
              key={i}
              title={`${c} — clic para usar como color principal`}
              onClick={() => {
                setPrimaryColor(c);
                toast.success(`Color principal: ${c}`);
              }}
              className="flex-1"
              style={{ background: c }}
            />
          ))}
        </div>
      </div>

      <button
        onClick={() => {
          setPrimaryColor(mixed);
          toast.success('Mezcla aplicada como color principal');
        }}
        className="w-full bg-accent text-white text-[11px] rounded py-1.5"
      >
        Usar mezcla como color principal
      </button>
    </div>
  );
}
