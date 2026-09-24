import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';

export interface CompareSource {
  id: string;
  label: string;
  url: string;
}

type Mode = 'slider' | 'overlay' | 'side' | 'diff' | 'blink';

const MODE_IDS: Mode[] = ['slider', 'overlay', 'side', 'diff', 'blink'];

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

interface CompareDialogProps {
  sources: CompareSource[];
  initialA: string;
  initialB: string;
  onClose: () => void;
  /** Dialog title and the names of the two sides — "Antes / Después" for versions, "Dibujo / Referencia" for a study. */
  title?: string;
  labelA?: string;
  labelB?: string;
  initialMode?: Mode;
}

/** Side-by-side, slider, semi-transparent overlay, difference and blink comparison of two images
 * (two versions of the artwork, or the drawing against a reference). */
export default function CompareDialog({ sources, initialA, initialB, onClose, title, labelA, labelB, initialMode = 'slider' }: CompareDialogProps) {
  const { t } = useTranslation('panelsProject');
  const resolvedTitle = title ?? t('compare.defaultTitle');
  const resolvedLabelA = labelA ?? t('compare.defaultLabelA');
  const resolvedLabelB = labelB ?? t('compare.defaultLabelB');
  const MODES: { id: Mode; label: string }[] = MODE_IDS.map((id) => ({ id, label: t(`compare.modes.${id}`) }));
  const [aId, setAId] = useState(initialA);
  const [bId, setBId] = useState(initialB);
  const [mode, setMode] = useState<Mode>(initialMode);
  const [split, setSplit] = useState(50);
  const [overlayAlpha, setOverlayAlpha] = useState(50);
  const [blinkOn, setBlinkOn] = useState(false);
  const [changed, setChanged] = useState<number | null>(null);
  const diffRef = useRef<HTMLCanvasElement>(null);
  const a = useMemo(() => sources.find((s) => s.id === aId) ?? sources[0], [sources, aId]);
  const b = useMemo(() => sources.find((s) => s.id === bId) ?? sources[0], [sources, bId]);

  useEffect(() => {
    if (mode !== 'blink') return;
    const t = setInterval(() => setBlinkOn((v) => !v), 700);
    return () => clearInterval(t);
  }, [mode]);

  useEffect(() => {
    if (mode !== 'diff') return;
    let cancelled = false;
    (async () => {
      const [ia, ib] = await Promise.all([loadImage(a.url), loadImage(b.url)]);
      if (cancelled || !diffRef.current) return;
      const w = ia.naturalWidth;
      const h = ia.naturalHeight;
      const c = diffRef.current;
      c.width = w;
      c.height = h;
      const ctx = c.getContext('2d', { willReadFrequently: true })!;
      const draw = (img: HTMLImageElement) => {
        const t = document.createElement('canvas');
        t.width = w;
        t.height = h;
        const tc = t.getContext('2d', { willReadFrequently: true })!;
        tc.fillStyle = '#fff';
        tc.fillRect(0, 0, w, h);
        tc.drawImage(img, 0, 0, w, h);
        return tc.getImageData(0, 0, w, h);
      };
      const da = draw(ia);
      const db = draw(ib);
      const out = ctx.createImageData(w, h);
      let diffPixels = 0;
      for (let i = 0; i < da.data.length; i += 4) {
        const d = Math.max(Math.abs(da.data[i] - db.data[i]), Math.abs(da.data[i + 1] - db.data[i + 1]), Math.abs(da.data[i + 2] - db.data[i + 2]));
        if (d > 12) {
          diffPixels++;
          out.data.set([255, 60, 60, 255], i);
        } else {
          const g = Math.round(db.data[i] * 0.25 + 160 * 0.75 * 0.4);
          out.data.set([g, g, g, 255], i);
        }
      }
      ctx.putImageData(out, 0, 0);
      setChanged(diffPixels / (w * h));
    })().catch(() => setChanged(null));
    return () => {
      cancelled = true;
    };
  }, [mode, a.url, b.url]);

  const select = (value: string, set: (v: string) => void) => (
    <select value={value} onChange={(e) => set(e.target.value)} className="bg-panel border border-border rounded text-xs px-2 py-1 max-w-[13rem]">
      {sources.map((s) => (
        <option key={s.id} value={s.id}>
          {s.label}
        </option>
      ))}
    </select>
  );

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-6" onClick={onClose}>
      <div className="bg-panel border border-border rounded-lg w-full max-w-5xl max-h-full flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 p-3 border-b border-border flex-wrap">
          <span className="text-sm font-semibold mr-2">{resolvedTitle}</span>
          <span className="text-[11px] text-textDim">{resolvedLabelA}</span>
          {select(aId, setAId)}
          <span className="text-[11px] text-textDim">{resolvedLabelB}</span>
          {select(bId, setBId)}
          <div className="flex gap-1 ml-auto">
            {MODES.map((m) => (
              <button key={m.id} onClick={() => setMode(m.id)} className={`text-[11px] px-2 py-1 rounded ${mode === m.id ? 'bg-accent text-white' : 'bg-panelLight text-textDim'}`}>
                {m.label}
              </button>
            ))}
          </div>
          <button onClick={onClose} className="text-textDim hover:text-text shrink-0">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-3 min-h-0 flex items-center justify-center checkerboard">
          {mode === 'slider' && (
            <div className="relative select-none max-w-full" style={{ lineHeight: 0 }}>
              <img src={b.url} alt={resolvedLabelB} className="max-h-[70vh] max-w-full block" draggable={false} />
              <img src={a.url} alt={resolvedLabelA} className="absolute inset-0 w-full h-full" style={{ clipPath: `inset(0 ${100 - split}% 0 0)` }} draggable={false} />
              <div className="absolute top-0 bottom-0 w-0.5 bg-accent" style={{ left: `${split}%` }} />
              <input type="range" min={0} max={100} value={split} onChange={(e) => setSplit(Number(e.target.value))} className="absolute left-0 right-0 bottom-2 w-full opacity-70" />
              <span className="absolute top-2 left-2 text-[10px] bg-black/60 text-white px-1.5 py-0.5 rounded">{resolvedLabelA}</span>
              <span className="absolute top-2 right-2 text-[10px] bg-black/60 text-white px-1.5 py-0.5 rounded">{resolvedLabelB}</span>
            </div>
          )}
          {mode === 'overlay' && (
            <div className="relative select-none max-w-full" style={{ lineHeight: 0 }} data-testid="compare-overlay">
              <img src={a.url} alt={resolvedLabelA} className="max-h-[70vh] max-w-full block bg-white" draggable={false} />
              <img src={b.url} alt={resolvedLabelB} className="absolute inset-0 w-full h-full pointer-events-none" style={{ opacity: overlayAlpha / 100 }} draggable={false} />
              <div className="absolute left-0 right-0 bottom-2 flex items-center gap-2 px-2" style={{ lineHeight: 1 }}>
                <span className="text-[10px] bg-black/60 text-white px-1.5 py-0.5 rounded">{resolvedLabelA}</span>
                <input type="range" min={0} max={100} value={overlayAlpha} onChange={(e) => setOverlayAlpha(Number(e.target.value))} className="flex-1 opacity-80" title={t('compare.overlayOpacityTitle')} />
                <span className="text-[10px] bg-black/60 text-white px-1.5 py-0.5 rounded">{resolvedLabelB} {overlayAlpha}%</span>
              </div>
            </div>
          )}
          {mode === 'side' && (
            <div className="grid grid-cols-2 gap-2 w-full">
              {[a, b].map((s, i) => (
                <div key={s.id + i} className="text-center">
                  <img src={s.url} alt={s.label} className="max-h-[65vh] max-w-full mx-auto" />
                  <div className="text-[11px] text-text mt-1 bg-panel/80 inline-block px-2 rounded">{i === 0 ? resolvedLabelA : resolvedLabelB} · {s.label}</div>
                </div>
              ))}
            </div>
          )}
          {mode === 'blink' && (
            <div className="relative">
              <img src={blinkOn ? b.url : a.url} alt="" className="max-h-[70vh] max-w-full" />
              <span className="absolute top-2 left-2 text-[11px] bg-black/60 text-white px-2 py-0.5 rounded">{blinkOn ? `${resolvedLabelB} · ${b.label}` : `${resolvedLabelA} · ${a.label}`}</span>
            </div>
          )}
          {mode === 'diff' && (
            <div className="text-center">
              <canvas ref={diffRef} className="max-h-[65vh] max-w-full mx-auto" />
              <div className="text-[11px] text-text mt-1 bg-panel/80 inline-block px-2 rounded">
                {changed === null ? t('compare.calculating') : t('compare.diffResult', { percent: (changed * 100).toFixed(1) })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
