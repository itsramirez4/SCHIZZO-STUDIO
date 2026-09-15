interface Props {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
}

export default function NumberSlider({ label, value, min, max, step = 1, onChange }: Props) {
  return (
    <div className="flex items-center gap-1.5 text-[10px] text-textDim">
      <span className="w-14 shrink-0">{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="flex-1" />
      <span className="w-8 text-right shrink-0">{value}</span>
    </div>
  );
}
