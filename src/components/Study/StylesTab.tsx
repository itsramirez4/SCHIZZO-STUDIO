import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { TRADITIONS } from '@/content/academy';

/** A study library, not a converter: it lists the techniques and devices to look for in each
 * tradition and a practice prompt — your drawing is never restyled. */
export default function StylesTab() {
  const [open, setOpen] = useState<string | null>(null);
  const [region, setRegion] = useState('Todas');
  const regions = useMemo(() => ['Todas', ...new Set(TRADITIONS.map((t) => t.region))], []);
  const list = region === 'Todas' ? TRADITIONS : TRADITIONS.filter((t) => t.region === region);

  return (
    <div className="space-y-2">
      <p className="text-[10px] text-textDim">Para estudiar técnica, composición y pincelada de distintas tradiciones. No transforma tu dibujo: sirve para aprender qué mirar.</p>
      <select value={region} onChange={(e) => setRegion(e.target.value)} className="w-full bg-panel border border-border rounded text-[11px] px-1.5 py-1">
        {regions.map((r) => (
          <option key={r}>{r}</option>
        ))}
      </select>
      {list.map((t) => {
        const expanded = open === t.id;
        return (
          <div key={t.id} className="border border-border rounded overflow-hidden">
            <button onClick={() => setOpen(expanded ? null : t.id)} className="w-full flex items-center gap-1.5 px-2 py-1.5 text-left hover:bg-panelLight">
              {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              <span className="text-[11px] font-medium flex-1">{t.title}</span>
              <span className="text-[9px] text-textDim">{t.region}</span>
            </button>
            {expanded && (
              <div className="px-2 pb-2 space-y-1.5">
                <div className="text-[10px] text-textDim uppercase tracking-wide">Qué observar</div>
                <ul className="list-disc list-inside space-y-1">
                  {t.devices.map((d) => (
                    <li key={d} className="text-[10px] text-textDim leading-relaxed">
                      {d}
                    </li>
                  ))}
                </ul>
                <div className="rounded bg-panelLight p-1.5">
                  <div className="text-[10px] font-medium">Ejercicio</div>
                  <p className="text-[10px] text-textDim leading-relaxed">{t.exercise}</p>
                </div>
                <p className="text-[9px] text-textDim">Busca obras de esta tradición y ábrelas en el panel de Referencias para estudiarlas junto a tu lienzo.</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
