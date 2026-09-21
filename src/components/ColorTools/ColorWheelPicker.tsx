import { useEffect, useRef, useState } from 'react';
import { RGBA } from '@/types/colorTools';
import { HSV, hexToRgba, rgbaToHex, rgbaToHsv, hsvToRgba } from '@/utils/colorUtils';
import { WheelModel, drawWheel, wheelPick, wheelPosition } from '@/services/colorWheel.service';

interface Props {
  hex: string;
  onChange: (hex: string) => void;
  /** Called once when a drag on the wheel or the brightness bar ends (used to remember recent colours). */
  onCommitEnd?: (hex: string) => void;
  model: WheelModel;
  /** Colours of the active harmony: drawn as dots joined by lines; click one to use it (Shift = secondary). */
  harmonyColors?: RGBA[];
  onPickHarmony?: (hex: string, secondary: boolean) => void;
  size?: number;
}

const toHex = (hsv: HSV) => rgbaToHex(hsvToRgba(hsv.h, hsv.s, hsv.v));

/** A colour wheel: angle is the hue, distance from the centre is the saturation, and a bar below sets
 * the brightness. The chosen colour and (optionally) the dots of a harmony are drawn on top. */
export default function ColorWheelPicker({ hex, onChange, onCommitEnd, model, harmonyColors, onPickHarmony, size = 200 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef(false);
  const [hsv, setHsv] = useState<HSV>(() => rgbaToHsv(hexToRgba(hex)));
  const lastHexRef = useRef(hex);

  // Follow colour changes made elsewhere (palette, eyedropper, swap...). Our own drags keep `hsv`
  // and `hex` in step, so the hue is never lost when the colour goes black or grey.
  useEffect(() => {
    if (hex.toLowerCase() !== toHex(hsv).toLowerCase()) setHsv(rgbaToHsv(hexToRgba(hex)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hex]);

  const R = size / 2 - 2;
  const C = size / 2;

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d', { willReadFrequently: false });
    if (!ctx) return;
    ctx.clearRect(0, 0, size, size);
    // Always at full brightness: a black colour must not turn the whole disc black, and the brightness
    // bar below (with the marker) already says how dark the chosen colour is.
    drawWheel(ctx, size, model, 100);

    // rim
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(C, C, R, 0, Math.PI * 2);
    ctx.stroke();

    const base = hsvToRgba(hsv.h, hsv.s, hsv.v);
    const basePos = wheelPosition(base, model, R, C, C);

    if (harmonyColors && harmonyColors.length > 1) {
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      harmonyColors.forEach((col, i) => {
        const p = wheelPosition(col, model, R, C, C);
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      if (harmonyColors.length > 2) ctx.closePath();
      ctx.stroke();
      ctx.setLineDash([]);
      harmonyColors.forEach((col) => {
        const p = wheelPosition(col, model, R, C, C);
        ctx.beginPath();
        ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
        ctx.fillStyle = rgbaToHex(col);
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#fff';
        ctx.stroke();
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(0,0,0,0.6)';
        ctx.stroke();
      });
    }

    // the selected colour: a ring around a filled dot
    ctx.beginPath();
    ctx.arc(basePos.x, basePos.y, 8, 0, Math.PI * 2);
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#fff';
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(basePos.x, basePos.y, 8, 0, Math.PI * 2);
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(basePos.x, basePos.y, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = rgbaToHex(base);
    ctx.fill();
  }, [hsv, model, harmonyColors, size, R, C]);

  function commit(next: HSV) {
    setHsv(next);
    const h = toHex(next);
    lastHexRef.current = h;
    onChange(h);
  }

  function local(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: ((e.clientX - rect.left) / rect.width) * size, y: ((e.clientY - rect.top) / rect.height) * size };
  }

  function pickAt(e: React.PointerEvent<HTMLCanvasElement>) {
    const p = local(e);
    const { h, s } = wheelPick(p.x, p.y, C, C, R, model);
    // Picking on the wheel while the colour is (nearly) black would keep it black: raise it to full brightness.
    commit({ h, s, v: hsv.v < 10 ? 100 : hsv.v });
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const p = local(e);
    // A click on a harmony dot uses that colour instead of moving the base colour.
    if (harmonyColors && onPickHarmony) {
      for (const col of harmonyColors) {
        const d = wheelPosition(col, model, R, C, C);
        if (Math.hypot(d.x - p.x, d.y - p.y) <= 9) {
          onPickHarmony(rgbaToHex(col), e.shiftKey);
          return;
        }
      }
    }
    dragRef.current = true;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore — the drag still tracks through move/up events
    }
    pickAt(e);
  }

  function endDrag() {
    if (!dragRef.current) return;
    dragRef.current = false;
    onCommitEnd?.(lastHexRef.current);
  }

  const full = hsvToRgba(hsv.h, hsv.s, 100);

  return (
    <div className="space-y-1.5" data-testid="color-wheel">
      <canvas
        ref={canvasRef}
        width={size}
        height={size}
        className="mx-auto block cursor-crosshair touch-none"
        style={{ width: '100%', maxWidth: size, aspectRatio: '1 / 1' }}
        onPointerDown={onPointerDown}
        onPointerMove={(e) => dragRef.current && pickAt(e)}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        title="Arrastra para elegir tono (ángulo) y saturación (distancia al centro)"
      />
      <label className="flex items-center gap-2 text-[10px] text-textDim">
        <span className="w-14 shrink-0">Brillo</span>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(hsv.v)}
          onChange={(e) => commit({ ...hsv, v: Number(e.target.value) })}
          onPointerUp={() => onCommitEnd?.(lastHexRef.current)}
          onKeyUp={() => onCommitEnd?.(lastHexRef.current)}
          className="flex-1"
          style={{ background: `linear-gradient(to right, #000, rgb(${full.r},${full.g},${full.b}))`, height: 10, borderRadius: 5 }}
          data-testid="wheel-brightness"
        />
        <span className="w-7 text-right shrink-0">{Math.round(hsv.v)}</span>
      </label>
    </div>
  );
}
